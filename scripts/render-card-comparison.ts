import "@/scripts/load-env";
import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { cardSystemPrompt } from "@/lib/workspace/ai";
import type { SurveyProfile } from "@/lib/workspace/types";

/**
 * 4방식 카드뉴스 비교 — 실제 API 생성 → HTML 슬라이드로 렌더(눈으로 보게).
 * 라이브 무영향. 결과: out/card-comparison.html (브라우저로 열기).
 *
 *   npm run render-compare
 *
 * 방식: ① 현재(그라운딩X)  ② 그라운딩(Opus)  ③ 그라운딩(Sonnet, 저렴)  ④ 사용자작성 스캐폴딩
 */

const OPUS = "claude-opus-4-8";
const SONNET = "claude-sonnet-5";
// 대략 단가($/1M): [입력, 출력]
const PRICE: Record<string, [number, number]> = {
  [OPUS]: [5, 25],
  [SONNET]: [2, 10], // 인트로 요율
};

const survey: SurveyProfile = {
  niche: "감성 음악 큐레이션",
  followers: 780,
  goals: ["브랜딩"],
  weeklyCapacity: 3,
  brandKeywords: ["감성플레이리스트", "음악추천"],
  voiceExample: "잔잔하고 다정한 존댓말(~예요/~해요)",
  forbiddenExpressions: [],
  captionLength: "보통",
  hashtagStyle: "음악·감성 관련 위주",
  sensitiveDomain: "없음",
};
const TOPIC = "비 오는 날 듣기 좋은 감성 노래";
const KEY = "빗소리에 어울리는 잔잔한 한국 노래를 모았어요";
const PAGES = 6;

const OUTPUT_SCHEMA =
  "결과는 JSON 객체만. 스키마: {title, pages:[{index, headline, body}], caption, hashtags:string[8~12], cta}. 첫 장 후킹, 마지막 장 CTA. 각 body 1~3문장.";

function userPayload(): string {
  return JSON.stringify({ 주제: TOPIC, 형식: "카드뉴스", 목적: "저장", 페이지수: PAGES, 핵심메시지: KEY });
}

function groundedSystem(): string {
  return [
    "당신은 한국어 인스타 카드뉴스 카피라이터입니다.",
    `브랜드 키워드: ${survey.brandKeywords.join(", ")} / 문체: ${survey.voiceExample}`,
    "[그라운딩 규칙] ★ 반드시 web_search 로 '비 오는 날 감성 한국 노래'를 실제 검색해, 실존하는 곡만 사용하세요.",
    "- 가수-곡 매칭을 지어내지 마세요. 검색으로 확인된 곡만. 각 body에 '가수 - 곡제목' + 어울리는 이유 한 줄.",
    OUTPUT_SCHEMA,
  ].join("\n");
}

function scaffoldSystem(): string {
  return [
    "당신은 한국어 인스타 카드뉴스 '작성 가이드'를 만드는 어시스턴트입니다.",
    `브랜드 키워드: ${survey.brandKeywords.join(", ")} / 문체: ${survey.voiceExample}`,
    "[스캐폴딩 규칙] 실제 곡을 지어내지 말고, 사용자가 직접 채우도록 '틀 + 예시'를 제공하세요.",
    "- 각 body는 이 형식: '👉 [여기에 곡: 가수 - 제목을 적어주세요]\\n예시) 폴킴 - 비 (담백한 목소리가 빗소리와 잘 어울려요)'",
    "- 곡 자체를 단정하지 말고, 사용자가 자기 취향으로 고르도록 안내하는 톤.",
    OUTPUT_SCHEMA,
  ].join("\n");
}

function extractJson(text: string): any {
  // 검색 인용 태그(<cite index="..">..</cite>)는 안의 따옴표가 JSON을 깨므로 파싱 전 제거(내부 텍스트는 유지)
  const stripped = text.replace(/<\/?cite[^>]*>/g, "");
  const fenced = stripped.match(/```(?:json)?\s*([\s\S]*?)```/);
  const c = fenced?.[1] ?? stripped;
  const s = c.indexOf("{"), e = c.lastIndexOf("}");
  if (s === -1 || e === -1) throw new Error("JSON 없음");
  return JSON.parse(c.slice(s, e + 1));
}

