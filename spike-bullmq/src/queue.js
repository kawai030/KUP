// 예약 잡이 줄 서는 "큐" 객체. 잡을 넣을 때(schedule.js)도, 현황을 볼 때(status.js)도 이걸 쓴다.
import { Queue } from "bullmq";
import { makeConnection, QUEUE_NAME } from "./connection.js";

export const publishQueue = new Queue(QUEUE_NAME, {
  connection: makeConnection(),
});
