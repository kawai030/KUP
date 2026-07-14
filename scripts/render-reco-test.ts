import "@/scripts/load-env";
import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import type { CardFormat, ContentObjective, SurveyProfile } from "@/lib/workspace/types";

/**
 * 추천 콘텐츠 프롬프트 실험: C(안전 — 환각회피) vs D(확신 보정 — 유명한 실물은 실명 허용).
 * "노래·책(유명·안정) vs 맛집(로컬·변동)"에서 프롬프트-온리의 한계선을 눈으로 확인.
 * 라이브 무영향. 결과: out/reco-test.html
 *
 *   npm run reco-test
 */

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

function baseSurvey(over: Partial<SurveyProfile>): SurveyProfile {
  return {
    niche: "라이프스타일 큐레이션", followers: 640, goals: ["브랜딩"], weeklyCapacity: 2,
    brandKeywords: ["큐레이션"],
    voiceExample: "잔잔하고 다정한 존댓말(~예요/~해요)", forbiddenExpressions: [], captionLength: "보통",
    hashtagStyle: "주제 관련 위주", sensitiveDomain: "없음", ...over,
  };
}

interface Scenario { label: string; survey: SurveyProfile; input: { topicTitle: string; format: CardFormat; objective: ContentObjective; pageCount: number; keyMessage: string } }

const SCENARIOS: Scenario[] = [
  { label: "노래 추천 (유명·안정 — 실명 가능?)", survey: baseSurvey({ niche: "감성 플레이리스트", brandKeywords: ["플레이리스트"] }),
    input: { topicTitle: "비 오는 날 듣기 좋은 한국 노래 추천", format: "카드뉴스", objective: "저장", pageCount: 5, keyMessage: "빗소리에 어울리는 곡" } },
  { label: "책 추천 (유명·안정 — 실명 가능?)", survey: baseSurvey({ niche: "독서 큐레이션", brandKeywords: ["책추천"] }),
    input: { topicTitle: "20대에 읽으면 좋은 책 추천", format: "카드뉴스", objective: "저장", pageCount: 5, keyMessage: "생각이 깊어지는 책" } },
  { label: "맛집 추천 (로컬·변동 — 여기서 무너짐)", survey: baseSurvey({ niche: "카페 큐레이션", brandKeywords: ["카페추천"] }),
    input: { topicTitle: "서울 성수동 감성 카페 추천", format: "카드뉴스", objective: "방문", pageCount: 5, keyMessage: "분위기 좋은 카페" } },
];

const INTRO = "당신은 한국어 인스타 카드뉴스 카피라이터입니다. 사용자의 톤을 그대로 살린 ‘수정 가능한 초안’을 만듭니다.";
const OUT = "결과는 JSON 객체만(설명·코드펜스 없이). 디자인·색·폰트·HTML은 생성하지 않는다. 스키마: {title, pages:[{index, headline, body, photoNote}], caption, hashtags:string[8~12], cta}. 각 body 1~3문장.";
const SELFCHECK = "최종 출력 전 스스로 점검(출력 금지): 한국어만 읽어도 가치가 완전한가? 지어낸 항목은 없는가? CTA 자연스러운가? 미달이면 고쳐서 낸다.";

function common(survey: SurveyProfile): string[] {
  return [
    `브랜드 키워드: ${survey.brandKeywords.join(", ") || "(없음)"} / 문체: ${survey.voiceExample || "(없음)"}`,
  ];
}
function baseRules(): string[] {
  return [
    "[구성] 한 장 = 한 가지 생각. 첫 장은 후킹, 마지막 장은 자연스러운 CTA.",
    "[카피] 짧고 리듬 있게, 구어체, 과장·클리셰·느낌표 남발 금지. 이모지는 장당 0~1개.",
    "[빈 카피 금지] '핵심 1'·'정리했어요' 같은 알맹이 없는 표현 금지. 실제 내용을 써라.",
  ];
}

// C = 지금 채택안(안전): 실존 고유명사는 지어내지 말고 예시 프레임으로
function promptC(survey: SurveyProfile, format: CardFormat): string {
  return [INTRO, `형식: ${format}`, ...common(survey), ...baseRules(),
    "[사실성] 실존하는 곡·책·매장·제품·순위·통계를 지어내지 않는다. 확신 없는 고유명사는 단정하지 말고 장르·무드나 '예시' 프레임으로 쓴다.",
    OUT, SELFCHECK].join("\n");
}

// D = 확신 보정: 유명·안정적 실물은 실명으로, 로컬·변동·불확실은 단정 금지
function promptD(survey: SurveyProfile, format: CardFormat): string {
  return [INTRO, `형식: ${format}`, ...common(survey), ...baseRules(),
    "[추천 콘텐츠 — 실물을 직접 알려준다] 노래·책·장소·제품 추천을 요청받으면 장르·무드로 뭉개지 말고 실존하는 구체 항목을 직접 제시한다.",
    "  - 단, 실제로 존재한다고 확신하는 것만 실명으로. 널리 알려지고 시간이 검증된 것을 우선한다(최신·희귀한 것은 피한다).",
    "  - 곡은 '가수 - 제목', 책은 '제목 (저자)'처럼 식별 가능하게 쓴다.",
    "  - 로컬 매장(맛집·카페 등)·가격·영업시간·주소·순위처럼 자주 바뀌거나 검증이 필요한 정보는 절대 지어내지 않는다. 확신이 없으면 그 자리는 '👉 여기에 직접 추가하세요' 틀 + 고르는 기준만 제시한다.",
    "[사실성] 확신 없는 고유명사·수치를 지어내느니 빈칸 틀로 남긴다. 정직함이 우선이다.",
    OUT, SELFCHECK].join("\n");
}

