import { mutateDB } from "@/lib/db";
import { bad, json, withUser } from "@/lib/api";
import { publishCard } from "@/lib/ig";
import { findIgAccount, type PublishJob } from "@/lib/types";

// 예약 시각이 지난 예약 건을 처리(데모용 lazy 워커). P2: 서버 스케줄러/크론.
async function processDue(userId: string): Promise<void> {
  const due = mutateDB((db) =>
    db.publishJobs
      .filter((j) => j.userId === userId && j.status === "예약" && j.scheduledAt <= Date.now())
      .map((j) => j.id)
  );
  for (const jobId of due) {
    const ctx = mutateDB((db) => {
      const job = db.publishJobs.find((j) => j.id === jobId);
      const card = job ? db.cards.find((c) => c.id === job.cardId) : undefined;
      const user = db.users.find((u) => u.id === userId);
      return job && card && user ? { card, account: findIgAccount(user) } : null;
    });
    if (!ctx) continue;
    const result = await publishCard(ctx.card, ctx.account).catch(() => null);
    mutateDB((db) => {
      const job = db.publishJobs.find((j) => j.id === jobId);
      const card = job ? db.cards.find((c) => c.id === job.cardId) : undefined;
      if (job && result) {
        job.status = "발행완료";
        job.publishedAt = result.publishedAt;
        job.igPermalink = result.permalink;
      }
      if (card && result) {
        card.status = "업로드완료";
        card.approvalLog.push({ at: Date.now(), actor: "scheduler", action: "예약 시각 도래 → 발행" });
        card.updatedAt = Date.now();
      }
    });
  }
}

export async function GET() {
  const guard = await withUser();
  if ("res" in guard) return guard.res;
  await processDue(guard.user.id);
  const jobs = mutateDB((db) =>
    db.publishJobs.filter((j) => j.userId === guard.user.id).sort((a, b) => b.scheduledAt - a.scheduledAt)
  );
  return json({ jobs: jobs as PublishJob[] });
}

// 예약 취소 → 카드 상태를 제작완료로 되돌림
export async function PATCH(req: Request) {
  const guard = await withUser();
  if ("res" in guard) return guard.res;
  const body = (await req.json().catch(() => null)) as { jobId?: string; action?: "cancel" } | null;
  if (!body?.jobId) return bad("jobId가 필요합니다.");

  const res = mutateDB((db) => {
    const job = db.publishJobs.find((j) => j.id === body.jobId && j.userId === guard.user.id);
    if (!job) return { error: "not_found" as const };
    if (job.status !== "예약") return { error: "not_cancelable" as const };
    job.status = "취소";
    const card = db.cards.find((c) => c.id === job.cardId);
    if (card && card.status === "예약업로드") card.status = "제작완료";
    return { job };
  });
  if ("error" in res) {
    if (res.error === "not_found") return bad("예약을 찾을 수 없습니다.", 404);
    return bad("이미 발행되었거나 취소할 수 없는 예약입니다.", 409);
  }
  return json(res);
}
