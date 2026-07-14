import "@/scripts/load-env"; // ⚠️ 최우선 — process.env(ANTHROPIC_API_KEY) 채움
import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { cardSystemPrompt } from "@/lib/workspace/ai";
import type { CardFormat, ContentObjective, SurveyProfile } from "@/lib/workspace/types";

/**
 * 프롬프트 A(현재 라이브) vs C(P5 신규안) 텍스트 품질 비교 — 카드 모양 HTML 렌더(눈으로 보게).
 * 라이브 무영향. 결과: out/prompt-comparison.html (브라우저로 열기).
 *
 *   npm run render-prompts
 *
 * 3개 시나리오(홈카페·재테크·노래추천)를 같은 입력으로 A/C 각각 실제 생성 → 나란히 렌더.
 */

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

function baseSurvey(over: Partial<SurveyProfile>): SurveyProfile {
  return {
    niche: "홈카페",
    followers: 320,
    goals: ["브랜딩"],
    weeklyCapacity: 2,
    brandKeywords: ["홈카페", "라떼아트"],
    voiceExample: "편하게 반말 섞인 친근한 존댓말(~예요/~해요)",
    forbiddenExpressions: [],
    captionLength: "보통",
    hashtagStyle: "주제 관련 위주",
    sensitiveDomain: "없음",
    ...over,
  };
}

interface Scenario {
  label: string;
  survey: SurveyProfile;
  input: { topicTitle: string; format: CardFormat; objective: ContentObjective; pageCount: number; keyMessage: string };
}

const SCENARIOS: Scenario[] = [
  {
    label: "홈카페 · 카드뉴스 (구체적 주제)",
    survey: baseSurvey({}),
    input: { topicTitle: "집에서 카페 라떼 맛내는 법", format: "카드뉴스", objective: "저장", pageCount: 5, keyMessage: "우유 온도와 거품이 8할이다" },
  },
  {
    label: "재테크 · 카드뉴스 (민감 도메인 가드레일)",
    survey: baseSurvey({
      niche: "사회초년생 재테크",
      brandKeywords: ["재테크", "월급관리"],
      sensitiveDomain: "금융·투자·부동산",
      voiceExample: "담백하고 정보형 존댓말",
    }),
    input: { topicTitle: "사회초년생 첫 통장 쪼개기", format: "카드뉴스", objective: "저장", pageCount: 5, keyMessage: "쓰는 돈과 모으는 돈을 물리적으로 분리한다" },
  },
  {
    label: "플레이리스트 · 카드뉴스 (환각 유발 — 실존 곡 지어내나)",
    survey: baseSurvey({
      niche: "감성 플레이리스트 큐레이션",
      brandKeywords: ["플레이리스트", "감성음악"],
      voiceExample: "잔잔하고 감성적인 존댓말",
    }),
    input: { topicTitle: "비 오는 날 듣기 좋은 노래 추천", format: "카드뉴스", objective: "저장", pageCount: 5, keyMessage: "빗소리에 어울리는 곡을 장면별로 골랐어요" },
  },
];

