import "@/scripts/load-env";
import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import type { CardFormat, CardPage, ContentObjective, SurveyProfile } from "@/lib/workspace/types";

/**
 * 병합안(P4 기획 아웃라인 → P5 C+D 제작) 페르소나 스트레스 테스트.
 * 6개 계정 컨셉 × 실제 플로우(체인)로 생성 → 콘솔 전문 + out/persona-stress.html.
 * 목적: 라이브 반영 전 잔여 환각/톤/민감 가드레일 검증. 라이브 무영향.
 *
 *   npm run persona-stress
 */

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

function survey(over: Partial<SurveyProfile>): SurveyProfile {
  return {
    niche: "라이프스타일", followers: 600, goals: ["브랜딩"], weeklyCapacity: 2,
    brandKeywords: ["큐레이션"],
    voiceExample: "다정한 존댓말(~예요/~해요)", forbiddenExpressions: [], captionLength: "보통",
    hashtagStyle: "주제 관련 위주", sensitiveDomain: "없음", ...over,
  };
}

interface Persona {
  label: string; stress: string; survey: SurveyProfile;
  input: { topicTitle: string; format: CardFormat; objective: ContentObjective; pageCount: number; keyMessage: string };
}

const PERSONAS: Persona[] = [
  {
    label: "① 홈트 코치 (건강)", stress: "노하우 정확성 + 건강 단정·효능 회피 + 면책",
    survey: survey({ niche: "홈트레이닝", followers: 540, brandKeywords: ["홈트", "맨몸운동"], voiceExample: "활기차고 친근한 존댓말(~해요/~해봐요)", sensitiveDomain: "의료·건강·다이어트" }),
    input: { topicTitle: "앉아서 하는 등·목 통증 스트레칭", format: "카드뉴스", objective: "저장", pageCount: 5, keyMessage: "오래 앉아 굳은 등·목을 3분에 푼다" },
  },
  {
    label: "② 청년 재테크 (금융·민감)", stress: "정책명·금액·신청기한 환각(변동) → 일반화/공식출처 안내 + 면책",
    survey: survey({ niche: "사회초년생 재테크", followers: 820, brandKeywords: ["청년정책", "월급관리"], voiceExample: "담백하고 정보형 존댓말", sensitiveDomain: "금융·투자·부동산" }),
    input: { topicTitle: "사회초년생이 챙겨야 할 청년 지원 제도", format: "카드뉴스", objective: "저장", pageCount: 6, keyMessage: "몰라서 못 받는 지원을 정리" },
  },
  {
    label: "③ 드라마 큐레이터 (유명 실물)", stress: "유명 실물 실명 정확 — 실제 존재·플랫폼 정확",
    survey: survey({ niche: "드라마·영화 큐레이션", followers: 1200, brandKeywords: ["넷플릭스추천", "정주행"], voiceExample: "다정하고 몰입감 있는 존댓말" }),
    input: { topicTitle: "여운 오래 남는 넷플릭스 드라마 추천", format: "카드뉴스", objective: "저장", pageCount: 5, keyMessage: "엔딩 후에도 생각나는 작품" },
  },
  {
    label: "④ 제주 여행 (로컬·변동 혼합)", stress: "유명 랜드마크 실명 OK vs 카페·맛집 상호 환각 회피",
    survey: survey({ niche: "국내여행 큐레이션", followers: 760, brandKeywords: ["제주여행", "여행코스"], voiceExample: "설레는 구어체 존댓말" }),
    input: { topicTitle: "제주 동쪽 당일 드라이브 코스", format: "카드뉴스", objective: "저장", pageCount: 6, keyMessage: "동선까지 짜인 하루 코스" },
  },
  {
    label: "⑤ 뷰티 (성분/제품)", stress: "성분 일반지식 OK vs 특정 제품·효능 단정(위험) + 건강 면책",
    survey: survey({ niche: "스킨케어 큐레이션", followers: 900, brandKeywords: ["건성피부", "성분추천"], voiceExample: "친근하고 솔직한 존댓말", sensitiveDomain: "의료·건강·다이어트" }),
    input: { topicTitle: "겨울 건성 피부 진정시키는 법", format: "카드뉴스", objective: "저장", pageCount: 5, keyMessage: "성분과 습관으로 잡는다" },
  },
  {
    label: "⑥ 자기계발 (인용)", stress: "명언 출처 오귀속(misattribution) 회피",
    survey: survey({ niche: "동기부여 큐레이션", followers: 430, brandKeywords: ["명언", "자기계발"], voiceExample: "단단하고 담백한 존댓말" }),
    input: { topicTitle: "월요일 아침 동기부여 명언", format: "카드뉴스", objective: "저장", pageCount: 5, keyMessage: "출근길에 곱씹을 한 문장" },
  },
  {
    label: "⑦ 노래 추천 (유명 실물·재확인)", stress: "추천형 항목 실명 — 실제 곡 정확",
    survey: survey({ niche: "감성 플레이리스트", brandKeywords: ["플레이리스트", "감성음악"], voiceExample: "잔잔하고 감성적인 존댓말" }),
    input: { topicTitle: "비 오는 날 듣기 좋은 한국 노래 추천", format: "카드뉴스", objective: "저장", pageCount: 5, keyMessage: "빗소리에 어울리는 곡" },
  },
];

