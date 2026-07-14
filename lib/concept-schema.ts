import { z } from "zod";

/**
 * Concept 데이터 계약 — 생성파이프라인 §1.1 과 1:1.
 * 채널이 1회 잠그는 불변 정체성(persona·tone·pillars)이자 모든 생성 호출의
 * 시스템 프롬프트(= 프롬프트 캐싱 앵커)다. visual은 생성과 무관, 렌더 단계 입력.
 * examples/concepts/*.json 형태와 동일 → 그대로 로드해 검증 가능.
 * 저장 위치(Task 6): `channel_configs`(persona/tone/pillars/cadence) + `channels`.
 */

export const visualSchema = z.object({
  primary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  // primary2 미지정 시 render에서 primary로 폴백(deck-renderer 동작과 동일)
  primary2: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  light: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  font: z.string().min(1),
});
export type Visual = z.infer<typeof visualSchema>;

export const conceptSchema = z.object({
  id: z.string().min(1), // 채널 식별 = deck.conceptId 로 연결
  account: z.string().min(1), // 표시용 핸들 (예 "@home_baking_101")
  persona: z.string().min(1), // 1문장 페르소나
  tone: z.string().min(1), // 1문장 카피 스타일 제약
  pillars: z.array(z.string().min(1)).min(3).max(5), // 콘텐츠 기둥(주제는 이 안에서만)
  cadence: z.string().min(1), // 발행 주기 (예 "주 2회")
  visual: visualSchema, // 렌더 브랜드(생성 무관)
});

export type Concept = z.infer<typeof conceptSchema>;
