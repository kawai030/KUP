// 워커 = 줄에서 잡을 꺼내 실제로 실행하는 일꾼 프로세스.
// 이 프로세스를 Ctrl+C 로 죽였다가 다시 켜는 것이 3단계 내구성 테스트의 핵심이다.
//
// 발행 로직은 아직 stub(콘솔 출력)이다. 나중에 이 자리에 Meta Graph API
// 2단계 발행(컨테이너 생성 → FINISHED 확인 → 게시)이 들어간다. (SPEC 2.3 / 3.5)
import { Worker } from "bullmq";
import { makeConnection, QUEUE_NAME, REDIS_URL } from "./connection.js";

console.log("──────────────────────────────────────────────");
console.log(`🛠  워커 시작됨  (PID ${process.pid})`);
console.log(`   Redis    : ${REDIS_URL}`);
console.log(`   큐 이름  : ${QUEUE_NAME}`);
console.log("   예약 잡을 기다리는 중... (Ctrl+C 로 종료)");
console.log("──────────────────────────────────────────────");

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const now = new Date();

    // cron(반복) 잡: 매일 04:00 인사이트 수집 (cron.js가 등록)
    if (job.name === "insights-collect") {
      console.log("");
      console.log("📈 [인사이트 수집 STUB] (cron 반복 실행)");
      console.log(`   잡 ID    : ${job.id}`);
      console.log(`   라벨     : ${job.data.label}`);
      console.log(`   실행시각 : ${now.toLocaleTimeString()}`);
      console.log("   → (실서비스라면 여기서 Graph API Insights 수집 → DB 스냅샷)");
      console.log("");
      return { collectedAt: now.toISOString() };
    }

    // delayed(1회 예약) 잡: 발행 (schedule.js가 등록)
    const scheduled = new Date(job.data.scheduledAtISO);
    const lateMs = now.getTime() - scheduled.getTime();

    // ↓↓↓ 여기가 실제 "발행"이 일어날 자리 (지금은 stub) ↓↓↓
    console.log("");
    console.log("📢 [발행 STUB 실행]");
    console.log(`   잡 ID    : ${job.id}`);
    console.log(`   라벨     : ${job.data.label}`);
    console.log(`   예정시각 : ${scheduled.toLocaleTimeString()}`);
    console.log(`   실제실행 : ${now.toLocaleTimeString()}`);
    console.log(`   오차     : ${(lateMs / 1000).toFixed(1)}초`);
    console.log("   → (실서비스라면 여기서 Meta Graph API로 게시)");
    console.log("");
    // ↑↑↑ stub 끝 ↑↑↑

    return { publishedAt: now.toISOString() };
  },
  { connection: makeConnection() }
);

worker.on("completed", (job) => {
  console.log(`✅ 잡 ${job.id} 완료`);
});

worker.on("failed", (job, err) => {
  console.log(`❌ 잡 ${job?.id} 실패: ${err.message}`);
});

// Ctrl+C 시 깔끔하게 종료 (진행 중인 잡을 마무리할 기회를 준다).
process.on("SIGINT", async () => {
  console.log("\n🛑 종료 신호 수신 — 워커 닫는 중...");
  await worker.close();
  process.exit(0);
});
