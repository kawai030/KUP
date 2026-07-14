import "@/scripts/load-env"; // ⚠️ 최우선 — lib/env.ts 검증 전에 process.env 채움
import fs from "node:fs";
import path from "node:path";
import { conceptSchema } from "@/lib/concept-schema";
import { generateDeck } from "@/lib/generate/pipeline";
import { renderDeck } from "@/lib/render/deck-renderer";

/**
 * 생성 파이프라인 엔드투엔드 CLI — 컨셉만 주면 deck JSON + 슬라이드 PNG 가 로컬에서 나온다.
 * (Phase 2 완료 기준: 입구→렌더 완전 연결. 기본 mock 공급자라 API 키 불필요.)
 *
 *   npm run gen                              # examples/concepts/baking.json
 *   npm run gen -- <concept.json>
 *   npm run gen -- <concept.json> --topic "직접 지정한 주제" --out out/test
 *   npm run gen -- --save                    # deck→DB 영속화(로컬 Supabase 필요)
 *   LLM_PROVIDER=mock npm run gen            # 공급자 선택(현재 mock만)
 */

function parseArgs(argv: string[]) {
  const positional: string[] = [];
  const flags: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a) continue;
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = "true";
      }
    } else {
      positional.push(a);
    }
  }
  return { positional, flags };
}

async function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const conceptPath = positional[0] ?? "examples/concepts/baking.json";

  if (!fs.existsSync(conceptPath)) {
    console.error(`❌ 컨셉 파일 없음: ${conceptPath}`);
    process.exit(1);
  }

  const concept = conceptSchema.parse(JSON.parse(fs.readFileSync(conceptPath, "utf8")));
  console.log(`📋 컨셉: ${concept.account} (${concept.id}) — ${concept.persona}`);
  console.log(`   공급자: ${process.env.LLM_PROVIDER ?? "mock"}\n`);

  const { deck, review, usage, timings } = await generateDeck(concept, { topic: flags.topic });

  const outDir = flags.out ?? path.join("out", deck.conceptId);
  fs.mkdirSync(outDir, { recursive: true });
  const deckPath = path.join(outDir, "deck.json");
  fs.writeFileSync(deckPath, JSON.stringify(deck, null, 2), "utf8");

  const { files } = await renderDeck(concept, deck, outDir);

  console.log(`✅ [${deck.conceptId}] 카드뉴스 ${deck.slides.length}장 생성·렌더 완료`);
  console.log(`   주제   : ${deck.topic}`);
  console.log(`   전략   : ${deck.strategy}`);
  console.log(`   리드키 : ${deck.leadKeyword}`);
  console.log(`   deck   : ${deckPath}`);
  files.forEach((f) => console.log("   - " + path.relative(process.cwd(), f)));

  const vLabel =
    review.verdict === "black"
      ? "⬛ 차단 (발행 불가)"
      : review.verdict === "red"
        ? "🔴 경고 (책임 동의 후 발행)"
        : review.verdict === "yellow"
          ? "🟡 검토 권장"
          : "🟢 통과 가능";
  const sym = (s: string) => (s === "pass" ? "✓" : s === "warn" ? "⚠" : "✗");
  console.log(`\n── 검수 리포트 (7축) ──`);
  console.log(`   판정   : ${vLabel}  (분야: ${review.domain})`);
  console.log(
    `   [필수] 사실성 ${sym(review.axes.factuality.status)} · 규제 ${sym(review.axes.regulatory.status)}`,
  );
  console.log(
    `   [가중] 톤 ${sym(review.axes.tone.status)} · 요청 ${sym(review.axes.request.status)} · 완전성 ${sym(review.axes.completeness.status)} · 형식 ${sym(review.axes.format.status)} · UX ${sym(review.axes.ux.status)}`,
  );
  if (review.flags.length === 0) console.log("   플래그 : (없음)");
  review.flags.forEach((f) =>
    console.log(`   ⚑ [${f.slide || "-"}·${f.axis}] ${f.issue}${f.suggestion ? ` → ${f.suggestion}` : ""}`),
  );

  console.log(`\n── 계측(벤치 입력) ──`);
  console.log(`   토큰   : in ${usage.inputTokens} / out ${usage.outputTokens} (mock 추정치)`);
  console.log(`   시간   : 총 ${timings.totalMs}ms ${JSON.stringify(timings.perStageMs)}`);

  // --save: 실제 영속화(Task 6). dev 채널 보장 → decks 저장 → 왕복 검증.
  if (flags.save !== undefined) {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const { ensureDevChannel } = await import("@/lib/db/dev-seed");
    const { saveDeck, getDeckRow, deckFromRow } = await import("@/lib/db/decks");

    const db = createAdminClient();
    const channelId = await ensureDevChannel(db, concept);
    const deckId = await saveDeck(db, channelId, deck);
    const restored = deckFromRow(await getDeckRow(db, deckId), concept.id);

    console.log(`\n── DB 영속화 ──`);
    console.log(`   channel : ${channelId} (컨셉 잠금 = channel_configs)`);
    console.log(`   deck    : ${deckId} (status=produced)`);
    console.log(
      `   왕복✓   : topic="${restored.topic}" · slides=${restored.slides.length} · risk=${restored.risk_level}`,
    );
  }
}

main().catch((e) => {
  console.error("❌ 생성 실패:", e instanceof Error ? e.message : e);
  process.exit(1);
});