// ── C: P5 신규안 (compare-card-prompt.ts 의 cardSystemPromptV3 와 동일) ──────────
function cardSystemPromptC(survey: SurveyProfile, format: CardFormat): string {
  const common = [
    `브랜드 키워드: ${survey.brandKeywords.join(", ") || "(없음)"}`,
    `문체 예시: ${survey.voiceExample || "(없음)"}`,
    `금지 표현: ${survey.forbiddenExpressions.join(", ") || "(없음)"}`,
    `캡션 길이 선호: ${survey.captionLength} / 해시태그 스타일: ${survey.hashtagStyle}`,
    survey.sensitiveDomain !== "없음"
      ? `민감 도메인(${survey.sensitiveDomain}): 권유·강요·단정·보장 표현 금지, 정보 제공형. 가능하면 캡션에 명시적 면책 한 줄.`
      : "",
  ];
  const qualityRules = [
    "[구성] 주어진 아웃라인의 흐름을 따르되 각 장의 본문을 완성한다. 한 장 = 한 가지 생각. 첫 장(index 0)은 스크롤을 멈추는 후킹, 마지막 장은 자연스러운 CTA(값싼 참여유도 금지).",
    "[카피] 문장은 짧고 리듬 있게, 강한 대비, 자연스러운 구어체 한국어. 과장·전문가인 척·SNS 상투어·느낌표 남발 금지. 추상적 동기부여 대신 구체적이고 바로 써먹을 내용. 이모지는 장당 0~1개.",
    "[빈 카피 금지] ★가장 중요 — '핵심 1'·'여기에 한 줄 요약'·'정리했어요' 같은 알맹이 없는 placeholder·메타 표현 절대 금지. 말하지 말고 실제 내용을 써라.",
    "[본문 작성 공식] headline = 그 장의 핵심을 한마디로. body = 쉬운 정의·설명 + 구체 예시나 비유 1개. (○ 'X는 ~라는 뜻이에요. 예를 들면 ~.'  ✗ '핵심을 한 문장으로 정리했어요.')",
    "[사실성] 통계·연구·순위·시장 데이터, 실존 브랜드/매장/곡/종목/날짜를 지어내지 않는다(사용자가 준 데이터만 사용). 확신 없는 고유명사는 단정하지 말고 '예시' 프레임으로 쓰거나 사용자가 채울 자리로 남긴다.",
  ];
  return [
    "당신은 한국어 인스타 카드뉴스 카피라이터입니다. 사용자의 톤을 그대로 살린 ‘수정 가능한 초안’을 만듭니다.",
    `형식: ${format}`,
    ...common,
    ...qualityRules,
    "결과는 JSON 객체만(설명·마크다운·코드펜스 없이). 디자인·색·폰트·HTML은 생성하지 않는다(렌더는 고정 템플릿 담당).",
    "스키마: {title, pages:[{index, headline, body, photoNote}], caption, hashtags:string[8~12], cta}. 각 body 는 1~3문장.",
    "최종 출력 전 스스로 점검(점검 내용은 출력하지 말 것): 한국어만 읽어도 가치가 완전한가? 첫 장이 스크롤을 멈추는가? 각 장이 다음 장을 넘기게 하는가? 지어낸 수치·고유명사는 없는가? CTA가 자연스러운가? 미달이면 고쳐서 낸다.",
  ]
    .filter(Boolean)
    .join("\n");
}

function extractJson(text: string): any {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const c = fenced?.[1] ?? text;
  const s = c.indexOf("{"), e = c.lastIndexOf("}");
  if (s === -1 || e === -1) throw new Error("no json");
  return JSON.parse(c.slice(s, e + 1));
}

async function callClaude(client: Anthropic, system: string, user: string) {
  const t0 = Date.now();
  const res: any = await client.messages.create({ model: MODEL, max_tokens: 4000, system, messages: [{ role: "user", content: user }] });
  const text = res.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
  return { deck: extractJson(text), ms: Date.now() - t0, out: res.usage.output_tokens as number };
}

function esc(s: any): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
}

function deckHtml(tag: string, r: { deck: any; ms: number; out: number }): string {
  const d = r.deck;
  const slides = (d.pages || [])
    .map(
      (p: any, i: number) => `
      <div class="slide">
        <div class="idx">${i + 1} / ${d.pages.length}</div>
        <div class="head">${esc(p.headline)}</div>
        <div class="body">${esc(p.body)}</div>
      </div>`,
    )
    .join("");
  return `
    <div class="col">
      <h3>${esc(tag)} <span class="cost">out ${r.out}tok · ${(r.ms / 1000).toFixed(1)}s</span></h3>
      <div class="rail">${slides}</div>
      <div class="meta">
        <div><b>제목</b> ${esc(d.title)}</div>
        <div><b>캡션</b> ${esc(d.caption)}</div>
        <div><b>해시태그</b> ${esc((d.hashtags || []).join(" "))}</div>
        <div><b>CTA</b> ${esc(d.cta)}</div>
      </div>
    </div>`;
}

