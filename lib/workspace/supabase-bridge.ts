import { createClient } from "@/lib/supabase/server";
import { readDB, mutateDB } from "@/lib/workspace/db";
import { createSession, newUser } from "@/lib/workspace/auth";
import type { User } from "@/lib/workspace/types";

/**
 * Supabase 인증 ↔ 워크스페이스 파일DB 브릿지 (임시).
 *
 * 로그인은 Supabase Auth가 담당하고, 워크스페이스 데이터는 아직 파일DB(.data)에 있다.
 * 그래서 Supabase 로그인 직후, 그 유저(email 기준)를 파일DB 유저로 매핑/생성하고
 * onekup_session 쿠키를 발급한다 → 팀원 워크스페이스 화면/API가 그대로 동작.
 *
 * TODO(데이터 연결 단계): 워크스페이스 데이터를 Supabase로 옮기면 이 브릿지는 제거.
 *
 * ⚠️ 쿠키를 set 하므로 Route Handler / Server Action 안에서만 호출할 것
 *    (Server Component에서 호출하면 Next가 막는다).
 */
export async function bridgeSupabaseSession(): Promise<{ ok: boolean; survey: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const email = user?.email?.toLowerCase();
  if (!email) return { ok: false, survey: false };

  let dbUser: User | undefined = (await readDB()).users.find((u) => u.email === email);
  if (!dbUser) {
    const meta = (user!.user_metadata ?? {}) as { name?: string; full_name?: string };
    const created = newUser({
      email,
      name: (meta.name || meta.full_name || email.split("@")[0] || email).slice(0, 12),
      authProvider: "google",
      marketingConsent: false,
    });
    await mutateDB((d) => d.users.push(created));
    dbUser = created;
  }

  await createSession(dbUser.id);
  return { ok: true, survey: !!dbUser.survey };
}
