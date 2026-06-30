import { mutateDB } from "@/lib/db";
import { bad, json, withUser } from "@/lib/api";
import { canPublish, runReview } from "@/lib/compliance";

type Ctx = { params: Promise<{ id: string }> };

// 검수 실행/재실행 → 자동 플래그 갱신
export async function POST(_req: Request, ctx: Ctx) {
  const guard = await withUser();
  if ("res" in guard) return guard.res;
  const { id } = await ctx.params;
  const updated = mutateDB((db) => {
    const card = db.cards.find((c) => c.id === id && c.userId === guard.user.id);
    if (!card || card.status === "업로드완료") return card ?? null;
    card.reviewFlags = runReview(card, guard.user.survey);
    if (card.status === "제작완료" || card.status === "예약업로드") card.status = "제작중";
    card.updatedAt = Date.now();
    return card;
  });
  if (!updated) return bad("카드를 찾을 수 없습니다.", 404);
  return json({ card: updated });
}

// 플래그 처리(확인/수정) 또는 게이트 통과(action: "pass" → 제작완료, 사용자 승인)
export async function PATCH(req: Request, ctx: Ctx) {
  const guard = await withUser();
  if ("res" in guard) return guard.res;
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as
    | { flagId?: string; resolved?: boolean; action?: "pass" }
    | null;
  if (!body) return bad("잘못된 요청입니다.");

  const result = mutateDB((db) => {
    const card = db.cards.find((c) => c.id === id && c.userId === guard.user.id);
    if (!card) return { error: "not_found" as const };
    if (card.status === "업로드완료") return { error: "published" as const };

    if (body.flagId) {
      const flag = card.reviewFlags.find((f) => f.id === body.flagId);
      if (flag) flag.resolved = body.resolved ?? true;
      card.updatedAt = Date.now();
      return { card };
    }
    if (body.action === "pass") {
      if (!canPublish(card)) return { error: "blocked" as const };
      card.status = "제작완료";
      card.approvalLog.push({ at: Date.now(), actor: guard.user.email, action: "검수 통과 · 사용자 승인" });
      card.updatedAt = Date.now();
      return { card };
    }
    return { error: "noop" as const };
  });

  if ("error" in result) {
    if (result.error === "not_found") return bad("카드를 찾을 수 없습니다.", 404);
    if (result.error === "blocked")
      return bad("미해결 검수 항목이 있어요. 모두 확인/수정해야 통과할 수 있습니다.", 409);
    return bad("처리할 수 없습니다.", 400);
  }
  return json({ card: result.card });
}
