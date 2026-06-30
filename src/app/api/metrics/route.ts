import { mutateDB, readDB, uid } from "@/lib/db";
import { bad, json, withUser } from "@/lib/api";
import type { MetricEntry } from "@/lib/types";

export async function GET() {
  const guard = await withUser();
  if ("res" in guard) return guard.res;
  const entries = readDB()
    .metrics.filter((m) => m.userId === guard.user.id)
    .sort((a, b) => b.createdAt - a.createdAt);
  return json({ entries });
}

// 인사이트 수동 입력 (초기 수동 입력 허용). P1: Meta Graph insights 자동 수집.
export async function POST(req: Request) {
  const guard = await withUser();
  if ("res" in guard) return guard.res;
  const b = (await req.json().catch(() => null)) as Partial<MetricEntry> | null;
  if (!b) return bad("잘못된 요청입니다.");

  const entry: MetricEntry = {
    id: uid("metric"),
    userId: guard.user.id,
    cardId: b.cardId,
    date: b.date || new Date().toISOString().slice(0, 10),
    views: Number(b.views) || 0,
    reach: Number(b.reach) || 0,
    saves: Number(b.saves) || 0,
    shares: Number(b.shares) || 0,
    likes: Number(b.likes) || 0,
    comments: Number(b.comments) || 0,
    profileVisits: Number(b.profileVisits) || 0,
    follows: Number(b.follows) || 0,
    newFollowers: Number(b.newFollowers) || 0,
    createdAt: Date.now(),
  };
  mutateDB((db) => db.metrics.push(entry));
  return json({ entry });
}
