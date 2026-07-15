import { mutateDB, readDB } from "@/lib/workspace/db";
import { bad, json, withUser } from "@/lib/workspace/api";
import { runReview } from "@/lib/workspace/compliance";
import { deleteCardImages } from "@/lib/workspace/images";
import type { CardNews, CardPage } from "@/lib/workspace/types";

type Ctx = { params: Promise<{ id: string }> };

async function findCard(userId: string, id: string): Promise<CardNews | undefined> {
  return (await readDB()).cards.find((c) => c.id === id && c.userId === userId);
}

export async function GET(_req: Request, ctx: Ctx) {
  const guard = await withUser();
  if ("res" in guard) return guard.res;
  const { id } = await ctx.params;
  const card = await findCard(guard.user.id, id);
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

  const updated = await mutateDB((db) => {
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
      // 검수는 텍스트(headline/body)만 본다(compliance.runReview) → 텍스트가 실제로 바뀐 경우에만
      // contentChanged. 템플릿/미디어만 바꾼 저장이 '제작완료'를 '제작중'으로 되돌리면 안 된다.
      const textOf = (ps: CardPage[]) => JSON.stringify(ps.map((p) => [p.headline ?? "", p.body ?? ""]));
      const prevText = textOf(card.pages);

      card.pages = body.pages.map((p, i) => ({
        index: i,
        headline: p.headline ?? "",
        body: p.body ?? "",
        note: p.note,
        photoNote: p.photoNote,
        // ── 장별 템플릿/미디어 (신뢰 못 할 입력이므로 스프레드 대신 필드 나열) ──
        template: p.template,
        tag: p.tag,
        mediaType: p.mediaType,
        mediaLayout: p.mediaLayout === "bg" || p.mediaLayout === "split" ? p.mediaLayout : undefined,
        items: Array.isArray(p.items) ? p.items.map((s) => String(s)) : undefined,
        compare: p.compare,
        stat: p.stat,
        ctaLabel: p.ctaLabel,
      }));
      card.pageCount = card.pages.length;
      if (textOf(card.pages) !== prevText) contentChanged = true;
    }
    if (typeof body.caption === "string" && body.caption !== card.caption) {
      card.caption = body.caption;
      contentChanged = true;
    }
    if (Array.isArray(body.hashtags)) card.hashtags = body.hashtags.map((h) => h.trim()).filter(Boolean);
    // cta 도 검수(runReview)의 검사 대상 텍스트다 → 바뀌면 검수 재실행이 필요하다.
    // (안 그러면 '제작완료' 카드에서 cta 만 비준수 문구로 바꿔 저장할 때 검수 게이트를 우회한다)
    if (typeof body.cta === "string" && body.cta !== card.cta) {
      card.cta = body.cta;
      contentChanged = true;
    }
    if (typeof body.theme === "string") card.theme = body.theme;
    if (typeof body.brandColor === "string") card.brandColor = body.brandColor;
    // (기존 누락) 클라이언트가 보내던 값인데 서버가 안 받아 새로고침 시 초기화되던 버그
    if (body.photoStyle === "top" || body.photoStyle === "bg") card.photoStyle = body.photoStyle;
    if (body.ratio === "1:1" || body.ratio === "3:4") card.ratio = body.ratio;

    // 사용자 편집 → AI 라벨 해제 (IA: 편집을 거치면 해제)
    if (contentChanged) card.aiEdited = true;

    // 텍스트가 바뀐 경우에만 검수 무효화·재실행. (템플릿/비율/사진배치 변경은 검수 결과에 영향 없음)
    if (contentChanged) {
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
  await mutateDB((db) => {
    db.cards = db.cards.filter((c) => !(c.id === id && c.userId === guard.user.id));
    db.publishJobs = db.publishJobs.filter((j) => j.cardId !== id);
  });
  await deleteCardImages(id);
  return json({ ok: true });
}
