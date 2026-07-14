import { Worker } from "bullmq";
import { getConnection, QUEUE_NAMES, type PublishJobData } from "@/workers/queue";
import { processPublish } from "@/workers/jobs/publish";
import { captureException } from "@/lib/sentry";

/**
 * 워커 엔트리포인트 — Railway 등 상시 서버에서 `npm run worker`로 실행.
 * (Vercel은 app/만 배포. 워커는 BullMQ·Playwright 상시 프로세스가 필요 → 분리.)
 *
 * Task 3은 publish 잡만 등록. token-refresh / insights-collect / dm-send 는
 * Phase 5~6에서 같은 패턴으로 추가(데이터모델 §7).
 */

function main() {
  const connection = getConnection();
  const workers: Worker[] = [];

  const publishWorker = new Worker<PublishJobData>(QUEUE_NAMES.publish, processPublish, {
    connection,
    concurrency: 5,
  });
  publishWorker.on("failed", (job, err) => {
    captureException(err, { queue: QUEUE_NAMES.publish, jobId: job?.id });
  });
  workers.push(publishWorker);

  console.log(`[worker] up — queues: ${QUEUE_NAMES.publish}`);

  const shutdown = async () => {
    console.log("[worker] shutting down…");
    await Promise.all(workers.map((w) => w.close()));
    await connection.quit();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main();
