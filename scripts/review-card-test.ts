import "@/scripts/load-env"; // ⚠️ 최우선 — ANTHROPIC_API_KEY 등 process.env 채움
import { reviewCard, type CardReviewInput, type CardReviewReport } from "@/lib/llm/card-review";

/**
 * AI 카드 검수기 단독 테스트 — 라이브 화면 없이 lib/llm/card-review 만 돌려본다.
 * 일부러 문제를 심은 샘플로 "AI가 의미 기반 문제를 잡는가"를 눈으로 확인한다.
 *
 *   npx tsx scripts/review-card-test.ts
 *
 * (ANTHROPIC_API_KEY 없으면 available:false 로 나옴 — 그게 정상 폴백 동작.)
 */

// 샘플 ①: 재테크 — 투자 수익/원금 보장 = regulatory 명백 위반(자본시장법) 기대
const financeCard: CardReviewInput = {
  title: "월 100 버는 배당주 3개",
  niche: "재테크",
  sensitiveDomain: "금융·투자·부동산",
  pages: [
    { headline: "이건 절대 안 떨어져요", body: "지금 사두면 원금 보장에 확정 수익 나는 종목만 골랐어요." },
    { headline: "삼성전자 지금 사라", body: "무조건 오릅니다. 이번 달 안에 10% 수익 보장." },
    { headline: "마무리", body: "댓글에 '배당' 남기면 종목 리스트 드려요." },
  ],
  caption: "재테크 초보도 무조건 버는 법",
  hashtags: ["#재테크", "#주식", "#배당주", "#수익보장", "#투자"],
  cta: "댓글: 배당",
};

// 샘플 ②: 홈베이킹 — 지어낸 사실 + 초보가 그대로 따라 하면 실패할 준비단계 누락 = factuality 기대
const bakingCard: CardReviewInput = {
  title: "노오븐 치즈케이크 3분 완성",
  niche: "홈베이킹",
  sensitiveDomain: "없음",
  pages: [
    { headline: "재료 준비", body: "크림치즈, 생크림, 설탕, 젤라틴만 있으면 돼요." },
    { headline: "섞기", body: "다 넣고 젤라틴을 그대로 반죽에 넣어 섞어요." },
    { headline: "굳히기", body: "냉장고에 3분만 넣으면 완성! 미슐랭 2스타 셰프도 인정한 레시피예요." },
  ],
  caption: "실패 없는 노오븐 치즈케이크",
  hashtags: ["#홈베이킹", "#치즈케이크", "#노오븐", "#디저트", "#베이킹"],
  cta: "댓글: 레시피",
};

function printReport(label: string, r: CardReviewReport) {
  console.log(`\n══════ ${label} ══════`);
  console.log(`AI 실행됨: ${r.available ? "예" : "아니오(키 없음/실패 → 폴백)"}`);
  if (!r.available) return;
  console.log(`분야 판정: ${r.domain}`);
  console.log("― 7축 ―");
  for (const [axis, v] of Object.entries(r.axes)) {
    const mark = v.status === "fail" ? "✗" : v.status === "warn" ? "⚠" : "✓";
    console.log(`  ${mark} ${axis.padEnd(13)} ${v.status}${v.note ? ` — ${v.note}` : ""}`);
  }
  console.log(`― 플래그 ${r.flags.length}건 ―`);
  for (const f of r.flags) {
    console.log(`  [${f.severity === "block" ? "차단" : "경고"}·${f.slide || "-"}·${f.axis}] ${f.issue}`);
    if (f.suggestion) console.log(`      → ${f.suggestion}`);
  }
}

async function main() {
  printReport("샘플① 재테크(regulatory 기대)", await reviewCard(financeCard));
  printReport("샘플② 홈베이킹(factuality 기대)", await reviewCard(bakingCard));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
