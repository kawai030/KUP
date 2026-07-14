import { z } from "zod";
import type { Concept } from "@/lib/concept-schema";
import { deckSchema, type Deck } from "@/lib/deck-schema";
import { getProvider } from "@/lib/llm";
import type { LlmCall, LlmProvider, TokenUsage } from "@/lib/llm/types";
import {
  copyUserPrompt,
  reviewUserPrompt,
  strategyUserPrompt,
  systemPrompt,
  topicUserPrompt,
} from "@/lib/generate/prompts";

/**
 * generateDeck() — 컨셉 → (LLM) → 검수 가능한 deck. 생성파이프라인 §6 구현.
 *   ① 주제(미지정 시) → ② 전략 → ③ 카피(deck draft) → ④ 자가점검(병합)
 * 각 단계 출력은 Zod 검증, 실패 시 1회 repair 재생성(설계 §4·프롬프트 §5).
 * 같은 함수로 mock/실 공급자를 돌리므로 usage·timings 가 그대로 벤치 계측이 된다(Task 4).
 */

// ── 단계별 출력 스키마 (deck 외 중간 산출) ─────────────────────────────
const topicsResultSchema = z.object({
  topics: z
    .array(z.object({ title: z.string().min(1), pillar: z.string().min(1), angle: z.string().min(1) }))
    .min(1),
});

const strategyResultSchema = z.object({
  strategy: z.string().min(1),
  hook: z.string().min(1),
  slidePlan: z
    .array(z.object({ kind: z.enum(["cover", "body", "outro"]), purpose: z.string().min(1) }))
    .min(3),
  leadKeyword: z.string().min(1).max(20),
});

// ④ 검수: 7축(필수통과 2 + 가중 5)을 pass/warn/fail 로 채점 + 플래그. 판정(🟢🟡🔴)은 코드가 결정.
const axisResultSchema = z.object({
  status: z.enum(["pass", "warn", "fail"]),
  note: z.string().default(""),
});
const reviewResultSchema = z.object({
  domain: z.string().default("일반"),
  axes: z.object({
    factuality: axisResultSchema, // 🔒 필수통과
    regulatory: axisResultSchema, // 🔒 필수통과
    tone: axisResultSchema,
    request: axisResultSchema,
    completeness: axisResultSchema,
    format: axisResultSchema,
    ux: axisResultSchema,
  }),
  flags: z
    .array(
      z.object({
        slide: z.string().default(""),
        axis: z.string().min(1),
        severity: z.enum(["warn", "block"]),
        issue: z.string().min(1),
        suggestion: z.string().default(""),
      }),
    )
    .default([]),
});

const MUST_PASS = ["factuality", "regulatory"] as const;
// 🟢 통과 / 🟡 검토 / 🔴 경고(책임 동의 후 발행 가능) / ⬛ 차단(명백 위법, 발행 불가)
export type Verdict = "green" | "yellow" | "red" | "black";
export type ReviewReport = z.infer<typeof reviewResultSchema> & { verdict: Verdict };

/**
 * 4단계 판정(경계는 코드가 결정, 설계 §2):
 *  - 필수통과(사실성·규제) fail → ⬛ black(차단): 명백 위법, 발행 불가
 *  - 필수통과 warn → 🔴 red(경고): 회색지대, 책임 동의 후 발행 가능
 *  - 가중 축 이슈/플래그 → 🟡 yellow(검토): 발행 자유
 *  - 전부 통과 → 🟢 green(통과)
 */
function decideVerdict(r: z.infer<typeof reviewResultSchema>): Verdict {
  if (MUST_PASS.some((k) => r.axes[k].status === "fail")) return "black";
  if (MUST_PASS.some((k) => r.axes[k].status === "warn")) return "red";
  const anyIssue = r.flags.length > 0 || Object.values(r.axes).some((a) => a.status !== "pass");
  return anyIssue ? "yellow" : "green";
}

export type Timings = {
  totalMs: number;
  perStageMs: Partial<Record<LlmCall["stage"], number>>;
};

export type GenerateResult = {
  deck: Deck;
  review: ReviewReport;
  usage: TokenUsage;
  timings: Timings;
};

