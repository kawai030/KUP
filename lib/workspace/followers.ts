import { findIgAccount, type MetricEntry, type PublicUser } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// 팔로워 수 · 챌린지 계산 — 홈/인사이트가 같은 숫자를 쓰도록 하는 단일 출처(SoT).
//
// 정식 연동 계정은 "인스타에서 가져오기"(POST /api/metrics/sync)가 실제 팔로워를
// account.followers 에 저장한다. 그래서 실연동 값이 있으면 그걸 그대로 쓰고,
// 없으면(테스터·미연동) 설문 초기값 + 수동 입력한 순증(newFollowers)의 합으로 추정한다.
//   ※ sync 는 게시물 지표의 newFollowers 를 0 으로 저장(이중집계 방지) → 계정 팔로워는
//     오직 account.followers 로만 관리된다.
// ─────────────────────────────────────────────────────────────────────────────

// 현재 팔로워 수 — 두 화면 공통 계산.
export function resolveFollowerCount(user: PublicUser, metrics: MetricEntry[]): number {
  const account = findIgAccount(user);
  const hasRealFollowers = account?.mode === "정식" && typeof account.followers === "number";
  if (hasRealFollowers) return account!.followers!;
  const base = user.survey?.followers ?? 0;
  const gained = metrics.reduce((s, m) => s + m.newFollowers, 0);
  return base + gained;
}

// 팔로워 챌린지 파생값 — 다음 100단위 목표·1,000까지 남은 수·진행률.
export function followerChallenge(followers: number): {
  nextTarget: number;
  toThousand: number;
  roadmapPct: number;
} {
  return {
    nextTarget: Math.min(1000, Math.ceil((followers + 1) / 100) * 100),
    toThousand: Math.max(0, 1000 - followers),
    roadmapPct: Math.min(100, (followers / 1000) * 100),
  };
}