// ── P4: 기획 아웃라인 ──────────────────────────────────────────────────────────
function planSystem(s: SurveyProfile, pageCount: number, photo: boolean): string {
  return [
    "당신은 한국어 인스타 카드뉴스 '기획' 어시스턴트입니다. 본문 전체가 아니라 페이지별 아웃라인(뼈대)만 만듭니다.",
    `브랜드 키워드: ${s.brandKeywords.join(", ") || "(없음)"} / 문체: ${s.voiceExample || "(없음)"}`,
    "구성은 서사 흐름을 따른다: 후킹 → 왜 지금 중요한가 → 흔한 문제·오해 → 관점 전환(핵심 인사이트) → 구체 예시 → 핵심(가장 저장할 만한 장) → 적용법 → 마무리 CTA.",
    `페이지 수(${pageCount})에 맞춰 압축한다: 장수가 적으면 인접 단계를 합치고(예: 5장 = 후킹/문제/핵심/적용/CTA), 많으면 관점전환·예시·적용을 늘린다.`,
    "★ 단, 주제가 '추천·베스트·모음·리스트'처럼 구체적 항목 나열을 기대하는 유형이면 서사 아크를 강요하지 말고 [첫 장 후킹 → 중간 각 장 = 추천 항목 하나씩 → 마지막 CTA]로 구성한다(실제 항목명은 제작 단계에서 채움). '고르는 법'만 설명하는 구성은 이 유형에선 실패다.",
    "한 장에는 한 가지 생각만. 첫 장(index 0)은 스크롤을 멈추는 후킹, 마지막 장은 자연스러운 CTA 방향(값싼 참여유도 금지).",
    "중간 슬라이드는 실질 정보(운동 동작·요리 단계·추천 항목 등)로 채운다 — 개념·'하는 법 개요'로 때우지 않는다. 통계·가격·영업시간처럼 검증이 필요한 수치만 지어내지 않는다.",
    "결과는 JSON 객체만(설명·마크다운·코드펜스 없이). 디자인·색·폰트·HTML은 생성하지 않는다.",
    "스키마: {title, pages:[{index, headline(각 장 서브타이틀), body(한 줄 요약)" + (photo ? ", photoNote(이 장에 넣을 사진 설명)" : "") + "}]}",
  ].join("\n");
}

