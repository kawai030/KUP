import Anthropic from "@anthropic-ai/sdk";
import type { LlmCall, LlmProvider, LlmResult } from "@/lib/llm/types";

/**
 * Anthropic(Claude) 공급자 — 생성 파이프라인의 4단계(topic·strategy·copy·review)를
 * 실제 Claude로 돌린다. mock 과 동일한 LlmProvider 계약을 구현하므로 generateDeck 은
 * 그대로 두고 LLM_PROVIDER=anthropic 만으로 교체된다(설계 §Task4).
 *
 * 계약: complete() 는 항상 "순수 JSON 문자열"을 돌려줘야 한다(pipeline.callJson 이 바로
 * JSON.parse 함). 모델이 코드펜스나 서두 문장을 붙일 수 있으므로 extractJson 으로 본문만 뽑는다.
 * 검증·글자수·repair 재시도는 파이프라인이 담당하므로 여기선 원문 응답만 정제해 넘긴다.
 */

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";
// deck JSON + 검수 리포트는 짧다. 넉넉히 잡되 비스트리밍 HTTP 타임아웃 여유 안(~16k)으로.
const MAX_TOKENS = 8000;

/** 모델 응답에서 JSON 객체 본문만 추출(코드펜스·서두 텍스트 제거). */
function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced?.[1] ?? text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("[llm:anthropic] 응답에서 JSON 객체를 찾지 못함");
  }
  return candidate.slice(start, end + 1);
}

export class AnthropicProvider implements LlmProvider {
  readonly name = "anthropic";
  private client: Anthropic;

  constructor(apiKey = process.env.ANTHROPIC_API_KEY) {
    if (!apiKey) {
      throw new Error(
        "[llm:anthropic] ANTHROPIC_API_KEY 미설정 — .env.local 에 키를 넣거나 LLM_PROVIDER=mock 사용.",
      );
    }
    this.client = new Anthropic({ apiKey });
  }

  async complete(call: LlmCall): Promise<LlmResult> {
    const res = await this.client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: call.system,
      messages: [{ role: "user", content: call.user }],
    });

    const textBlock = res.content.find((b) => b.type === "text");
    const raw = textBlock && "text" in textBlock ? textBlock.text : "";

    return {
      text: extractJson(raw),
      usage: {
        inputTokens: res.usage.input_tokens,
        outputTokens: res.usage.output_tokens,
      },
    };
  }
}