function costOf(model: string, usage: any, searches: number): number {
  const [pin, pout] = PRICE[model] ?? [5, 25];
  const inTok = usage?.input_tokens ?? 0;
  const outTok = usage?.output_tokens ?? 0;
  return (inTok * pin + outTok * pout) / 1_000_000 + searches * 0.01;
}

type Variant = { key: string; label: string; note: string; model: string; deck: any; searches: number; costUsd: number; ms: number };

async function genPlain(client: Anthropic, model: string, system: string): Promise<Omit<Variant, "key" | "label" | "note">> {
  const t0 = Date.now();
  const res: any = await client.messages.create({ model, max_tokens: 2200, system, messages: [{ role: "user", content: userPayload() }] });
  const text = res.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
  return { model, deck: extractJson(text), searches: 0, costUsd: costOf(model, res.usage, 0), ms: Date.now() - t0 };
}

async function genGrounded(client: Anthropic, model: string): Promise<Omit<Variant, "key" | "label" | "note">> {
  const t0 = Date.now();
  const tools: any = [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }];
  const messages: any[] = [{ role: "user", content: userPayload() }];
  const system = groundedSystem();
  let searches = 0, res: any, totalIn = 0, totalOut = 0;
  for (let g = 0; g < 6; g++) {
    res = await client.messages.create({ model, max_tokens: 3200, system, messages, tools } as any);
    searches += res.usage?.server_tool_use?.web_search_requests ?? 0;
    totalIn += res.usage?.input_tokens ?? 0;
    totalOut += res.usage?.output_tokens ?? 0;
    if (res.stop_reason === "pause_turn") { messages.push({ role: "assistant", content: res.content }); continue; }
    break;
  }
  const text = res.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
  return { model, deck: extractJson(text), searches, costUsd: costOf(model, { input_tokens: totalIn, output_tokens: totalOut }, searches), ms: Date.now() - t0 };
}

function esc(s: any): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
}

function renderHtml(variants: Variant[]): string {
  const sections = variants.map((v) => {
    const slides = (v.deck.pages || [])
      .map(
        (p: any, i: number) => `
      <div class="slide">
        <div class="idx">${i + 1}/${v.deck.pages.length}</div>
        <div class="head">${esc(p.headline)}</div>
        <div class="body">${esc(p.body)}</div>
      </div>`,
      )
      .join("");
    const won = Math.round(v.costUsd * 1400);
    return `
    <section>
      <h2>${esc(v.label)} <span class="cost">· $${v.costUsd.toFixed(3)} (약 ${won}원) · ${v.model} · 검색 ${v.searches}회 · ${(v.ms / 1000).toFixed(1)}s</span></h2>
      <p class="note">${esc(v.note)}</p>
      <div class="rail">${slides}</div>
      <div class="meta">
        <div><b>제목</b> ${esc(v.deck.title)}</div>
        <div><b>캡션</b> ${esc(v.deck.caption)}</div>
        <div><b>해시태그</b> ${esc((v.deck.hashtags || []).join(" "))}</div>
        <div><b>CTA</b> ${esc(v.deck.cta)}</div>
      </div>
    </section>`;
  }).join("");

  return `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<title>카드뉴스 4방식 비교 — ${esc(TOPIC)}</title>
<style>
  :root{--navy:#2E3A59;--ink:#1a1a1a}
  body{font-family:'Pretendard','Apple SD Gothic Neo',system-ui,sans-serif;margin:0;background:#f4f4f6;color:var(--ink)}
  header{padding:28px 32px;background:#fff;border-bottom:1px solid #e5e5ea}
  header h1{margin:0 0 6px;font-size:22px}
  header p{margin:0;color:#666;font-size:14px}
  section{padding:24px 32px;border-bottom:1px solid #e5e5ea}
  h2{font-size:18px;margin:0 0 4px}
  .cost{font-size:13px;font-weight:400;color:#888}
  .note{margin:0 0 14px;color:#c0392b;font-size:13px}
  .rail{display:flex;gap:14px;overflow-x:auto;padding-bottom:10px}
  .slide{flex:0 0 260px;height:260px;background:var(--navy);color:#fff;border-radius:18px;
    padding:22px;box-sizing:border-box;display:flex;flex-direction:column;box-shadow:0 4px 14px rgba(0,0,0,.12)}
  .idx{font-size:12px;opacity:.6;margin-bottom:10px}
  .head{font-size:17px;font-weight:700;line-height:1.35;margin-bottom:10px}
  .body{font-size:13.5px;line-height:1.55;opacity:.92;overflow:auto}
  .meta{margin-top:14px;font-size:13px;color:#444;line-height:1.7}
  .meta b{display:inline-block;min-width:64px;color:#2E3A59}
</style></head>
<body>
<header>
  <h1>🌧️ 카드뉴스 4방식 비교 — "${esc(TOPIC)}"</h1>
  <p>같은 주제·같은 계정 설정으로 4가지 생성 방식을 실제 API로 만든 결과입니다. 슬라이드는 옆으로 스크롤하세요.</p>
</header>
${sections}
</body></html>`;
}

