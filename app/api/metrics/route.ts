import { readDB } from "@/lib/workspace/db";
import { json, withUser } from "@/lib/workspace/api";

// 인사이트 조회(읽기 전용). 수집은 자동(/api/metrics/sync)만 사용 — 수동 입력은 폐지.
export async function GET() {
  const guard = await withUser();
  if ("res" in guard) return guard.res;
  const entries = (await readDB())
    .metrics.filter((m) => m.userId === guard.user.id)
    .sort((a, b) => b.createdAt - a.createdAt);
  return json({ entries });
}