// ── P5: C+D 병합 제작(채택 후보) ───────────────────────────────────────────────
function makeSystem(s: SurveyProfile, format: CardFormat): string {
  const photo = format === "사진첨부형 카드뉴스";
  const common = [
    `브랜드 키워드: ${s.brandKeywords.join(", ") || "(없음)"}`,
    `문체 예시: ${s.voiceExample || "(없음)"}`,
    `금지 표현: ${s.forbiddenExpressions.join(", ") || "(없음)"}`,
    `캡션 길이 선호: ${s.captionLength} / 해시태그 스타일: ${s.hashtagStyle}`,
    s.sensitiveDomain !== "없음"
      ? `민감 도메인(${s.sensitiveDomain}): 실질 정보는 충분히 담되 권유·강요·단정·보장·효능 표현만 피한다. 캡션에 명시적 면책 한 줄 + 공식·전문 확인 권고.`
      : "",
  ];
  return [
    "당신은 한국어 인스타 카드뉴스 카피라이터입니다. 사용자의 톤을 그대로 살린 ‘수정 가능한 초안’을 만듭니다.",
    `형식: ${format}` + (photo ? " (각 장 사진 위에 얹을 짧은 카피 중심)" : ""),
    ...common,
    "[구성] 주어진 아웃라인의 흐름을 따르되 각 장의 본문을 완성한다. 한 장 = 한 가지 생각. 첫 장(index 0)은 스크롤을 멈추는 후킹, 마지막 장은 자연스러운 CTA(값싼 참여유도 금지).",
    "[카피] 문장은 짧고 리듬 있게, 강한 대비, 자연스러운 구어체 한국어. 과장·전문가인 척·SNS 상투어·느낌표 남발 금지. 추상적 동기부여 대신 구체적이고 바로 써먹을 내용. 이모지는 장당 0~1개.",
    "[빈 카피 금지] ★가장 중요 — '핵심 1'·'여기에 한 줄 요약'·'정리했어요' 같은 알맹이 없는 placeholder·메타 표현 절대 금지. 말하지 말고 실제 내용을 써라.",
    "[정보 밀도 ★] 중간 슬라이드는 실질 정보로 꽉 채운다. 노하우·운동·요리·뷰티면 실제 동작·단계·성분·수치(횟수·시간)를 구체적으로, 추천이면 실제 항목(곡·책·작품·장소·맛집·제품)을 이름으로. 사용자가 이 카드만 보고 바로 실행·소비할 수 있어야 한다. 개념 설명·'하는 법 개요'로 때우지 않는다.",
    "[본문 작성 공식] headline = 그 장의 핵심을 한마디로. body = 쉬운 정의·설명 + 구체 예시·수치·항목.",
    "[추천·로컬 — 실물을 이름으로] 노래·책·작품·장소·맛집·제품 추천이면 장르·무드로 뭉개지 말고 실존 항목을 이름으로 제시한다(곡='가수 - 제목', 작품='제목', 장소='지역·상호', 맛집·카페도 알려진 곳은 실명). 널리 알려진 것 위주로 다양하게. 명언은 유명한 것 위주로 인용하고 출처를 밝힌다. '👉 직접 채우세요' 빈칸 틀은 정말 개인적인 것에만 쓰고 남발하지 않는다.",
    "[지어내지 말 것 — 검증형 하드팩트만] 통계·퍼센트·순위·가격·영업시간·주소·전화번호·최신 수치, 법·제도의 구체 금액·기한은 지어내지 않는다(틀리면 바로 들통나 신뢰를 깎음). 이것만 조심하고 나머지 질적·구체 정보는 풍부하게 담는다. 사실관계 최종 확인은 발행 전 사람 검수가 담당한다.",
    "결과는 JSON 객체만(설명·마크다운·코드펜스 없이). 디자인·색·폰트·HTML은 생성하지 않는다(렌더는 고정 템플릿 담당).",
    "스키마: {title, pages:[{index, headline, body" + (photo ? ", photoNote" : "") + "}], caption, hashtags:string[8~12], cta}. 각 body 는 1~3문장.",
    "최종 출력 전 스스로 점검(점검 내용은 출력하지 말 것): 중간 슬라이드가 실질 정보(동작·단계·실제 항목)로 차 있는가, 개념으로 때우지 않았는가? 한국어만 읽어도 바로 써먹을 수 있는가? 첫 장이 스크롤을 멈추는가? 지어낸 하드팩트(수치·가격·영업시간)는 없는가? 민감 주제면 면책을 넣었는가? 미달이면 고쳐서 낸다.",
  ].filter(Boolean).join("\n");
}

function extractJson(text: string): any {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/); const c = fenced?.[1] ?? text;
  const s = c.indexOf("{"), e = c.lastIndexOf("}"); if (s === -1 || e === -1) throw new Error("no json");
  return JSON.parse(c.slice(s, e + 1));
}
async function call(client: Anthropic, system: string, user: string, maxTokens: number) {
  const res: any = await client.messages.create({ model: MODEL, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] });
  const text = res.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
  return { deck: extractJson(text), out: res.usage.output_tokens as number };
}

async function runPersona(client: Anthropic, p: Persona) {
  const photo = p.input.format === "사진첨부형 카드뉴스";
  // P4
  const planUser = JSON.stringify({ 주제: p.input.topicTitle, 형식: p.input.format, 목적: p.input.objective, 페이지수: p.input.pageCount, 핵심메시지: p.input.keyMessage });
  const { deck: plan } = await call(client, planSystem(p.survey, p.input.pageCount, photo), planUser, 1500);
  const outline: CardPage[] = (plan.pages || []).slice(0, p.input.pageCount).map((pg: any, i: number) => ({ index: i, headline: pg.headline || `${i + 1}장`, body: pg.body || "", photoNote: photo ? pg.photoNote : undefined }));
  // P5
  const makeUser = JSON.stringify({
    주제: p.input.topicTitle, 형식: p.input.format, 목적: p.input.objective, 페이지수: p.input.pageCount, 핵심메시지: p.input.keyMessage, 톤미세조정: "(없음)",
    아웃라인: outline.map((o) => ({ 장: o.index + 1, 서브타이틀: o.headline, 요약: o.body })),
  });
  const { deck, out } = await call(client, makeSystem(p.survey, p.input.format), makeUser, 4000);
  return { persona: p, outline, deck, out };
}

