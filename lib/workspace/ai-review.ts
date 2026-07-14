import type { CardNews, ReviewAxis, ReviewFlag, SurveyProfile } from "./types";
import { uid } from "./db";
import { reviewCard, type CardFinding, type CardReviewInput } from "@/lib/llm/card-review";

// ─────────────────────────────────────────────────────────────────────────────
// §10 검수 — AI 계층. 정규식 컴플라이언스(compliance.runReview) 위에 얹는 "의미 기반" 검수.
//   lib/llm/card-review(독립 코어)를 호출해 7축 판단을 받고, 워크스페이스 4단계 판정 체계의
//   ReviewFlag(axis·mustPass·level)로 변환한다. verdict.decideVerdict 가 그대로 소비한다.
//
//   판정 매핑(⚫차단은 "법령 위반"에만 한정 — AI 오판이 발행을 하드블록하지 않게):
//     regulatory + block → mustPass·fail → ⚫ 차단
//     regulatory + warn  → mustPass·warn → 🔴 경고
//     factuality + block → mustPass·warn → 🔴 경고 (사실 오류는 강한 경고, 법령 아님 → 차단 X)
//     그 외(사실 경미·톤·요청·완전성·형식·UX) → 가중 → 🟡 검토
//
//   키 없음/호출 실패 시 reviewCard 가 available:false → 여기서 빈 배열 반환 → 라이브는
//   정규식 검수만으로 그대로 진행(흐름 안 깨짐).
// ─────────────────────────────────────────────────────────────────────────────

// AI 7축(card-review) → 워크스페이스 5축(ReviewAxis)
const AXIS_MAP: Record<string, ReviewAxis> = {
  regulatory: "규제 안전성",
  factuality: "사실 정확성",
  request: "요청 준수",
  tone: "요청 준수",
  format: "표기·형식",
  completeness: "표기·형식",
  ux: "표기·형식",
};

function toFlag(f: CardFinding): ReviewFlag {
  const axis: ReviewAxis = AXIS_MAP[f.axis] ?? "요청 준수";

  let mustPass = false;
  let level: "fail" | "warn" | undefined;
  let severity: ReviewFlag["severity"] = "low";

  if (f.axis === "regulatory") {
    mustPass = true;
    if (f.severity === "block") {
      level = "fail"; // → ⚫ 차단
      severity = "high";
    } else {
      level = "warn"; // → 🔴 경고
      severity = "medium";
    }
  } else if (f.axis === "factuality" && f.severity === "block") {
    mustPass = true;
    level = "warn"; // 사실 오류(명백)도 최대 🔴 경고 — 법령 아님이라 차단은 안 함
    severity = "high";
  } else {
    // factuality 경미 + 톤·요청·완전성·형식·UX → 가중(🟡 검토)
    mustPass = false;
    severity = f.severity === "block" ? "medium" : "low";
  }

  const where = f.slide ? `[${f.slide}] ` : "";
  const message = `AI 검수: ${where}${f.issue}${f.suggestion ? ` → ${f.suggestion}` : ""}`;

  return {
    id: uid("aiflag"),
    type: f.axis === "regulatory" ? "민감표현" : "미검증주장",
    severity,
    message,
    resolved: false,
    axis,
    mustPass,
    level,
  };
}

/**
 * 카드를 AI로 검수해 ReviewFlag 목록을 돌려준다. 키 없음/실패 시 [] (정규식 검수만으로 진행).
 * 라우트에서 runReview(정규식) 결과와 병합해 card.reviewFlags 로 저장한다.
 */
export async function aiReviewFlags(
  card: CardNews,
  survey: SurveyProfile | undefined,
): Promise<ReviewFlag[]> {
  const input: CardReviewInput = {
    title: card.title,
    pages: card.pages.map((p) => ({ headline: p.headline, body: p.body })),
    caption: card.caption,
    hashtags: card.hashtags,
    cta: card.cta,
    niche: survey?.niche,
    sensitiveDomain: survey?.sensitiveDomain,
    forbiddenExpressions: survey?.forbiddenExpressions,
  };

  const report = await reviewCard(input);
  if (!report.available) return [];
  return report.flags.map(toFlag);
}