export type GenerateOptions = {
  /** 미지정 시 ① 주제 제안 후 첫 번째 채택. */
  topic?: string;
  /** 테스트·벤치용 공급자 주입(미지정 시 env 기반 getProvider). */
  provider?: LlmProvider;
};

/** provider.complete → JSON.parse → Zod 검증. 실패 시 1회 repair 재시도. usage 누적. */
async function callJson<T extends z.ZodTypeAny>(
  provider: LlmProvider,
  call: LlmCall,
  schema: T,
  usage: TokenUsage,
  timings: Timings,
): Promise<z.infer<T>> {
  let lastError = "";
  const start = Date.now();
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const effective: LlmCall =
        attempt === 0
          ? call
          : { ...call, user: `${call.user}\n\n[수정 요청] 직전 출력이 검증 실패: ${lastError}\n동일한 JSON 스키마로, 글자수 제약을 지켜 다시 출력하라.` };

      const res = await provider.complete(effective);
      usage.inputTokens += res.usage.inputTokens;
      usage.outputTokens += res.usage.outputTokens;

      let parsed: unknown;
      try {
        parsed = JSON.parse(res.text);
      } catch (e) {
        lastError = `JSON 파싱 실패: ${(e as Error).message}`;
        continue;
      }
      const v = schema.safeParse(parsed);
      if (v.success) return v.data;
      lastError = v.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    }
    throw new Error(`[generate:${call.stage}] 2회 시도 후 검증 실패 — ${lastError}`);
  } finally {
    timings.perStageMs[call.stage] = (timings.perStageMs[call.stage] ?? 0) + (Date.now() - start);
  }
}

export async function generateDeck(concept: Concept, opts: GenerateOptions = {}): Promise<GenerateResult> {
  const provider = opts.provider ?? getProvider();
  const system = systemPrompt(concept);
  const usage: TokenUsage = { inputTokens: 0, outputTokens: 0 };
  const timings: Timings = { totalMs: 0, perStageMs: {} };
  const t0 = Date.now();

  // ① 주제 (미지정 시 제안 → 첫 번째 채택)
  let topic = opts.topic;
  if (!topic) {
    const r = await callJson(
      provider,
      { stage: "topic", system, user: topicUserPrompt(), meta: { concept } },
      topicsResultSchema,
      usage,
      timings,
    );
    const first = r.topics[0];
    if (!first) throw new Error("[generate:topic] 주제 제안이 비어 있음");
    topic = first.title;
  }

  // ② 전략
  const strategy = await callJson(
    provider,
    { stage: "strategy", system, user: strategyUserPrompt({ topic }), meta: { concept, topic } },
    strategyResultSchema,
    usage,
    timings,
  );

  // ③ 카피 (deck draft — ai_flags/risk_level 은 placeholder)
  const draft = await callJson(
    provider,
    {
      stage: "copy",
      system,
      user: copyUserPrompt({ conceptId: concept.id, topic, strategy }),
      meta: { concept, topic, strategy },
    },
    deckSchema,
    usage,
    timings,
  );

  // ④ 자가점검 → deck 에 병합
  const deckDraftJson = JSON.stringify(draft);
  const review = await callJson(
    provider,
    {
      stage: "review",
      system,
      user: reviewUserPrompt({ deckJson: deckDraftJson }),
      meta: { concept, deckDraftJson },
    },
    reviewResultSchema,
    usage,
    timings,
  );

  // 7축 → 판정(🟢🟡🔴) 결정 + deck 호환 필드(ai_flags·risk_level)로 매핑
  const verdict = decideVerdict(review);
  const ai_flags = review.flags.map(
    (f) => `[${f.slide || "-"}·${f.axis}] ${f.issue}${f.suggestion ? ` → ${f.suggestion}` : ""}`,
  );
  const risk_level: "low" | "high" = verdict === "black" || verdict === "red" ? "high" : "low";

  // 병합 후 전체 재검증(글자수·구조·leadKeyword 일관성 최종 확인)
  const deck = deckSchema.parse({ ...draft, ai_flags, risk_level });

  timings.totalMs = Date.now() - t0;
  return { deck, review: { ...review, verdict }, usage, timings };
}
