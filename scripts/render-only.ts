import "@/scripts/load-env"; // ⚠️ 최우선 — lib/env.ts 검증 전에 process.env 채움
import fs from "node:fs";
import path from "node:path";
import { conceptSchema } from "@/lib/concept-schema";
import { deckSchema } from "@/lib/deck-schema";
import { renderDeck } from "@/lib/render/deck-renderer";

/**
 * 손으로 작성한(또는 외부 생성한) deck JSON 을 그대로 렌더만 한다 — 생성 파이프라인(LLM) 건너뜀.
 * Claude 공급자를 붙이기 전, "개선된 프롬프트가 만들 결과"를 미리 보기 위한 용도.
 *
 *   npm run render -- <concept.json> <deck.json> [--out out/dir]
 */
async function main() {
  const argv = process.argv.slice(2).filter((a) => a && !a.startsWith("--"));
  const conceptPath = argv[0] ?? "examples/concepts/camel-finance.json";
  const deckPath = argv[1] ?? "examples/decks/camel-finance-detailed.json";

  const concept = conceptSchema.parse(JSON.parse(fs.readFileSync(conceptPath, "utf8")));
  const deck = deckSchema.parse(JSON.parse(fs.readFileSync(deckPath, "utf8")));

  const outDir = path.join("out", deck.conceptId + "-detailed");
  fs.mkdirSync(outDir, { recursive: true });

  const { files } = await renderDeck(concept, deck, outDir);

  console.log(`✅ [${deck.conceptId}] 카드뉴스 ${deck.slides.length}장 렌더 완료 (LLM 건너뜀)`);
  console.log(`   주제 : ${deck.topic}`);
  console.log(`   전략 : ${deck.strategy}`);
  files.forEach((f) => console.log("   - " + path.relative(process.cwd(), f)));
}

main().catch((e) => {
  console.error("❌ 렌더 실패:", e instanceof Error ? e.message : e);
  process.exit(1);
});
