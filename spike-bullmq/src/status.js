// 큐 현황을 눈으로 본다 = "예약이 Redis에 살아있는지" 확인하는 도구.
// 워커를 꺼둔 채 이걸 실행하면, delayed(대기 중 예약) 숫자가 그대로 남아있는 걸 볼 수 있다.
//   npm run status
import { publishQueue } from "./queue.js";

const counts = await publishQueue.getJobCounts(
  "waiting",
  "delayed",
  "active",
  "completed",
  "failed"
);

console.log("──────────────────────────────────────────────");
console.log("📊 큐 현황");
console.log(`   delayed   (예약 대기) : ${counts.delayed}`);
console.log(`   waiting   (실행 대기) : ${counts.waiting}`);
console.log(`   active    (실행 중)   : ${counts.active}`);
console.log(`   completed (완료)      : ${counts.completed}`);
console.log(`   failed    (실패)      : ${counts.failed}`);
console.log("──────────────────────────────────────────────");

// 예약 대기 중인 잡들의 실행 예정 시각도 보여준다.
const delayed = await publishQueue.getJobs(["delayed"]);
if (delayed.length) {
  console.log("⏳ 예약/대기 중인 잡:");
  for (const job of delayed) {
    const when = job.data?.scheduledAtISO
      ? new Date(job.data.scheduledAtISO).toLocaleTimeString()
      : "(반복 다음 회차)";
    console.log(`   - ${job.id} | ${job.name} | ${job.data?.label ?? ""} | ${when}`);
  }
  console.log("──────────────────────────────────────────────");
}

// 등록된 cron(반복) 스케줄러도 보여준다.
const schedulers = await publishQueue.getJobSchedulers();
if (schedulers.length) {
  console.log("🔁 cron 스케줄러:");
  for (const s of schedulers) {
    const next = s.next ? new Date(s.next).toLocaleTimeString() : "?";
    console.log(`   - ${s.key} | 패턴 ${s.pattern ?? s.every} | 다음 ${next}`);
  }
  console.log("──────────────────────────────────────────────");
}

await publishQueue.close();
process.exit(0);