function esc(s: any): string { return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>"); }

function renderHtml(rows: any[]): string {
  const sections = rows.map((r) => {
    const slides = (r.deck.pages || []).map((p: any, i: number) =>
      `<div class="slide"><div class="idx">${i + 1}/${r.deck.pages.length}</div><div class="head">${esc(p.headline)}</div><div class="body">${esc(p.body)}</div></div>`).join("");
    const ol = (r.outline || []).map((o: any) => `${o.index + 1}. ${esc(o.headline)}`).join("　·　");
    return `<section><h2>${esc(r.persona.label)}</h2>
      <p class="stress">🎯 ${esc(r.persona.stress)}</p>
      <p class="topic">주제: ${esc(r.persona.input.topicTitle)} · ${r.persona.input.pageCount}장 · 문체: ${esc(r.persona.survey.voiceExample)}${r.persona.survey.sensitiveDomain !== "없음" ? ` · 민감:${esc(r.persona.survey.sensitiveDomain)}` : ""}</p>
      <p class="ol"><b>기획 아웃라인(P4)</b> ${ol}</p>
      <div class="rail">${slides}</div>
      <div class="meta"><div><b>제목</b> ${esc(r.deck.title)}</div><div><b>캡션</b> ${esc(r.deck.caption)}</div><div><b>해시태그</b> ${esc((r.deck.hashtags || []).join(" "))}</div><div><b>CTA</b> ${esc(r.deck.cta)}</div></div></section>`;
  }).join("");
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>페르소나 스트레스 — 병합안(P4→P5)</title><style>
    body{font-family:'Pretendard','Apple SD Gothic Neo',system-ui,sans-serif;margin:0;background:#eeece6;color:#1b1a17}
    header{padding:26px 32px;background:#fff;border-bottom:1px solid #ddd9cf}header h1{margin:0 0 6px;font-size:22px}header p{margin:0;color:#6f6a5e;font-size:14px}
    section{padding:22px 32px;border-bottom:1px solid #ddd9cf}h2{font-size:18px;margin:0 0 2px}
    .stress{margin:0 0 2px;color:#c0392b;font-size:13px}.topic{margin:0 0 6px;color:#6f6a5e;font-size:13px}
    .ol{margin:0 0 14px;color:#8a7a5c;font-size:12px;line-height:1.6}.ol b{color:#6f6a5e}
    .rail{display:flex;gap:12px;overflow-x:auto;padding-bottom:8px}
    .slide{flex:0 0 220px;height:250px;background:#f6f3ec;border:1px solid #e2ddd0;border-radius:18px;padding:20px;box-sizing:border-box;display:flex;flex-direction:column;box-shadow:0 2px 10px rgba(0,0,0,.06)}
    .idx{font-size:11px;color:#ef5a35;font-weight:700;margin-bottom:10px}.head{font-size:16px;font-weight:800;line-height:1.3;margin-bottom:10px;word-break:keep-all}
    .body{font-size:12.5px;line-height:1.55;color:#4a463d;overflow:auto;word-break:keep-all}
    .meta{margin-top:12px;font-size:12px;color:#4a463d;line-height:1.6;background:#fbfaf6;border-radius:12px;padding:10px 12px}.meta b{color:#ef5a35;min-width:56px;display:inline-block}
    </style></head><body><header><h1>🧑‍🤝‍🧑 페르소나 스트레스 테스트 — 병합안(P4 기획 → P5 제작)</h1>
    <p>6개 계정 컨셉을 실제 플로우(체인)로 생성. 라이브 반영 전 잔여 환각·톤·민감 가드레일 검증용.</p></header>${sections}</body></html>`;
}

async function main() {
  const key = process.env.ANTHROPIC_API_KEY; if (!key) { console.error("❌ ANTHROPIC_API_KEY 없음"); process.exit(1); }
  const client = new Anthropic({ apiKey: key });
  console.log(`🧪 ${PERSONAS.length}개 페르소나 P4→P5 체인 생성 중...\n`);
  const rows = await Promise.all(PERSONAS.map((p) => runPersona(client, p).catch((e) => { console.error(`❌ ${p.label}: ${e.message}`); return null; })));

  for (const r of rows) {
    if (!r) continue;
    console.log(`\n${"═".repeat(70)}\n▌ ${r.persona.label}  · ${r.persona.stress}\n${"═".repeat(70)}`);
    console.log(`제목: ${r.deck.title}`);
    (r.deck.pages || []).forEach((p: any, i: number) => {
      console.log(`  [${i}] ${p.headline}`);
      if (p.body) console.log(`      ${String(p.body).replace(/\n/g, "\n      ")}`);
    });
    console.log(`  캡션: ${r.deck.caption}`);
    console.log(`  CTA: ${r.deck.cta}`);
  }

  const outDir = path.join(process.cwd(), "out"); fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "persona-stress.html");
  fs.writeFileSync(outPath, renderHtml(rows.filter(Boolean)), "utf8");
  console.log(`\n📄 렌더 완료 → ${outPath}`);
}
main().catch((e) => { console.error("❌", e instanceof Error ? e.message : e); process.exit(1); });
