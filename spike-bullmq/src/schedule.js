// 예약 잡 1건을 큐에 넣는다 = "N초 뒤에 발행해줘" 라고 적어두는 행위.
// 이 잡 정보는 Redis에 저장된다. 그래서 이걸 실행하는 워커가 죽어도 예약은 살아남는다.
//
// 사용법:
//   npm run schedule           -> 30초 뒤 발행 예약
//   npm run schedule -- 10     -> 10초 뒤 발행 예약
//   npm run schedule -- 60 "테스트 글"   -> 60초 뒤, 라벨 지정
import { publishQueue } from "./queue.js";

const delaySec = Number(process.argv[2]) || 30;
const label = process.argv[3] || "카드뉴스 시안 #1";

const delayMs = delaySec * 1000;
const now = new Date();
const fireAt = new Date(now.getTime() + delayMs);

const job = await publishQueue.add(
  "publish-post",
  {
    label,
    scheduledAtISO: fireAt.toISOString(),
  },
  {
    delay: delayMs,
    // 잡 실행이 실패하면 자동 재시도 (지수 백오프). 실서비스 발행 재시도 정책의 축소판.
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    // 끝난 잡 기록을 일정 부분 남겨서 status로 확인 가능하게.
    removeOnComplete: 50,
    removeOnFail: 50,
  }
);

console.log("──────────────────────────────────────────────");
console.log(`✅ 예약 등록됨`);
console.log(`   잡 ID    : ${job.id}`);
console.log(`   라벨     : ${label}`);
console.log(`   지금     : ${now.toLocaleTimeString()}`);
console.log(`   실행예정 : ${fireAt.toLocaleTimeString()}  (${delaySec}초 뒤)`);
console.log("──────────────────────────────────────────────");
console.log("이 예약은 이제 Redis에 저장됐다. 워커를 꺼도 사라지지 않는다.");
console.log("워커가 켜져 있으면 예정 시각에 실행되고, 꺼져 있었다면 다시 켜는 즉시 실행된다.");

await publishQueue.close();
process.exit(0);