function extractJson(text: string): any {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/); const c = fenced?.[1] ?? text;
  const s = c.indexOf("{"), e = c.lastIndexOf("}"); if (s === -1 || e === -1) throw new Error("no json");
  return JSON.parse(c.slice(s, e + 1));
}
async function call(client: Anthropic, system: string, user: string) {
  const t0 = Date.now();
  const res: any = await client.messages.create({ model: MODEL, max_tokens: 4000, system, messages: [{ role: "user", content: user }] });
  const text = res.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
  return { deck: extractJson(text), ms: Date.now() - t0, out: res.usage.output_tokens as number };
}
function esc(s: any): string { return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>"); }

function deckHtml(tag: string, r: any): string {
  const d = r.deck;
  const slides = (d.pages || []).map((p: any, i: number) =>
    `<div class="slide"><div class="idx">${i + 1}/${d.pages.length}</div><div class="head">${esc(p.headline)}</div><div class="body">${esc(p.body)}</div></div>`).join("");
  return `<div class="col"><h3>${esc(tag)} <span class="cost">out ${r.out}tok</span></h3><div class="rail">${slides}</div>
    <div class="meta"><div><b>캡션</b> ${esc(d.caption)}</div><div><b>CTA</b> ${esc(d.cta)}</div></div></div>`;
}
function renderHtml(rows: any[]): string {
  const sections = rows.map((row) => `<section><h2>${esc(row.label)}</h2><p class="topic">주제: ${esc(row.input.topicTitle)}</p>
    <div class="grid">${deckHtml("C · 안전(현재 채택안)", row.c)}${deckHtml("D · 확신 보정(실물 실명 허용)", row.d)}</div></section>`).join("");
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>추천 콘텐츠 C vs D</title><style>
    body{font-family:'Pretendard','Apple SD Gothic Neo',system-ui,sans-serif;margin:0;background:#eeece6;color:#1b1a17}
    header{padding:26px 32px;background:#fff;border-bottom:1px solid #ddd9cf}header h1{margin:0 0 6px;font-size:22px}header p{margin:0;color:#6f6a5e;font-size:14px}
    section{padding:24px 32px;border-bottom:1px solid #ddd9cf}h2{font-size:18px;margin:0 0 2px}.topic{margin:0 0 16px;color:#6f6a5e;font-size:13px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:22px}.col h3{font-size:15px;margin:0 0 10px}.cost{font-size:12px;font-weight:400;color:#a49c8c}
    .rail{display:flex;gap:12px;overflow-x:auto;padding-bottom:8px}
    .slide{flex:0 0 220px;height:250px;background:#f6f3ec;border:1px solid #e2ddd0;border-radius:18px;padding:20px;box-sizing:border-box;display:flex;flex-direction:column;box-shadow:0 2px 10px rgba(0,0,0,.06)}
    .idx{font-size:11px;color:#ef5a35;font-weight:700;margin-bottom:10px}.head{font-size:16px;font-weight:800;line-height:1.3;margin-bottom:10px;word-break:keep-all}
    .body{font-size:12.5px;line-height:1.55;color:#4a463d;overflow:auto;word-break:keep-all}
    .meta{margin-top:12px;font-size:12px;color:#4a463d;line-height:1.6;background:#fbfaf6;border-radius:12px;padding:10px 12px}.meta b{color:#ef5a35}
    @media(max-width:900px){.grid{grid-template-columns:1fr}}</style></head><body>
    <header><h1>🔎 추천 콘텐츠 — C(안전) vs D(확신 보정)</h1><p>노래·책(유명·안정) vs 맛집(로컬·변동)에서 프롬프트-온리로 실물 추천이 어디까지 되는지 확인. ⚠️ D의 실명은 반드시 사실 검증 필요.</p></header>${sections}</body></html>`;
}

async function main() {
  const key = process.env.ANTHROPIC_API_KEY; if (!key) { console.error("❌ ANTHROPIC_API_KEY 없음"); process.exit(1); }
  const client = new Anthropic({ apiKey: key });
  const rows: any[] = [];
  for (const sc of SCENARIOS) {
    const user = JSON.stringify({ 주제: sc.input.topicTitle, 형식: sc.input.format, 목적: sc.input.objective, 페이지수: sc.input.pageCount, 핵심메시지: sc.input.keyMessage, 아웃라인: "(없음)" });
    console.log(`🧪 ${sc.label} 생성 중...`);
    const [c, d] = await Promise.all([call(client, promptC(sc.survey, sc.input.format), user), call(client, promptD(sc.survey, sc.input.format), user)]);
    rows.push({ label: sc.label, input: sc.input, c, d });
    console.log(`   ✅ C out ${c.out} / D out ${d.out}`);
  }
  const outDir = path.join(process.cwd(), "out"); fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "reco-test.html"); fs.writeFileSync(outPath, renderHtml(rows), "utf8");
  console.log(`\n📄 렌더 완료 → ${outPath}`);
}
main().catch((e) => { console.error("❌", e instanceof Error ? e.message : e); process.exit(1); });
