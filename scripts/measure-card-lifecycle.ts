import "@/scripts/load-env"; // ⚠️ 최우선 — ANTHROPIC_API_KEY 로드
import Anthropic from "@anthropic-ai/sdk";
import { generateCard, generatePlanOutline, type CardGenInput } from "@/lib/workspace/ai";
import { aiReviewFlags } from "@/lib/workspace/ai-review";
import { decideVerdict, VERDICT_META } from "@/lib/workspace/verdict";
import type { CardNews, SurveyProfile } from "@/lib/workspace/types";

/**
 * 카드 1개 라이프사이클 실사용량 + 실제 생성물 검수 측정.
 *   기획(generatePlanOutline) → 제작(generateCard) → 검수(aiReviewFlags) 를 라이브 함수 그대로 실행.
 *   SDK messages.create 를 가로채 단계별 토큰(res.usage)을 잰다(소스 무수정).
 *   목적 ①: 정상 주제로 만든 진짜 카드가 오검출로 차단되지 않는지(false-positive 확인).
 *   목적 ②: 카드 1개당 Claude 실사용량/비용.
 *   npx tsx scripts/measure-card-lifecycle.ts
 */

// ── SDK 호출 가로채 usage 기록(호출 순서 = 기획·제작·검수) ──
type Usage = { inTok: number; outTok: number };
const calls: Usage[] = [];
const MsgProto = (Anthropic as unknown as { Messages: { prototype: Record<string, unknown> } }).Messages.prototype;
const origCreate = MsgProto.create as (...a: unknown[]) => Promise<{ usage?: { input_tokens?: number; output_tokens?: number } }>;
MsgProto.create = async function (this: unknown, ...args: unknown[]) {
  const res = await origCreate.apply(this, args);
  if (res?.usage) calls.push({ inTok: res.usage.input_tokens ?? 0, outTok: res.usage.output_tokens ?? 0 });
  return res;
};

// opus-4-8 단가 (USD / 1M tok)
const IN_USD = 5,
  OUT_USD = 25,
  KRW = 1400;
const usd = (u: Usage) => (u.inTok / 1e6) * IN_USD + (u.outTok / 1e6) * OUT_USD;

const survey: SurveyProfile = {
  niche: "자취 요리",
  followers: 320,
  goals: ["브랜딩"],
  weeklyCapacity: 3,
  brandKeywords: ["자취요리", "10분요리"],
  voiceExample: "친근한 반말 섞인 존댓말, 담백하게",
  forbiddenExpressions: [],
  captionLength: "보통",
  hashtagStyle: "관련 태그 위주",
  sensitiveDomain: "없음",
};

const input: CardGenInput = {
  topicSource: "추천",
  topicTitle: "자취생 아침 10분 요리 5가지",
  format: "카드뉴스",
  objective: "저장",
  pageCount: 6,
  keyMessage: "재료 적고 빠르게, 자취생 현실 아침",
};

function line(label: string, u: Usage) {
  console.log(
    `  ${label.padEnd(6)} in ${String(u.inTok).padStart(6)} / out ${String(u.outTok).padStart(5)}  ≈ $${usd(u).toFixed(4)} (${Math.round(usd(u) * KRW)}원)`,
  );
}

async function main() {
  console.log("주제:", input.topicTitle, "| 분야:", survey.niche);

  const outline = await generatePlanOutline(survey, input);
  const card = await generateCard(survey, input, outline.pages);
  console.log(`\n기획 generatedBy=${outline.generatedBy} · 제작 generatedBy=${card.generatedBy}`);

  const reviewInput = {
    title: card.title,
    pages: card.pages,
    caption: card.caption,
    hashtags: card.hashtags,
    cta: card.cta,
  } as CardNews;
  const flags = await aiReviewFlags(reviewInput, survey);
  const verdict = decideVerdict(flags);
  const meta = VERDICT_META[verdict];

  console.log("\n── 생성된 카드 ──");
  console.log(`제목: ${card.title}`);
  card.pages.forEach((p) => console.log(`  ${p.index + 1}. ${p.headline} — ${p.body}`));
  console.log(`캡션: ${card.caption}`);

  console.log(`\n── 검수 판정: ${meta.emoji} ${meta.label} (${verdict}) ──`);
  if (flags.length === 0) console.log("  AI 플래그 없음(정상 카드 → 오검출 아님 ✓ / 또는 키 없음)");
  for (const f of flags) {
    const tier = f.mustPass && f.level === "fail" ? "⚫" : f.mustPass && f.level === "warn" ? "🔴" : "🟡";
    console.log(`  ${tier} [${f.axis}] ${f.message}`);
  }

  console.log("\n── 실사용량 (카드 1개) ──");
  const labels = ["기획", "제작", "검수"];
  calls.forEach((u, i) => line(labels[i] ?? `call${i + 1}`, u));
  const total = calls.reduce((a, u) => ({ inTok: a.inTok + u.inTok, outTok: a.outTok + u.outTok }), { inTok: 0, outTok: 0 });
  console.log("  " + "─".repeat(40));
  line("합계", total);
  console.log(`\n  호출 ${calls.length}건 · 카드 1개당 ≈ $${usd(total).toFixed(4)} (약 ${Math.round(usd(total) * KRW)}원)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