async function main() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { console.error("❌ ANTHROPIC_API_KEY 없음 (.env.local)"); process.exit(1); }
  const client = new Anthropic({ apiKey: key });

  console.log(`🧪 "${TOPIC}" — 4방식 생성 중...\n`);
  const variants: Variant[] = [];

  const jobs: Array<{ key: string; label: string; note: string; run: () => Promise<Omit<Variant, "key" | "label" | "note">> }> = [
    { key: "plain", label: "① 현재 방식 (그라운딩 없음)", note: "실제 곡처럼 보여도 가수를 틀리게 매칭할 위험(환각). 검증 안 됨.", run: () => genPlain(client, OPUS, cardSystemPrompt(survey, "카드뉴스")) },
    { key: "ground-opus", label: "② 웹서치 그라운딩 (Opus)", note: "실제 검색된 곡만 사용 → 정확. 비용은 가장 높음.", run: () => genGrounded(client, OPUS) },
    { key: "ground-sonnet", label: "③ 웹서치 그라운딩 (Sonnet, 저렴)", note: "동일 그라운딩을 저렴 모델로 → 정확도 유지하며 비용 절감 실측.", run: () => genGrounded(client, SONNET) },
    { key: "scaffold", label: "④ 사용자 작성 스캐폴딩", note: "검색 없이 '틀+예시'만 제공, 곡은 사용자가 채움. 비용 최저·정직하지만 수고 필요.", run: () => genPlain(client, OPUS, scaffoldSystem()) },
  ];

  for (const j of jobs) {
    try {
      const r = await j.run();
      variants.push({ key: j.key, label: j.label, note: j.note, ...r });
      console.log(`✅ ${j.label} — $${r.costUsd.toFixed(3)} (약 ${Math.round(r.costUsd * 1400)}원) · 검색 ${r.searches}회`);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      console.error(`❌ ${j.label} 실패: ${m}`);
      if (/web.?search|not.?enabled|403|permission/i.test(m)) console.error("   → 콘솔에서 웹서치 활성화 필요");
    }
  }

  if (!variants.length) { console.error("생성된 결과 없음"); process.exit(1); }

  const outDir = path.join(process.cwd(), "out");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "card-comparison.html");
  fs.writeFileSync(outPath, renderHtml(variants), "utf8");

  const totalWon = Math.round(variants.reduce((s, v) => s + v.costUsd, 0) * 1400);
  console.log(`\n📄 렌더 완료 → ${outPath}`);
  console.log(`   브라우저로 여세요. (이번 4방식 총 생성비 약 ${totalWon}원)`);
}

main().catch((e) => { console.error("❌", e instanceof Error ? e.message : e); process.exit(1); });
