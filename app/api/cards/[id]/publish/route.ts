import { mutateDB, uid } from "@/lib/workspace/db";
import { bad, json, withUser } from "@/lib/workspace/api";
import { canPublish } from "@/lib/workspace/compliance";
import { publishCard, publicBaseUrl } from "@/lib/workspace/ig";
import { hasCardImages, hasCardVideo } from "@/lib/workspace/images";
import { findIgAccount, isLiveAccount, type PublishJob } from "@/lib/workspace/types";

type Ctx = { params: Promise<{ id: string }> };

// 발행/예약 — 검수 게이트 통과(제작완료) + 사용자가 누르는 발행.
export async function POST(req: Request, ctx: Ctx) {
  const guard = await withUser();
  if ("res" in guard) return guard.res;
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { scheduledAt?: number };

  const pre = await mutateDB((db) => {
    const card = db.cards.find((c) => c.id === id && c.userId === guard.user.id);
    if (!card) return { error: "not_found" as const };
    if (card.status === "업로드완료") return { error: "already" as const };
    // 릴스: 기획완료에서 바로 업로드·발행. 카드뉴스: 검수 통과(제작완료) 필요.
    const reels = card.format === "릴스";
    const okStatus = reels ? card.status === "기획완료" || card.status === "제작완료" : card.status === "제작완료";
    if (!okStatus) return { error: "not_passed" as const };
    if (!canPublish(card)) return { error: "blocked" as const };
    return { card };
  });
  if ("error" in pre) {
    if (pre.error === "not_found") return bad("카드를 찾을 수 없습니다.", 404);
    if (pre.error === "not_passed") return bad("검수를 먼저 통과해야 발행할 수 있습니다.", 409);
    if (pre.error === "blocked") return bad("미해결 검수 항목이 있습니다.", 409);
    return bad("이미 발행된 카드입니다.", 409);
  }

  const card = pre.card;
  const reels = card.format === "릴스";
  const account = findIgAccount(guard.user);
  const live = isLiveAccount(account);

  // 정식 발행은 공개 URL + (릴스=영상 / 카드뉴스=이미지) 가 필요
  if (live) {
    if (!publicBaseUrl()) return bad("PUBLIC_BASE_URL이 설정되지 않았어요(인스타가 가져갈 공개 주소).", 409);
    if (reels && !(await hasCardVideo(card.id))) return bad("업로드된 영상이 없어요. 발행 전에 영상을 먼저 업로드해 주세요.", 409);
    if (!reels && !(await hasCardImages(card.id))) return bad("발행할 이미지가 없어요. 발행 전에 이미지를 먼저 생성해 주세요.", 409);
  }

  const scheduledAt = Number(body.scheduledAt) || 0;
  const immediate = !scheduledAt || scheduledAt <= Date.now();

  const job: PublishJob = {
    id: uid("pub"),
    userId: guard.user.id,
    cardId: card.id,
    cardTitle: card.title,
    igHandle: account?.handle,
    scheduledAt: immediate ? Date.now() : scheduledAt,
    immediate,
    status: immediate ? "발행완료" : "예약",
    createdAt: Date.now(),
  };

  if (immediate) {
    const result = await publishCard(card, account).catch((e: Error) => ({ error: e.message }));
    if ("error" in result) return bad(result.error, 400);
    job.publishedAt = result.publishedAt;
    job.igPermalink = result.permalink;
  }

  const saved = await mutateDB((db) => {
    const c = db.cards.find((x) => x.id === id && x.userId === guard.user.id);
    if (c) {
      c.status = immediate ? "업로드완료" : "예약업로드";
      c.approvalLog.push({ at: Date.now(), actor: guard.user.email, action: immediate ? (live ? "인스타 발행" : "발행(시뮬레이션)") : "예약 발행 등록" });
      c.updatedAt = Date.now();
    }
    db.publishJobs.push(job);
    return { card: c, job };
  });
  return json(saved);
}
