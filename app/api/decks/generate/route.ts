import { readFileSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { conceptSchema } from "@/lib/concept-schema";
import { generateDeck } from "@/lib/generate/pipeline";

/**
 * POST /api/decks/generate  — 컨셉 → deck JSON (생성 파이프라인 HTTP 노출).
 *   몸통은 기존 generateDeck()(lib/generate). 기본 mock 공급자라 API 키·DB 불필요.
 *   "UI 없이 기능 테스트"의 경계선 — 프론트는 이 계약(요청/응답)만 보고 화면을 만든다.
 *
 *   GET  /api/decks/generate            예시 컨셉(baking)으로 즉시 스모크 테스트
 *   POST /api/decks/generate            body: { concept: Concept, topic?: string }
 *
 *   응답: { provider, deck, usage, timings }
 *   TODO(Task4): LLM_PROVIDER=anthropic 등 실 공급자 연결 시 그대로 계측됨.
 *   TODO(Task6): ?save=1 시 saveDeck()로 영속화(채널 컨텍스트 필요).
 */
export const runtime = "nodejs";

async function run(conceptInput: unknown, topic?: string) {
  const parsed = conceptSchema.safeParse(conceptInput);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid concept", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { deck, usage, timings } = await generateDeck(parsed.data, { topic });
  return NextResponse.json({ provider: process.env.LLM_PROVIDER ?? "mock", deck, usage, timings });
}

export async function GET() {
  try {
    const file = path.join(process.cwd(), "examples/concepts/baking.json");
    const concept = JSON.parse(readFileSync(file, "utf8"));
    return await run(concept);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "JSON body 필요 ({ concept, topic? })" }, { status: 400 });
    }
    const b = body as { concept?: unknown; topic?: string };
    return await run(b.concept ?? body, b.topic);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
