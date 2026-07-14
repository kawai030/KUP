import { mutateDB, readDB } from "@/lib/workspace/db";
import { bad, json, withUser } from "@/lib/workspace/api";
import { reviewGate, runReview } from "@/lib/workspace/compliance";
import { aiReviewFlags } from "@/lib/workspace/ai-review";

type Ctx = { params: Promise<{ id: string }> };

// 검수 실행/재실행 → 자동 플래그 갱신 (정규식 컴플라이언스 + AI 의미 기반 검수 병합)
export async function POST(_req: Request, ctx: Ctx) {
  const guard = await withUser();
  if ("res" in guard) return guard.res;
  const { id } = await ctx.params;

  // AI 검수는 async(Claude 호출)라 mutateDB(동기 콜백) 밖에서 먼저 돌린다.
  // 카드 내용을 먼저 읽어 AI 검수를 수행한 뒤, mutateDB 안에서 정규식 결과와 병합한다.
  // 키 없음/실패 시 aiReviewFlags 는 [] → 정규식 검수만으로 진행(흐름 안 깨짐).
  const pre = await readDB();
  const target = pre.cards.find((c) => c.id === id && c.userId === guard.user.id);
  if (!target) return bad("카드를 찾을 수 없습니다.", 404);
  if (target.status === "업로드완료") return json({ card: target });

  const aiFlags = await aiReviewFlags(target, guard.user.survey);

  const updated = await mutateDB((db) => {
    const card = db.cards.find((c) => c.id === id && c.userId === guard.user.id);
    if (!card || card.status === "업로드완료") return card ?? null;
    card.reviewFlags = [...runReview(card, guard.user.survey), ...aiFlags];
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
    | { flagId?: string; resolved?: boolean; action?: "pass"; consent?: boolean }
    | null;
  if (!body) return bad("잘못된 요청입니다.");

  const result = await mutateDB((db) => {
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
      const gate = reviewGate(card, body.consent === true);
      if (!gate.ok) return { error: "blocked" as const, reason: gate.reason };
      card.status = "제작완료";
      card.approvalLog.push({
        at: Date.now(),
        actor: guard.user.email,
        action: body.consent ? "검수 통과 · 경고 책임 동의 후 승인" : "검수 통과 · 사용자 승인",
      });
      card.updatedAt = Date.now();
      return { card };
    }
    return { error: "noop" as const };
  });

  if ("error" in result) {
    if (result.error === "not_found") return bad("카드를 찾을 수 없습니다.", 404);
    if (result.error === "blocked")
      return bad(result.reason ?? "검수 게이트를 통과하지 못했어요.", 409);
    return bad("처리할 수 없습니다.", 400);
  }
  return json({ card: result.card });
}
