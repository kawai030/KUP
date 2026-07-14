import type { SupabaseClient } from "@supabase/supabase-js";
import type { Concept } from "@/lib/concept-schema";
import type { Database, Json } from "@/lib/db/database.types";

/**
 * 로컬 개발용 시드 — 실제 소유권 체인(auth.user → profile → channel → channel_config)을
 * 만들어 deck 을 붙일 channel_id 를 돌려준다. service_role(admin)로 RLS 우회.
 * ⚠️ 개발 전용. 정식 가입·OAuth(Flow ①②)는 이후 단계에서 UI로 구현(이 시드를 대체).
 */

const DEV_EMAIL = "dev@kup.local";
const DEV_PASSWORD = "dev-password-123456";

type Db = SupabaseClient<Database>;

async function ensureDevUser(db: Db): Promise<string> {
  const created = await db.auth.admin.createUser({
    email: DEV_EMAIL,
    password: DEV_PASSWORD,
    email_confirm: true,
  });
  if (created.data?.user) return created.data.user.id;

  // 이미 존재 → 목록에서 찾기
  const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(`[seed] 사용자 조회 실패: ${error.message}`);
  const found = data.users.find((u) => u.email === DEV_EMAIL);
  if (!found) throw new Error(`[seed] dev 사용자 생성/조회 실패: ${created.error?.message ?? "unknown"}`);
  return found.id;
}

/** concept 으로 dev 채널(+컨셉 잠금)을 보장하고 channel_id 반환. */
export async function ensureDevChannel(db: Db, concept: Concept): Promise<string> {
  const userId = await ensureDevUser(db);

  const profile = await db.from("profiles").upsert({ id: userId, email: DEV_EMAIL }, { onConflict: "id" });
  if (profile.error) throw new Error(`[seed] profile upsert 실패: ${profile.error.message}`);

  // 채널은 (user_id, ig_username=concept.account) 로 식별
  const existing = await db
    .from("channels")
    .select("id")
    .eq("user_id", userId)
    .eq("ig_username", concept.account)
    .limit(1)
    .maybeSingle();
  if (existing.error) throw new Error(`[seed] channel 조회 실패: ${existing.error.message}`);

  let channelId = existing.data?.id;
  if (!channelId) {
    const inserted = await db
      .from("channels")
      .insert({ user_id: userId, ig_username: concept.account, status: "needs_setup" })
      .select("id")
      .single();
    if (inserted.error) throw new Error(`[seed] channel 생성 실패: ${inserted.error.message}`);
    channelId = inserted.data.id;
  }

  // 컨셉 잠금(channel_configs = 파이프라인 §1.1 Concept)
  const config = await db.from("channel_configs").upsert(
    {
      channel_id: channelId,
      persona: concept.persona,
      tone: concept.tone,
      pillars: concept.pillars,
      cadence: concept.cadence,
      visual: concept.visual as unknown as Json,
    },
    { onConflict: "channel_id" },
  );
  if (config.error) throw new Error(`[seed] channel_config upsert 실패: ${config.error.message}`);

  return channelId;
}
