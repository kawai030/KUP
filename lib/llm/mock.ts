import type { LlmCall, LlmProvider, LlmResult, SlidePlanItem } from "@/lib/llm/types";

/**
 * Mock LLM 공급자 — API 키 없이 파이프라인 전체(생성→검증→렌더)를 끝까지 돌리기 위한 구현.
 * 결정적(deterministic)이고 스키마·글자수 제약을 항상 만족하도록 컨셉에서 deck 을 합성한다.
 * "창의적"이지 않다(고정 템플릿). 진짜 카피 품질은 Task 4/5에서 실 공급자로 교체해 측정.
 */

/** zod .max 와 동일하게 UTF-16 길이 기준으로 자른다(한국어 음절=1, 이모지=2). */
function clamp(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max);
}

function firstWord(s: string): string {
  const w = s.split(" ")[0];
  return w && w.length > 0 ? w : s;
}

/** '#' + 공백 제거. /^#\S+$/ 만족. */
function toHashtag(s: string): string {
  return "#" + s.replace(/\s+/g, "");
}

function buildHashtags(pillars: string[]): string[] {
  const fromPillars = pillars.map(toHashtag);
  const fillers = ["#꿀팁", "#정보", "#저장각", "#오늘의기록", "#일상기록"];
  const out: string[] = [];
  for (const t of [...fromPillars, ...fillers]) {
    if (!out.includes(t)) out.push(t);
    if (out.length >= 6) break;
  }
  return out.slice(0, Math.min(out.length, 10));
}

/** 명백한 규제 위반 소지가 큰 표현만(자가점검 데모용 휴리스틱). 단순 과장·열정은 제외 — 실제 판단은 실 공급자 프롬프트가 맥락으로. */
const RISK_WORDS = ["수익 보장", "원금 보장", "확정 수익", "효능", "치료", "부작용 없"];

function estimateUsage(input: string, output: string) {
  return {
    inputTokens: Math.ceil(input.length / 3),
    outputTokens: Math.ceil(output.length / 3),
  };
}

function run(call: LlmCall): string {
  const { concept } = call.meta;
  const pillar0 = concept.pillars[0] ?? "주제";

  switch (call.stage) {
    case "topic": {
      const topics = concept.pillars.map((p) => ({
        title: `${p} 핵심 정리`,
        pillar: p,
        angle: "저장·공유를 부르는 정보형",
      }));
      return JSON.stringify({ topics });
    }

    case "strategy": {
      const leadKeyword = clamp(firstWord(pillar0), 6);
      const slidePlan: SlidePlanItem[] = [
        { kind: "cover", purpose: "후킹 — 멈추게 하는 한 문장" },
        { kind: "body", purpose: "핵심 포인트 1" },
        { kind: "body", purpose: "핵심 포인트 2" },
        { kind: "body", purpose: "핵심 포인트 3" },
        { kind: "outro", purpose: "리드마그넷 CTA" },
      ];
      const topic = call.meta.topic ?? `${pillar0} 핵심 정리`;
      return JSON.stringify({
        strategy: `${topic}를 3개 포인트로 정리하고 댓글 리드마그넷으로 마무리`,
        hook: "스크롤을 멈추게 하는 공감형 한 문장",
        slidePlan,
        leadKeyword,
      });
    }

    case "copy": {
      const topic = call.meta.topic ?? `${pillar0} 핵심 정리`;
      const kw = call.meta.strategy?.leadKeyword ?? clamp(firstWord(pillar0), 6);
      const deck = {
        conceptId: concept.id,
        topic,
        strategy: call.meta.strategy?.strategy ?? `${topic} 3포인트 정리`,
        leadKeyword: kw,
        slides: [
          {
            kind: "cover",
            kicker: clamp(pillar0, 10),
            title: clamp(topic, 24),
            sub: clamp("저장해두고 천천히 보기 좋은 정리", 34),
          },
          {
            kind: "body",
            index: "01",
            head: clamp("첫 번째 포인트", 24),
            body: clamp("핵심을 한 문장으로 짧게 정리했어요.", 48),
          },
          {
            kind: "body",
            index: "02",
            head: clamp("두 번째 포인트", 24),
            body: clamp("실제로 적용하기 쉬운 작은 팁 하나.", 48),
          },
          {
            kind: "body",
            index: "03",
            head: clamp("세 번째 포인트", 24),
            body: clamp("마지막으로 기억하면 좋은 한 가지.", 48),
          },
          {
            kind: "outro",
            title: clamp("더 받아보고 싶다면", 22),
            sub: clamp(`댓글에 '${kw}' 남겨주세요`, 40),
            cta: clamp(`💬 댓글: ${kw}`, 14),
          },
        ],
        caption: clamp(`${topic}. 저장해두고 천천히 보세요.`, 300),
        hashtags: buildHashtags(concept.pillars),
        ai_flags: [],
        risk_level: "low",
      };
      return JSON.stringify(deck);
    }

    case "review": {
      const text = call.meta.deckDraftJson ?? "";
      const regHits = RISK_WORDS.filter((w) => text.includes(w));
      const emptyHits = [
        "첫 번째 포인트",
        "두 번째 포인트",
        "세 번째 포인트",
        "정리했어요",
        "기억하면 좋은 한 가지",
      ].filter((p) => text.includes(p));

      const ok = { status: "pass", note: "" };
      const axes: Record<string, { status: string; note: string }> = {
        factuality: ok,
        regulatory: ok,
        tone: ok,
        request: ok,
        completeness: ok,
        format: ok,
        ux: ok,
      };
      const flags: Array<{ slide: string; axis: string; severity: string; issue: string; suggestion: string }> = [];

      if (regHits.length > 0) {
        axes.regulatory = { status: "fail", note: `규제 가능 표현: ${regHits.join(", ")}` };
        flags.push({
          slide: "",
          axis: "규제 안전성",
          severity: "block",
          issue: `규제 가능 표현 발견: ${regHits.join(", ")}`,
          suggestion: "정보 제공 결로 표현 수정",
        });
      }
      if (emptyHits.length > 0) {
        axes.completeness = { status: "warn", note: "빈 표현(placeholder) 포함" };
        flags.push({
          slide: "본문",
          axis: "완전성",
          severity: "warn",
          issue: `빈 표현: ${emptyHits.join(", ")}`,
          suggestion: "구체적 정보·예시로 교체",
        });
      }
      return JSON.stringify({ domain: "일반", axes, flags });
    }
  }
}

export class MockProvider implements LlmProvider {
  readonly name = "mock";

  async complete(call: LlmCall): Promise<LlmResult> {
    const text = run(call);
    return { text, usage: estimateUsage(call.system + call.user, text) };
  }
}
