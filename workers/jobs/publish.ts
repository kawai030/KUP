import type { Job } from "bullmq";
import type { PublishJobData } from "@/workers/queue";
import { captureException } from "@/lib/sentry";

/**
 * publish 잡 처리기 — 스텁(Task 3).
 * 실제 로직은 Phase 5에서 검증 PoC의 2단계 발행을 이식:
 *   1) deck → 렌더 PNG 공개 URL 확보
 *   2) IG 컨테이너 생성 → FINISHED 폴링 → 게시
 *   3) posts 기록 + challenge_logs upsert + schedules.status='done'
 * 실패 시 schedules.last_error 기록 + Sentry.
 */
export async function processPublish(job: Job<PublishJobData>): Promise<{ ok: boolean }> {
  const { scheduleId, deckId, channelId } = job.data;
  try {
    console.log(`[publish:stub] schedule=${scheduleId} deck=${deckId} channel=${channelId}`);
    // TODO(Phase5): 2단계 발행 + posts/challenge_logs 기록
    return { ok: true };
  } catch (error) {
    captureException(error, { scheduleId, deckId, channelId });
    throw error; // BullMQ 재시도(backoff)로 위임
  }
}
