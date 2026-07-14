import type { Concept } from "@/lib/concept-schema";

/**
 * LLM 어댑터 계약 — 생성 파이프라인이 공급자와 대화하는 유일한 통로.
 * 실 공급자(Anthropic/OpenAI/Google)와 mock 이 같은 인터페이스를 구현 → 키 없이도
 * 파이프라인 전체를 끝까지 돌려보고, 키가 들어오면 공급자만 교체(Task 4).
 */

export type Stage = "topic" | "strategy" | "copy" | "review";

/** 응답의 실제 usage(실비 계산·벤치 계측용). mock 은 길이 기반 추정치. */
export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
};

export type SlidePlanItem = {
  kind: "cover" | "body" | "outro";
  purpose: string;
};

export type StrategyResult = {
  strategy: string;
  hook: string;
  slidePlan: SlidePlanItem[];
  leadKeyword: string;
};

/**
 * 단계 호출에 함께 넘기는 구조화 컨텍스트.
 * 실 공급자는 system/user 프롬프트만 사용하고 meta 는 무시한다.
 * mock 은 meta 로 결정적(deterministic) 출력을 만든다.
 */
export type StageMeta = {
  concept: Concept;
  topic?: string;
  strategy?: StrategyResult;
  /** copy 단계가 만든 deck draft(JSON 문자열) — review 단계 입력. */
  deckDraftJson?: string;
};

export type LlmCall = {
  stage: Stage;
  system: string;
  user: string;
  meta: StageMeta;
};

export type LlmResult = {
  /** 항상 JSON 문자열(스키마는 단계별로 파이프라인이 Zod 검증). */
  text: string;
  usage: TokenUsage;
};

export interface LlmProvider {
  readonly name: string;
  complete(call: LlmCall): Promise<LlmResult>;
}
