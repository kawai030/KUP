import { Queue } from "bullmq";
import IORedis from "ioredis";
import { serverEnv } from "@/lib/env";

/**
 * BullMQ 큐 정의 — 데이터모델 §7(워커-DB 계약)과 1:1.
 * 함정(BullMQ_cron 심층): Upstash는 건당 과금 → 유휴 폴링이 비용을 샌다.
 *   운영에선 Fixed plan + maxRetriesPerRequest:null 권장.
 */

export const QUEUE_NAMES = {
  publish: "publish", // schedules.bullmq_job_id ↔ delayed job
  tokenRefresh: "token-refresh", // ig_tokens.expires_at ↔ repeat
  insightsCollect: "insights-collect", // cron 04:00 스냅샷
  dmSend: "dm-send", // 댓글 키워드 → Private Reply → dm_logs
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

let _connection: IORedis | null = null;

/** BullMQ 워커/큐 공유 Redis 연결. REDIS_URL 없으면 명시적 에러(스캐폴드 단계엔 미설정 가능). */
export function getConnection(): IORedis {
  if (!_connection) {
    const { REDIS_URL } = serverEnv();
    if (!REDIS_URL) {
      throw new Error("[queue] REDIS_URL 미설정 — Upstash Redis 연결 필요(.env.example 참고)");
    }
    _connection = new IORedis(REDIS_URL, {
      // BullMQ 필수: 블로킹 명령에서 재시도 제한 끄기
      maxRetriesPerRequest: null,
    });
  }
  return _connection;
}

/** ⏱ 예약 발행 잡 페이로드 — schedules row 1개당 1잡. */
export type PublishJobData = {
  scheduleId: string;
  deckId: string;
  channelId: string;
};

let _publishQueue: Queue<PublishJobData> | null = null;
export function publishQueue(): Queue<PublishJobData> {
  if (!_publishQueue) {
    _publishQueue = new Queue<PublishJobData>(QUEUE_NAMES.publish, {
      connection: getConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5_000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    });
  }
  return _publishQueue;
}
