import type { CardNews, ReviewFlag, SensitiveDomain, SurveyProfile } from "./types";
import { uid } from "./db";

// ─────────────────────────────────────────────────────────────────────────────
// §10 검수 · 컴플라이언스
//  - 10-1 검수 게이트: 발행 전 자동 플래그(민감표현·표기누락·미검증주장)
//  - 10-2 민감 도메인 룰셋: 권유/강요/단정/보장 표현 제거 + 면책 고지 유도
// ─────────────────────────────────────────────────────────────────────────────

interface DomainRule {
  patterns: RegExp[];
  guide: string;
}

const DOMAIN_RULES: Record<Exclude<SensitiveDomain, "없음">, DomainRule> = {
  "금융·투자·부동산": {
    patterns: [
      /지금\s*(사라|들어가|매수)/,
      /무조건\s*(오른다|상승|간다)/,
      /보장\s*(수익|수익률)/,
      /확정\s*수익/,
      /추천\s*종목/,
      /원금\s*보장/,
    ],
    guide: "정보 제공·일반 교육형으로 바꾸고( “일반적으로 ~한 구조다” ), 투자 책임·면책 고지를 덧붙이세요.",
  },
  "의료·건강·다이어트": {
    patterns: [
      /(먹으면|바르면)\s*(낫는다|치료|완치)/,
      /반드시\s*효과/,
      /병원\s*안\s*가도/,
      /부작용\s*(없|전혀)/,
      /100%\s*(효과|완치)/,
    ],
    guide: "효능 단정·치료 권유를 피하고, “개인차가 있으며 전문가 상담을 권장” 고지를 추가하세요.",
  },
  "법률·세무": {
    patterns: [/이렇게\s*하면\s*무조건/, /절대\s*(걸리지|문제없)/, /확실히\s*(면제|환급)/],
    guide: "단정적 조언을 일반 정보로 완화하고, 전문가 확인 안내를 덧붙이세요.",
  },
  "기타 규제": {
    patterns: [/무조건/, /보장/, /100%/],
    guide: "단정·보장 표현을 줄이고 일반 정보 + 확인 안내로 표현하세요.",
  },
};

// 협찬/광고 표기 누락 점검 — 협찬·증정·체험 맥락인데 표기가 없으면 플래그
const SPONSOR_CONTEXT = /(협찬|증정|제공받|체험단|광고|유료광고)/;
const SPONSOR_DISCLOSURE = /(#?광고|#?협찬|유료\s*광고|광고\s*포함|AD\b)/i;

// 미검증/과장 주장 — 출처 없는 단정형 수치/최상급
const UNVERIFIED = [/검증된/, /과학적으로\s*증명/, /업계\s*1위/, /최고의/, /유일한/];

function gatherText(card: CardNews): string {
  const pageText = card.pages.map((p) => `${p.headline} ${p.body}`).join(" ");
  return [card.title, card.keyMessage, pageText, card.caption, card.cta].join(" ");
}

export function runReview(card: CardNews, survey: SurveyProfile | undefined): ReviewFlag[] {
  const text = gatherText(card);
  const flags: ReviewFlag[] = [];

  // 1) 민감 도메인 룰셋
  const domain = survey?.sensitiveDomain ?? "없음";
  if (domain !== "없음") {
    const rule = DOMAIN_RULES[domain];
    for (const re of rule.patterns) {
      const m = text.match(re);
      if (m) {
        flags.push({
          id: uid("flag"),
          type: "민감표현",
          severity: "high",
          message: `규제·민감 영역(${domain}) 금지/주의 표현이 감지됐어요. ${rule.guide}`,
          excerpt: m[0],
          resolved: false,
        });
      }
    }
  }

  // 2) 협찬/광고 표기 누락
  if (SPONSOR_CONTEXT.test(text) && !SPONSOR_DISCLOSURE.test(text)) {
    flags.push({
      id: uid("flag"),
      type: "표기누락",
      severity: "high",
      message: "협찬/광고 맥락인데 ‘#광고’·‘유료 광고’ 등 표기가 없어요. 표기를 추가하세요.",
      resolved: false,
    });
  }

  // 3) 사용자 금지 표현(설문 §4-A)
  for (const word of survey?.forbiddenExpressions ?? []) {
    const trimmed = word.trim();
    if (trimmed && text.includes(trimmed)) {
      flags.push({
        id: uid("flag"),
        type: "민감표현",
        severity: "medium",
        message: `설문에서 지정한 금지 표현 “${trimmed}” 이(가) 포함됐어요.`,
        excerpt: trimmed,
        resolved: false,
      });
    }
  }

  // 4) 미검증·과장 주장
  for (const re of UNVERIFIED) {
    const m = text.match(re);
    if (m) {
      flags.push({
        id: uid("flag"),
        type: "미검증주장",
        severity: "low",
        message: "근거 없는 단정/최상급 표현일 수 있어요. 사실 근거를 덧붙이거나 표현을 완화하세요.",
        excerpt: m[0],
        resolved: false,
      });
    }
  }

  // 5) 출처 확인 — 휴먼인더루프 필수 체크 (사용자가 직접 확인)
  flags.push({
    id: uid("flag"),
    type: "출처확인",
    severity: "low",
    message: "수치·인용·사실 주장의 출처를 확인했나요? 확인했으면 체크해 주세요.",
    resolved: false,
  });

  return flags;
}

// 발행 가능 여부: 미해결 플래그가 하나라도 있으면 게이트 차단
export function canPublish(card: CardNews): boolean {
  if (card.status === "업로드완료") return true;
  return card.reviewFlags.every((f) => f.resolved);
}
