// cron(반복) 잡 = "매일 04:00 인사이트 수집" 같은 주기 작업의 검증.
// delayed(1회 예약, schedule.js)와 달리 BullMQ Job Scheduler로 "패턴마다 자동 반복"을 등록한다.
// 같은 schedulerId로 다시 부르면 갱신될 뿐 중복 등록되지 않는다(멱등).
//
// 사용법:
//   npm run cron                       -> 10초마다 반복(테스트용 빠른 패턴)
//   npm run cron -- "0 0 4 * * *"      -> 매일 04:00 (운영 패턴, Asia/Seoul)
//   npm run cron -- stop               -> 등록된 cron 스케줄 제거
//
// cron 패턴은 6필드(초 분 시 일 월 요일)까지 지원. 운영 인사이트 수집은 "0 0 4 * * *".
import { publishQueue } from "./queue.js";

const SCHEDULER_ID = "insights-collect";
const arg = process.argv[2];

if (arg === "stop") {
  const removed = await publishQueue.removeJobScheduler(SCHEDULER_ID);
  console.log(removed ? `🗑  cron 스케줄 '${SCHEDULER_ID}' 제거됨` : `(제거할 스케줄 없음)`);
  await publishQueue.close();
  process.exit(0);
}

const pattern = arg || "*/10 * * * * *"; // 기본: 10초마다(반복을 눈으로 빨리 확인)
const label = process.argv[3] || "인사이트 수집(04:00형)";

// upsertJobScheduler(스케줄러id, 반복옵션, 잡템플릿)
await publishQueue.upsertJobScheduler(
  SCHEDULER_ID,
  { pattern, tz: "Asia/Seoul" },
  { name: "insights-collect", data: { label } }
);

console.log("──────────────────────────────────────────────");
console.log(`✅ cron 등록됨 (반복 스케줄)`);
console.log(`   스케줄러 : ${SCHEDULER_ID}`);
console.log(`   패턴     : ${pattern}  (tz Asia/Seoul)`);
console.log(`   라벨     : ${label}`);
console.log("──────────────────────────────────────────────");
console.log("이 스케줄은 Redis에 저장된다. 워커가 켜져 있으면 패턴마다 자동 실행되고,");
console.log("워커가 꺼져 있던 동안의 주기는 재시작 시 따라잡는다(misfire 보정).");
console.log("운영 전환: 패턴을 \"0 0 4 * * *\" 로 주면 매일 04:00 수집. 코드 변경 없음.");
console.log("중지: npm run cron -- stop");

await publishQueue.close();
process.exit(0);
