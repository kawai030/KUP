// ─────────────────────────────────────────────────────────────────────────────
// §10-3 검수 판정 (4단계 신호등) — 순수 함수. 서버(route)·클라이언트(에디터) 공용.
//   여기엔 서버 전용 import(db/fs)를 두지 않는다 → "use client" 컴포넌트에서도 안전.
//   플래그 → 판정 규칙:
//     ⚫ 차단(black)  : 필수통과 축(규제·사실) 중 level="fail" = 명백 위법 → 발행 불가
//     🔴 경고(red)   : 필수통과 축 중 level="warn" = 회색지대 → 책임 동의 후 발행
//     🟡 검토(yellow): 그 외 감지 항목(가중 축) → 그대로 발행 자유
//     🟢 통과(green) : 감지 항목 없음(확인 항목만)
//   "확인 항목"(출처확인 등)은 판정을 내리지 않는 체크리스트 → 색을 낮추지 않는다.
// ─────────────────────────────────────────────────────────────────────────────

import type { ReviewFlag } from "./types";

export type Verdict = "green" | "yellow" | "red" | "black";

export interface VerdictMeta {
  emoji: string;
  label: string;
  /** 신호 색 (프로토타입 기준) */
  color: string;
  /** 카드 배경/테두리 연한 톤 */
  soft: string;
  desc: string;
}

export const VERDICT_META: Record<Verdict, VerdictMeta> = {
  green: {
    emoji: "🟢",
    label: "통과 가능",
    color: "#2E9E5B",
    soft: "#EAF6EF",
    desc: "규제·사실 관련 위험이 감지되지 않았어요. 바로 발행할 수 있어요.",
  },
  yellow: {
    emoji: "🟡",
    label: "검토 권장",
    color: "#B98900",
    soft: "#FBF3DE",
    desc: "발행을 막는 문제는 아니에요. 아래 항목을 한 번 살펴보면 품질이 올라가요. 그대로 발행할 수 있어요.",
  },
  red: {
    emoji: "🔴",
    label: "경고",
    color: "#C0392B",
    soft: "#FBE9E7",
    desc: "규제·사실 관련 회색지대 표현이 있어요. 최종 책임이 본인에게 있음에 동의하면 발행할 수 있어요.",
  },
  black: {
    emoji: "⚫",
    label: "차단",
    color: "#3A3A3A",
    soft: "#ECECEC",
    desc: "법령 위반 소지가 뚜렷한 표현이 있어 발행할 수 없어요. 아래 표현을 수정한 뒤 다시 검수해 주세요.",
  },
};

/** 판정 대상이 아닌 축(순수 체크리스트) */
export function isChecklist(flag: ReviewFlag): boolean {
  return flag.axis === "확인 항목";
}

/** 플래그 배열 → 4단계 판정 */
export function decideVerdict(flags: ReviewFlag[]): Verdict {
  const issues = flags.filter((f) => !isChecklist(f));
  if (issues.some((f) => f.mustPass && f.level === "fail")) return "black";
  if (issues.some((f) => f.mustPass && f.level === "warn")) return "red";
  if (issues.length > 0) return "yellow";
  return "green";
}

/** 발행 게이트: consent=책임 동의 여부 */
export function verdictGate(
  verdict: Verdict,
  consent: boolean
): { ok: boolean; reason?: string } {
  if (verdict === "black")
    return { ok: false, reason: "법령 위반 소지가 있어 발행할 수 없어요. 표현을 수정한 뒤 다시 검수해 주세요." };
  if (verdict === "red" && !consent)
    return { ok: false, reason: "경고 항목에 대한 ‘책임 동의’ 체크가 필요해요." };
  return { ok: true };
}

/** 경고/차단의 근거를 사용자에게 보여줄 법적 설명 (토글용) */
export const LEGAL_BASIS_NOTE =
  "이 판정은 특정 표현이 국내 법령(표시·광고의 공정화에 관한 법률, 의료법, 자본시장법 등)이나 " +
  "인스타그램이 실제로 제재하는 해악(사기·허위·과장 보장)에 저촉될 소지가 있을 때 표시돼요. " +
  "‘무조건 가야 해요’ 같은 주관적 추천은 규제 대상이 아니며, 검증 가능한 사실·효과·수익을 " +
  "단정·보장하는 표현만 경고·차단해요. 최종 판단과 책임은 발행자 본인에게 있어요.";
