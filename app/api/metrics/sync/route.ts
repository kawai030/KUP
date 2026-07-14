import { mutateDB, uid } from "@/lib/workspace/db";
import { bad, json, withUser } from "@/lib/workspace/api";
import { fetchAccountFollowers, fetchRecentMediaInsights } from "@/lib/workspace/ig";
import { findIgAccount, isLiveAccount, type MetricEntry } from "@/lib/workspace/types";

// 인사이트 자동수집 — 활성 계정의 팔로워 + 최근 게시물 지표를 Graph API 로 가져와
// metrics 에 upsert(같은 미디어+같은 날짜는 갱신). 테스터(시뮬) 계정은 수집 불가.
export async function POST() {
  const guard = await withUser();
  if ("res" in guard) return guard.res;

  const account = findIgAccount(guard.user);
  if (!account) return bad("연동된 인스타 계정이 없어요. 먼저 계정을 연동해 주세요.", 409);
  if (!isLiveAccount(account)) return bad("자동 수집은 정식 연동(실연동) 계정에서만 가능해요. 테스터 계정은 수동 입력을 사용하세요.", 409);

  let followers = 0;
  let insights;
  try {
    [followers, insights] = await Promise.all([
      fetchAccountFollowers(account),
      fetchRecentMediaInsights(account, 25),
    ]);
  } catch (e) {
    return bad(`인스타에서 데이터를 가져오지 못했어요: ${(e as Error).message}`, 502);
  }

  const today = new Date().toISOString().slice(0, 10);

  const result = await mutateDB((db) => {
    // 우리 발행 기록의 permalink → cardId 매핑(게시물-카드 연결)
    const permalinkToCard = new Map<string, string>();
    for (const j of db.publishJobs) {
      if (j.userId === guard.user.id && j.igPermalink) permalinkToCard.set(j.igPermalink, j.cardId);
    }

    // 계정 팔로워 수 반영(실연동 값)
    const u = db.users.find((x) => x.id === guard.user.id);
    const acc = u?.igAccounts.find((a) => a.id === account.id);
    if (acc) acc.followers = followers;

    let synced = 0;
    for (const ins of insights!) {
      const cardId = ins.permalink ? permalinkToCard.get(ins.permalink) : undefined;
      const fields = {
        cardId,
        source: "instagram" as const,
        views: ins.views, reach: ins.reach, saves: ins.saves, shares: ins.shares,
        likes: ins.likes, comments: ins.comments, profileVisits: ins.profileVisits, follows: ins.follows,
        newFollowers: 0, // 계정 팔로워는 account.followers 로 관리(이중집계 방지)
      };
      const existing = db.metrics.find(
        (m) => m.userId === guard.user.id && m.mediaId === ins.mediaId && m.date === today
      );
      if (existing) {
        Object.assign(existing, fields);
      } else {
        const entry: MetricEntry = {
          id: uid("metric"),
          userId: guard.user.id,
          mediaId: ins.mediaId,
          date: today,
          createdAt: Date.now(),
          ...fields,
        };
        db.metrics.push(entry);
      }
      synced++;
    }

    const entries = db.metrics
      .filter((m) => m.userId === guard.user.id)
      .sort((a, b) => b.createdAt - a.createdAt);
    return { synced, followers, entries };
  });

  return json(result);
}
