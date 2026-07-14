import { mutateDB, readDB } from "@/lib/workspace/db";
import { bad, json, withUser } from "@/lib/workspace/api";
import { generateCard, type CardGenInput } from "@/lib/workspace/ai";
import { runReview } from "@/lib/workspace/compliance";

type Ctx = { params: Promise<{ id: string }> };

// ② 제작하러가기 — 기획 아웃라인 기반으로 본문 완성. 상태: 기획중/완료 → 제작중
export async function POST(_req: Request, ctx: Ctx) {
  const guard = await withUser();
  if ("res" in guard) return guard.res;
  if (!guard.user.survey) return bad("먼저 시작 설문을 완료하세요.", 409);
  const { id } = await ctx.params;

  const card = (await readDB()).cards.find((c) => c.id === id && c.userId === guard.user.id);
  if (!card) return bad("카드를 찾을 수 없습니다.", 404);
  if (!(card.status === "기획중" || card.status === "기획완료" || card.status === "제작중"))
    return bad("기획 단계의 카드만 제작할 수 있어요.", 409);

  const input: CardGenInput = {
    topicSource: card.topicSource,
    topicTitle: card.title,
    format: card.format,
    objective: card.objective,
    pageCount: card.pageCount,
    keyMessage: card.keyMessage,
  };
  let result;
  try {
    result = await generateCard(guard.user.survey, input, card.pages);
  } catch {
    return bad("지금 AI가 혼잡해요. 잠시 후 다시 시도해 주세요.", 503);
  }

  const updated = await mutateDB((db) => {
    const c = db.cards.find((x) => x.id === id && x.userId === guard.user.id);
    if (!c) return null;
    c.title = result.title;
    c.pages = result.pages;
    c.pageCount = result.pages.length;
    c.caption = result.caption;
    c.hashtags = result.hashtags;
    c.cta = result.cta;
    c.generatedBy = result.generatedBy;
    c.aiEdited = false; // 새로 생성된 초안 → AI 라벨 부착
    c.status = "제작중";
    c.reviewFlags = runReview(c, guard.user.survey);
    c.updatedAt = Date.now();
    return c;
  });
  if (!updated) return bad("카드를 찾을 수 없습니다.", 404);
  return json({ card: updated });
}
