import { NextResponse } from "next/server";

// 헬스체크 — 배포 후 프론트+API 살아있는지 확인용. (워커 헬스는 별도)
export function GET() {
  return NextResponse.json({ ok: true, service: "kup-web" });
}
