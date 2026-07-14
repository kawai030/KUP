import type { CardNews, ReviewFlag, SensitiveDomain, SurveyProfile } from "./types";
import { uid } from "./db";
import { decideVerdict, verdictGate } from "./verdict";

// ─────────────────────────────────────────────────────────────────────────────
// §10 검수 · 컴플라이언스
//  - 10-1 검수 게이트: 발행 전 자동 플래그(민감표현·표기누락·미검증주장)
//  - 10-2 민감 도메인 룰셋: 권유/강요/단정/보장 표현 제거 + 면책 고지 유도
//  - 10-3 4단계 판정(verdict.ts): 각 플래그에 축·필수통과·level(fail/warn)을 달아
//         차단(명백 위법) / 경고(회색지대) / 검토(품질) 를 구분한다.
//    · hard = 검증 가능한 사실·효과·수익을 단정·보장 → level "fail" → ⚫ 차단
//    · soft = 권유·과장 등 회색지대 → level "warn" → 🔴 경고(책임 동의 후 발행)
// ─────────────────────────────────────────────────────────────────────────────

interface DomainRule {
  hard: RegExp[]; // 명백 위법(단정·보장) → 차단
  soft: RegExp[]; // 회색지대(권유·과장) → 경고
  guide: string;
}

const DOMAIN_RULES: Record<Exclude<SensitiveDomain, "없음">, DomainRule> = {
  "금융·투자·부동산": {
    // 자본시장법: 손실보전·수익보장 약속은 명백 금지
    hard: [/보장\s*(수익|수익률)/, /확정\s*수익/, /원금\s*보장/],
    // 투자 권유·단정(회색지대)
    soft: [/지금\s*(사라|들어가|매수)/, /무조건\s*(오른다|상승|간다)/, /추천\s*종목/],
    guide: "정보 제공·일반 교육형으로 바꾸고( “일반적으로 ~한 구조다” ), 투자 책임·면책 고지를 덧붙이세요.",
  },
  "의료·건강·다이어트": {
    // 의료법·건강기능식품법: 질병 치료·완치·부작용 없음 표방은 명백 금지
    hard: [/(먹으면|바르면)\s*(낫는다|치료|완치)/, /100%\s*(효과|완치)/, /부작용\s*(없|전혀)/],
    soft: [/반드시\s*효과/, /병원\s*안\s*가도/],
    guide: "효능 단정·치료 권유를 피하고, “개인차가 있으며 전문가 상담을 권장” 고지를 추가하세요.",
  },
  "법률·세무": {
    hard: [/절대\s*(걸리지|문제없)/],
    soft: [/이렇게\s*하면\s*무조건/, /확실히\s*(면제|환급)/],
    guide: "단정적 조언을 일반 정보로 완화하고, 전문가 확인 안내를 덧붙이세요.",
  },
  "기타 규제": {
    hard: [],
    soft: [/무조건/, /보장/, /100%/],
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

  // 1) 민감 도메인 룰셋 — hard(차단)/soft(경고)로 분리 태깅
  const domain = survey?.sensitiveDomain ?? "없음";
  if (domain !== "없음") {
    const rule = DOMAIN_RULES[domain];
    const scan = (patterns: RegExp[], level: "fail" | "warn") => {
      for (const re of patterns) {
        const m = text.match(re);
        if (m) {
          flags.push({
            id: uid("flag"),
            type: "민감표현",
            severity: level === "fail" ? "high" : "medium",
            message:
              level === "fail"
                ? `규제·민감 영역(${domain})에서 법령 위반 소지가 뚜렷한 단정·보장 표현이 감지됐어요. ${rule.guide}`
                : `규제·민감 영역(${domain}) 회색지대(권유·과장) 표현이 감지됐어요. ${rule.guide}`,
            excerpt: m[0],
            resolved: false,
            axis: "규제 안전성",
            mustPass: true,
            level,
          });
        }
      }
    };
    scan(rule.hard, "fail");
    scan(rule.soft, "warn");
  }

  // 2) 협찬/광고 표기 누락 → 규제(표시광고법), 회색지대(표기 추가로 해소 가능) = 경고
  if (SPONSOR_CONTEXT.test(text) && !SPONSOR_DISCLOSURE.test(text)) {
    flags.push({
      id: uid("flag"),
      type: "표기누락",
      severity: "high",
      message: "협찬/광고 맥락인데 ‘#광고’·‘유료 광고’ 등 표기가 없어요. 표기를 추가하면 해소돼요.",
      resolved: false,
      axis: "규제 안전성",
      mustPass: true,
      level: "warn",
    });
  }

  // 3) 사용자 금지 표현(설문 §4-A) → 요청 준수(가중) = 검토
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
        axis: "요청 준수",
        mustPass: false,
        level: "warn",
      });
    }
  }

  // 4) 미검증·과장 주장 → 사실 정확성(가중, 최상급은 품질 주의) = 검토
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
        axis: "사실 정확성",
        mustPass: false,
        level: "warn",
      });
    }
  }

  // 5) 출처 확인 — 판정을 내리지 않는 확인 항목(휴먼인더루프 체크리스트)
  flags.push({
    id: uid("flag"),
    type: "출처확인",
    severity: "low",
    message: "수치·인용·사실 주장의 출처를 확인했나요? 확인했으면 체크해 주세요.",
    resolved: false,
    axis: "확인 항목",
    mustPass: false,
  });

  return flags;
}

// 발행 게이트: 4단계 판정 + 책임 동의(consent) 기준.
//  - ⚫ 차단: 항상 불가   - 🔴 경고: consent 필요   - 🟡/🟢: 발행 가능
export function reviewGate(card: CardNews, consent: boolean): { ok: boolean; reason?: string } {
  if (card.status === "업로드완료") return { ok: true };
  return verdictGate(decideVerdict(card.reviewFlags), consent);
}

// (하위호환) 단순 발행 가능 여부 — 경고는 미동의 상태 기준으로 불가 처리
export function canPublish(card: CardNews): boolean {
  return reviewGate(card, false).ok;
}
