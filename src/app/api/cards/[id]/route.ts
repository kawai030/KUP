import { mutateDB, readDB } from "@/lib/db";
import { bad, json, withUser } from "@/lib/api";
import { runReview } from "@/lib/compliance";
import { deleteCardImages } from "@/lib/images";
import type { CardNews, CardPage } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

function findCard(userId: string, id: string): CardNews | undefined {
  return readDB().cards.find((c) => c.id === id && c.userId === userId);
}

export async function GET(_req: Request, ctx: Ctx) {
  const guard = await withUser();
  if ("res" in guard) return guard.res;
  const { id } = await ctx.params;
  const card = findCard(guard.user.id, id);
  if (!card) return bad("카드를 찾을 수 없습니다.", 404);
  return json({ card });
}

// 편집 / 상태 액션. body.action: "기획확정" (기획중→기획완료)
export async function PATCH(req: Request, ctx: Ctx) {
  const guard = await withUser();
  if ("res" in guard) return guard.res;
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as {
    action?: "기획확정";
    title?: string;
    pages?: CardPage[];
    caption?: string;
    hashtags?: string[];
    cta?: string;
    theme?: string;
    brandColor?: string;
    photoStyle?: "top" | "bg";
    ratio?: "1:1" | "3:4";
  } | null;
  if (!body) return bad("잘못된 요청입니다.");

  const updated = mutateDB((db) => {
    const card = db.cards.find((c) => c.id === id && c.userId === guard.user.id);
    if (!card) return null;
    if (card.status === "업로드완료") return card;

    if (body.action === "기획확정") {
      if (card.status === "기획중") card.status = "기획완료";
      card.updatedAt = Date.now();
      return card;
    }

    let contentChanged = false;
    if (typeof body.title === "string" && body.title !== card.title) {
      card.title = body.title;
      contentChanged = true;
    }
    if (Array.isArray(body.pages)) {
      card.pages = body.pages.map((p, i) => ({
        index: i,
        headline: p.headline ?? "",
        body: p.body ?? "",
        note: p.note,
        photoNote: p.photoNote,
      }));
      card.pageCount = card.pages.length;
      contentChanged = true;
    }
    if (typeof body.caption === "string") {
      card.caption = body.caption;
      contentChanged = true;
    }
    if (Array.isArray(body.hashtags)) card.hashtags = body.hashtags.map((h) => h.trim()).filter(Boolean);
    if (typeof body.cta === "string") card.cta = body.cta;
    if (typeof body.theme === "string") card.theme = body.theme;
    if (typeof body.brandColor === "string") card.brandColor = body.brandColor;
    if (body.photoStyle === "top" || body.photoStyle === "bg") card.photoStyle = body.photoStyle;
    if (body.ratio === "1:1" || body.ratio === "3:4") card.ratio = body.ratio;

    // 사용자 편집 → AI 라벨 해제 (IA: 편집을 거치면 해제)
    if (contentChanged) card.aiEdited = true;

    const reels = card.format === "릴스";
    if (reels) {
      // 릴스: 예약 상태면 기획완료로 되돌리고, 편집 시 검수 재실행(제작 단계 없음)
      if (card.status === "예약업로드") card.status = "기획완료";
      card.reviewFlags = runReview(card, guard.user.survey);
    } else {
      // 카드뉴스: 본문 변경 → 이전 검수통과/예약 무효화, 검수 재실행
      if (card.status === "제작완료" || card.status === "예약업로드") card.status = "제작중";
      if (card.status === "제작중") card.reviewFlags = runReview(card, guard.user.survey);
    }
    card.updatedAt = Date.now();
    return card;
  });

  if (!updated) return bad("카드를 찾을 수 없습니다.", 404);
  return json({ card: updated });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const guard = await withUser();
  if ("res" in guard) return guard.res;
  const { id } = await ctx.params;
  mutateDB((db) => {
    db.cards = db.cards.filter((c) => !(c.id === id && c.userId === guard.user.id));
    db.publishJobs = db.publishJobs.filter((j) => j.cardId !== id);
  });
  deleteCardImages(id);
  return json({ ok: true });
}
