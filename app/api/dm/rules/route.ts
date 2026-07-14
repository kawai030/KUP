import { mutateDB, readDB, uid } from "@/lib/workspace/db";
import { bad, json, withUser } from "@/lib/workspace/api";
import { DM_LIMITS, type DmRule } from "@/lib/workspace/types";

// DM 리드마그넷 (#7): 댓글 트리거 → 정보 DM (공식 API · 옵트인).
// 콜드 DM·자동팔로우 금지. 베타에서는 시뮬레이션 발송으로 흐름만 검증.

export async function GET() {
  const guard = await withUser();
  if ("res" in guard) return guard.res;
  const rules = (await readDB())
    .dmRules.filter((r) => r.userId === guard.user.id)
    .sort((a, b) => b.createdAt - a.createdAt);
  return json({ rules });
}

export async function POST(req: Request) {
  const guard = await withUser();
  if ("res" in guard) return guard.res;
  const b = (await req.json().catch(() => null)) as Partial<DmRule> | null;
  if (!b) return bad("잘못된 요청입니다.");
  if (!b.optIn) return bad("옵트인 동의가 필요합니다. (콜드 DM·자동팔로우 금지 정책)", 409);
  if (!b.triggerKeyword?.trim()) return bad("트리거 키워드를 입력하세요.");
  if (!b.dmMessage?.trim()) return bad("발송할 DM 내용을 입력하세요.");

  const rule: DmRule = {
    id: uid("dm"),
    userId: guard.user.id,
    enabled: b.enabled ?? true,
    optIn: true,
    triggerKeyword: b.triggerKeyword.trim(),
    postReference: (b.postReference || "").trim(), // 표시용 라벨(게시물 캡션 등)
    mediaId: (b.mediaId || "").trim() || undefined, // 비우면 전체 게시물에 적용
    dmMessage: b.dmMessage.trim(),
    resourceLink: (b.resourceLink || "").trim(),
    sentCount: 0,
    createdAt: Date.now(),
  };
  await mutateDB((db) => db.dmRules.push(rule));
  return json({ rule });
}

// 토글(enabled) 또는 시뮬레이션 발송(action:"simulate")
export async function PATCH(req: Request) {
  const guard = await withUser();
  if ("res" in guard) return guard.res;
  const b = (await req.json().catch(() => null)) as
    | { id?: string; enabled?: boolean; action?: "simulate" }
    | null;
  if (!b?.id) return bad("id가 필요합니다.");

  const limit = DM_LIMITS[guard.user.plan];
  const res = await mutateDB((db) => {
    const rule = db.dmRules.find((r) => r.id === b.id && r.userId === guard.user.id);
    if (!rule) return { error: "not_found" as const };
    if (typeof b.enabled === "boolean") rule.enabled = b.enabled;
    if (b.action === "simulate") {
      const used = db.dmRules.filter((r) => r.userId === guard.user.id).reduce((s, r) => s + r.sentCount, 0);
      if (used >= limit) return { error: "limit" as const };
      if (rule.enabled) rule.sentCount += 1;
    }
    return { rule };
  });
  if ("error" in res) {
    if (res.error === "limit")
      return bad(`현재 플랜(${guard.user.plan})의 DM 한도(${limit}건)에 도달했어요. 플랜을 업그레이드하세요.`, 409);
    return bad("규칙을 찾을 수 없습니다.", 404);
  }
  return json({ rule: res.rule });
}

export async function DELETE(req: Request) {
  const guard = await withUser();
  if ("res" in guard) return guard.res;
  const b = (await req.json().catch(() => null)) as { id?: string } | null;
  if (!b?.id) return bad("id가 필요합니다.");
  await mutateDB((db) => {
    db.dmRules = db.dmRules.filter((r) => !(r.id === b.id && r.userId === guard.user.id));
  });
  return json({ ok: true });
}
