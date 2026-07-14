// Redis 연결을 한 곳에서 정의한다.
// 연결주소는 REDIS_URL 환경변수 하나로만 읽는다 → 로컬(Docker)이든 배포(Railway/Upstash)든
// 코드 수정 없이 이 값만 바뀌면 된다. 이게 이 스파이크의 설계 핵심 중 하나.
import IORedis from "ioredis";

export const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// BullMQ 워커는 블로킹 명령을 쓰므로 maxRetriesPerRequest: null 이 필수다.
// (이 옵션 없으면 BullMQ가 시작 시 에러를 던진다.)
export function makeConnection() {
  return new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,
  });
}

// 큐 이름. Queue·Worker·status 가 같은 이름을 써야 같은 줄을 본다.
export const QUEUE_NAME = "publish";
