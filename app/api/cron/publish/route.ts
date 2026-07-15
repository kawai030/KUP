import { NextResponse } from "next/server";
import { mutateDB } from "@/lib/workspace/db";
import { canPublish } from "@/lib/workspace/compliance";
import { publishCard } from "@/lib/workspace/ig";
import { findIgAccount } from "@/lib/workspace/types";
import { captureException } from "@/lib/sentry";

// 예약 발행 실행기 — 예약 시각이 지난 publishJob 을 실제로 인스타에 쏜다.
// 트리거: Vercel Cron(vercel.json) 또는 외부 크론이 주기적으로 GET 호출.
//   1) 만기 예약 잡을 '발행중'으로 원자적 선점(claim) → 크론이 겹쳐 돌아도 이중발행 방지
//   2) 카드·계정 로드 → publishCard(정식이면 Graph API, 테스터면 시뮬레이터)
//   3) 성공: 잡 '발행완료' + 카드 '업로드완료' / 실패: 잡 '실패' + 사유 기록
// ⚠️ 서버리스라 상태가 없다 → 매 실행이 DB(공유 저장소)만 보고 판단한다.

export const dynamic = "force-dynamic";
export const maxDuration = 60; // 캐러셀 waitReady 등 발행에 시간이 걸릴 수 있다

const STALE_MS = 10 * 60 * 1000; // '발행중'에 10분 넘게 멈춘 잡은 회수(크래시 대비)

// Vercel Cron 은 CRON_SECRET 이 있으면 Authorization: Bearer <secret> 를 붙여 보낸다.
// 설정돼 있으면 그 헤더가 맞아야만 실행(아무나 예약을 트리거하지 못하게).
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // 미설정(로컬) → 개방. 프로덕션에선 반드시 설정할 것.
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) return new NextResponse("Unauthorized", { status: 401 });
  const now = Date.now();

  // ── 1) 선점(claim): 만기 예약 + 멈춘 발행중 잡을 한 번의 쓰기로 '발행중' 표시 ──
  const claimed = await mutateDB((db) => {
    const out: { jobId: string; userId: string; cardId: string; igHandle?: string }[] = [];
    for (const j of db.publishJobs) {
      const due = j.status === "예약" && j.scheduledAt <= now;
      const stale = j.status === "발행중" && (j.startedAt ?? 0) < now - STALE_MS;
      if (!due && !stale) continue;
      j.status = "발행중";
      j.startedAt = now;
      j.attempts = (j.attempts ?? 0) + 1;
      out.push({ jobId: j.id, userId: j.userId, cardId: j.cardId, igHandle: j.igHandle });
    }
    return out;
  });

  const results: { jobId: string; ok: boolean; permalink?: string; error?: string }[] = [];

  // ── 2) 순차 발행(인스타 rate limit 배려, 소량 전제) ──
  for (const c of claimed) {
    const settle = async (patch: Parameters<typeof applyResult>[1]) => applyResult(c.jobId, patch, c.cardId, c.userId);
    try {
      // 카드·계정 스냅샷 로드
      const ctx = await mutateDB((db) => {
        const card = db.cards.find((x) => x.id === c.cardId && x.userId === c.userId) ?? null;
        const user = db.users.find((u) => u.id === c.userId);
        // 예약 당시 고른 핸들 우선, 없으면 활성 계정
        const account = user ? user.igAccounts.find((a) => a.handle === c.igHandle) ?? findIgAccount(user) : undefined;
        return {
          card: card ? (JSON.parse(JSON.stringify(card)) as typeof card) : null,
          account: account ? (JSON.parse(JSON.stringify(account)) as typeof account) : undefined,
        };
      });

      if (!ctx.card) {
        await settle({ status: "실패", error: "카드를 찾을 수 없어요(삭제됨)." });
        results.push({ jobId: c.jobId, ok: false, error: "card_not_found" });
        continue;
      }
      // 예약 후 카드가 수정돼 검수에서 빠졌으면 발행하지 않는다(스테일 예약 안전장치)
      if (ctx.card.status !== "예약업로드" || !canPublish(ctx.card)) {
        await settle({ status: "실패", error: "예약 후 카드가 수정돼 예약이 취소됐어요. 다시 예약해 주세요." });
        results.push({ jobId: c.jobId, ok: false, error: "stale_or_blocked" });
        continue;
      }

      const r = await publishCard(ctx.card, ctx.account);
      await settle({ status: "발행완료", publishedAt: r.publishedAt, igPermalink: r.permalink, cardDone: true });
      results.push({ jobId: c.jobId, ok: true, permalink: r.permalink });
    } catch (e) {
      const msg = (e as Error).message || "발행 중 오류";
      captureException(e, { op: "cron/publish", jobId: c.jobId, cardId: c.cardId });
      await settle({ status: "실패", error: msg });
      results.push({ jobId: c.jobId, ok: false, error: msg });
    }
  }

  return NextResponse.json({ processed: claimed.length, ok: results.filter((r) => r.ok).length, results });
}

// 발행 결과를 잡·카드에 반영. cardDone 이면 카드도 '업로드완료'로.
async function applyResult(
  jobId: string,
  patch: { status: "발행완료" | "실패"; publishedAt?: number; igPermalink?: string; error?: string; cardDone?: boolean },
  cardId: string,
  userId: string,
): Promise<void> {
  await mutateDB((db) => {
    const job = db.publishJobs.find((j) => j.id === jobId);
    if (job) {
      job.status = patch.status;
      job.startedAt = undefined;
      if (patch.publishedAt) job.publishedAt = patch.publishedAt;
      if (patch.igPermalink) job.igPermalink = patch.igPermalink;
      job.error = patch.error;
    }
    if (patch.cardDone) {
      const card = db.cards.find((x) => x.id === cardId && x.userId === userId);
      if (card) {
        card.status = "업로드완료";
        card.approvalLog.push({ at: Date.now(), actor: "system(cron)", action: "예약 발행 실행" });
        card.updatedAt = Date.now();
      }
    }
  });
}
