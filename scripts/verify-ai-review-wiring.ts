import "@/scripts/load-env"; // ⚠️ 최우선 — ANTHROPIC_API_KEY 로드
import { aiReviewFlags } from "@/lib/workspace/ai-review";
import { decideVerdict, VERDICT_META } from "@/lib/workspace/verdict";
import type { CardNews, SurveyProfile } from "@/lib/workspace/types";

/**
 * AI 검수 배선 검증 — HTTP/로그인 없이 route 가 쓰는 실제 경로만 태운다.
 *   카드 → aiReviewFlags(Claude+매핑) → decideVerdict(4단계 판정)
 *   npx tsx scripts/verify-ai-review-wiring.ts
 * aiReviewFlags 는 title/pages/caption/hashtags/cta 만 읽으므로 나머지 필드는 테스트용 최소값.
 */

function card(p: Partial<CardNews>): CardNews {
  return p as CardNews;
}
function survey(p: Partial<SurveyProfile>): SurveyProfile {
  return p as SurveyProfile;
}

const finance = card({
  title: "월 100 버는 배당주 3개",
  pages: [
    { index: 0, headline: "이건 절대 안 떨어져요", body: "지금 사두면 원금 보장에 확정 수익 나는 종목만 골랐어요." },
    { index: 1, headline: "삼성전자 지금 사라", body: "무조건 오릅니다. 이번 달 안에 10% 수익 보장." },
    { index: 2, headline: "마무리", body: "댓글에 '배당' 남기면 종목 리스트 드려요." },
  ],
  caption: "재테크 초보도 무조건 버는 법",
  hashtags: ["#재테크", "#수익보장"],
  cta: "댓글: 배당",
});
const financeSurvey = survey({ niche: "재테크", sensitiveDomain: "금융·투자·부동산", forbiddenExpressions: [] });

const baking = card({
  title: "노오븐 치즈케이크 3분 완성",
  pages: [
    { index: 0, headline: "재료", body: "크림치즈, 생크림, 설탕, 젤라틴만 있으면 돼요." },
    { index: 1, headline: "섞기", body: "다 넣고 젤라틴을 그대로 반죽에 넣어 섞어요." },
    { index: 2, headline: "굳히기", body: "냉장고에 3분만 넣으면 완성! 미슐랭 2스타 셰프도 인정한 레시피." },
  ],
  caption: "실패 없는 노오븐 치즈케이크",
  hashtags: ["#홈베이킹", "#치즈케이크"],
  cta: "댓글: 레시피",
});
const bakingSurvey = survey({ niche: "홈베이킹", sensitiveDomain: "없음", forbiddenExpressions: [] });

async function run(label: string, c: CardNews, s: SurveyProfile, expect: string) {
  const flags = await aiReviewFlags(c, s);
  const verdict = decideVerdict(flags);
  const m = VERDICT_META[verdict];
  console.log(`\n══════ ${label} ══════`);
  console.log(`판정: ${m.emoji} ${m.label} (${verdict})   [기대: ${expect}]`);
  console.log(`AI 플래그 ${flags.length}건:`);
  for (const f of flags) {
    const tier = f.mustPass && f.level === "fail" ? "⚫" : f.mustPass && f.level === "warn" ? "🔴" : "🟡";
    console.log(`  ${tier} [${f.axis}] ${f.message}`);
  }
}

async function main() {
  await run("재테크(원금·수익 보장)", finance, financeSurvey, "⚫ 차단");
  await run("홈베이킹(젤라틴 누락·과장)", baking, bakingSurvey, "🔴 경고 또는 🟡 검토");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
