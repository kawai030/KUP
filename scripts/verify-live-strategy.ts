import "@/scripts/load-env";
import { generateStrategy } from "@/lib/workspace/ai";
import type { SurveyProfile } from "@/lib/workspace/types";

/**
 * P2 전략 프롬프트 고도화 라이브 검증 (ai.ts generateStrategy 실함수).
 * 확인: ① 계정 컨셉 그라운딩(뻔한 템플릿 탈피) ② topics 개수 = recommendedCount(주간역량 연동)
 *       ③ goal 단계인식(초기=저장·팔로우·공유 위주) ④ 정직(지어낸 통계 없음)
 *   npx tsx scripts/verify-live-strategy.ts
 */
function survey(over: Partial<SurveyProfile>): SurveyProfile {
  return {
    niche: "라이프스타일", followers: 600, goals: ["브랜딩"], weeklyCapacity: 3,
    brandKeywords: ["큐레이션"],
    voiceExample: "다정한 존댓말(~예요/~해요)", forbiddenExpressions: [], captionLength: "보통",
    hashtagStyle: "주제 관련 위주", sensitiveDomain: "없음", ...over,
  };
}

const CASES: { label: string; survey: SurveyProfile }[] = [
  { label: "① 홈트 코치 · 초기(누적) · 주2회", survey: survey({ niche: "홈트레이닝", followers: 480, weeklyCapacity: 2, brandKeywords: ["홈트", "맨몸운동"], sensitiveDomain: "의료·건강·다이어트" }) },
  { label: "② 드라마 큐레이터 · 성장실험 · 주5회", survey: survey({ niche: "드라마·영화 큐레이션", followers: 2200, weeklyCapacity: 5, goals: ["브랜딩", "협찬"], brandKeywords: ["넷플릭스추천", "정주행"] }) },
  { label: "③ 수제청 공방 · 수익화준비 · 주4회(문의목적)", survey: survey({ niche: "수제청·홈카페 공방", followers: 3400, weeklyCapacity: 4, goals: ["매출", "문의"], brandKeywords: ["수제청", "클래스"] }) },
];

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) { console.error("❌ ANTHROPIC_API_KEY 없음"); process.exit(1); }
  for (const c of CASES) {
    const s = await generateStrategy(c.survey, c.survey.followers);
    console.log(`\n${"═".repeat(72)}\n▌ ${c.label}  [generatedBy=${s.generatedBy}]`);
    console.log(`${"═".repeat(72)}`);
    console.log(`단계: ${s.stage} · recommendedCount: ${s.recommendedCount} · topics 개수: ${s.topics.length}  ${s.topics.length === s.recommendedCount ? "✅ 일치" : "⚠️ 불일치"}`);
    console.log(`진단: ${s.diagnosis}`);
    console.log(`주간목표: ${s.weeklyGoal}`);
    console.log(`focus: ${s.focus.join(" · ")}`);
    s.topics.forEach((t, i) => {
      console.log(`  ${i + 1}. [${t.goal}] ${t.title}`);
      console.log(`     후킹: ${t.hookDirection}`);
      console.log(`     why: ${t.why}`);
    });
    const goals = s.topics.map((t) => t.goal);
    console.log(`  → goal 분포: ${goals.join(", ")}`);
  }
}
main().catch((e) => { console.error("❌", e instanceof Error ? e.message : e); process.exit(1); });