function renderHtml(rows: Array<{ label: string; input: Scenario["input"]; a: any; c: any }>): string {
  const sections = rows
    .map(
      (row) => `
    <section>
      <h2>${esc(row.label)}</h2>
      <p class="topic">주제: ${esc(row.input.topicTitle)} · ${row.input.pageCount}장 · 목적 ${esc(row.input.objective)}</p>
      <div class="grid">
        ${deckHtml("A · 현재 라이브 프롬프트", row.a)}
        ${deckHtml("C · P5 신규안", row.c)}
      </div>
    </section>`,
    )
    .join("");

  return `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<title>프롬프트 A vs C 텍스트 품질 비교</title>
<style>
  body{font-family:'Pretendard','Apple SD Gothic Neo',system-ui,sans-serif;margin:0;background:#eeece6;color:#1b1a17}
  header{padding:26px 32px;background:#fff;border-bottom:1px solid #ddd9cf}
  header h1{margin:0 0 6px;font-size:22px}
  header p{margin:0;color:#6f6a5e;font-size:14px}
  section{padding:24px 32px;border-bottom:1px solid #ddd9cf}
  h2{font-size:18px;margin:0 0 2px}
  .topic{margin:0 0 16px;color:#6f6a5e;font-size:13px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:22px}
  .col h3{font-size:15px;margin:0 0 10px}
  .cost{font-size:12px;font-weight:400;color:#a49c8c}
  .rail{display:flex;gap:12px;overflow-x:auto;padding-bottom:8px}
  .slide{flex:0 0 220px;height:260px;background:#f6f3ec;color:#1b1a17;border:1px solid #e2ddd0;border-radius:18px;
    padding:20px;box-sizing:border-box;display:flex;flex-direction:column;box-shadow:0 2px 10px rgba(0,0,0,.06)}
  .idx{font-size:11px;color:#ef5a35;font-weight:700;margin-bottom:10px}
  .head{font-size:17px;font-weight:800;line-height:1.3;margin-bottom:10px;word-break:keep-all}
  .body{font-size:13px;line-height:1.55;color:#4a463d;overflow:auto;word-break:keep-all}
  .meta{margin-top:12px;font-size:12.5px;color:#4a463d;line-height:1.65;background:#fbfaf6;border-radius:12px;padding:12px 14px}
  .meta b{display:inline-block;min-width:60px;color:#ef5a35}
  @media(max-width:900px){.grid{grid-template-columns:1fr}}
</style></head>
<body>
<header>
  <h1>🃏 프롬프트 A(현재) vs C(P5 신규) 텍스트 품질 비교</h1>
  <p>같은 주제·같은 계정 설정으로 두 시스템 프롬프트만 바꿔 실제 생성한 결과입니다. 카드는 옆으로 스크롤하세요. (아웃라인 없이 제작 프롬프트 단독 호출)</p>
</header>
${sections}
</body></html>`;
}

async function main() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    console.error("❌ ANTHROPIC_API_KEY 없음 (.env.local 에 넣어주세요).");
    process.exit(1);
  }
  const client = new Anthropic({ apiKey: key });

  const rows: Array<{ label: string; input: Scenario["input"]; a: any; c: any }> = [];
  for (const sc of SCENARIOS) {
    const user = JSON.stringify({
      주제: sc.input.topicTitle,
      형식: sc.input.format,
      목적: sc.input.objective,
      페이지수: sc.input.pageCount,
      핵심메시지: sc.input.keyMessage,
      톤미세조정: "(없음)",
      아웃라인: "(없음)",
    });
    console.log(`🧪 ${sc.label} 생성 중...`);
    const [a, c] = await Promise.all([
      callClaude(client, cardSystemPrompt(sc.survey, sc.input.format), user),
      callClaude(client, cardSystemPromptC(sc.survey, sc.input.format), user),
    ]);
    rows.push({ label: sc.label, input: sc.input, a, c });
    console.log(`   ✅ A out ${a.out}tok / C out ${c.out}tok`);
  }

  const outDir = path.join(process.cwd(), "out");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "prompt-comparison.html");
  fs.writeFileSync(outPath, renderHtml(rows), "utf8");
  console.log(`\n📄 렌더 완료 → ${outPath}\n   브라우저로 여세요.`);
}

main().catch((e) => {
  console.error("❌", e instanceof Error ? e.message : e);
  process.exit(1);
});
