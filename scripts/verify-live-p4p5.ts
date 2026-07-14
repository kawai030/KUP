import "@/scripts/load-env";
import fs from "node:fs";
import path from "node:path";
import { generatePlanOutline, generateCard, type CardGenInput } from "@/lib/workspace/ai";
import type { CardFormat, ContentObjective, SurveyProfile } from "@/lib/workspace/types";

/**
 * 커밋 4b80ab8(P4 기획 + P5 제작)로 반영된 **라이브 함수**를 실제 Claude 키로 태워
 * 최종 육안검증. harness의 makeSystem 사본이 아니라 app/api가 부르는 ai.ts 함수 그대로.
 *
 * 체인(라이브와 동일):
 *   카드뉴스 = generatePlanOutline(P4) → generateCard(survey, input, outline.pages)(P5)
 *   릴스      = generateCard 바로 (기획 건너뜀)
 *
 *   npx tsx scripts/verify-live-p4p5.ts   →   out/live-verify-p4p5.html
 */

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
    label: "① 청년 재테크 (금융·민감)", stress: "정책명·금액·신청기한 환각(변동) 회피 + 제도 리스트 실명 + 면책",
    survey: survey({ niche: "사회초년생 재테크", followers: 820, brandKeywords: ["청년정책", "월급관리"], voiceExample: "담백하고 정보형 존댓말", sensitiveDomain: "금융·투자·부동산" }),
    input: { topicTitle: "사회초년생이 챙겨야 할 청년 지원 제도", format: "카드뉴스", objective: "저장", pageCount: 6, keyMessage: "몰라서 못 받는 지원을 정리" },
  },
  {
    label: "② 드라마 큐레이터 (유명 실물)", stress: "추천/리스트형 → 중간 슬라이드가 실제 작품 1개씩 실명(서사아크로 뭉개지지 않음)",
    survey: survey({ niche: "드라마·영화 큐레이션", followers: 1200, brandKeywords: ["넷플릭스추천", "정주행"], voiceExample: "다정하고 몰입감 있는 존댓말" }),
    input: { topicTitle: "여운 오래 남는 넷플릭스 드라마 추천", format: "카드뉴스", objective: "저장", pageCount: 5, keyMessage: "엔딩 후에도 생각나는 작품" },
  },
  {
    label: "③ 자기계발 (인용)", stress: "명언 출처 오귀속(misattribution) 회피",
    survey: survey({ niche: "동기부여 큐레이션", followers: 430, brandKeywords: ["명언", "자기계발"], voiceExample: "단단하고 담백한 존댓말" }),
    input: { topicTitle: "월요일 아침 동기부여 명언", format: "카드뉴스", objective: "저장", pageCount: 5, keyMessage: "출근길에 곱씹을 한 문장" },
  },
  {
    label: "④ 홈트 코치 (릴스 분기)", stress: "릴스=기획 건너뛰고 generateCard 직접 + 노하우 정확성·건강 면책",
    survey: survey({ niche: "홈트레이닝", followers: 540, brandKeywords: ["홈트", "맨몸운동"], voiceExample: "활기차고 친근한 존댓말(~해요/~해봐요)", sensitiveDomain: "의료·건강·다이어트" }),
    input: { topicTitle: "앉아서 하는 등·목 통증 스트레칭", format: "릴스", objective: "저장", pageCount: 5, keyMessage: "오래 앉아 굳은 등·목을 3분에 푼다" },
  },
];

async function runPersona(p: Persona) {
  const input: CardGenInput = { topicSource: "직접입력", ...p.input };
  const isReels = p.input.format === "릴스";
  const outline = isReels ? undefined : await generatePlanOutline(p.survey, input);
  const deck = await generateCard(p.survey, input, outline?.pages);
  return { persona: p, outline: outline ?? null, deck };
}

function esc(s: string) { return String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!)); }

function renderHtml(rows: any[]) {
  const sections = rows.map((r) => {
    const slides = (r.deck.pages || []).map((p: any, i: number) =>
      `<div class="slide"><div class="idx">${i + 1}/${r.deck.pages.length}</div><div class="head">${esc(p.headline)}</div><div class="body">${esc(p.body)}</div></div>`).join("");
    const ol = (r.outline?.pages || []).map((o: any, i: number) => `${i + 1}. ${esc(o.headline)}`).join("　·　") || "<i>(릴스 — 기획 건너뜀)</i>";
    return `<section><h2>${esc(r.persona.label)} <span class="by">${r.deck.generatedBy}</span></h2>
      <p class="stress">🎯 ${esc(r.persona.stress)}</p>
      <p class="topic">주제: ${esc(r.persona.input.topicTitle)} · ${r.persona.input.pageCount}장 · ${esc(r.persona.input.format)} · 문체: ${esc(r.persona.survey.voiceExample)}${r.persona.survey.sensitiveDomain !== "없음" ? ` · 민감:${esc(r.persona.survey.sensitiveDomain)}` : ""}</p>
      <p class="ol"><b>기획 아웃라인(P4)</b> ${ol}</p>
      <div class="rail">${slides}</div>
      <div class="meta"><div><b>제목</b> ${esc(r.deck.title)}</div><div><b>캡션</b> ${esc(r.deck.caption)}</div><div><b>해시태그</b> ${esc((r.deck.hashtags || []).join(" "))}</div><div><b>CTA</b> ${esc(r.deck.cta)}</div></div></section>`;
  }).join("");
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>라이브 P4/P5 육안검증</title><style>
    body{font-family:'Pretendard','Apple SD Gothic Neo',system-ui,sans-serif;margin:0;background:#eeece6;color:#1b1a17}
    header{padding:26px 32px;background:#fff;border-bottom:1px solid #ddd9cf}header h1{margin:0 0 6px;font-size:22px}header p{margin:0;color:#6f6a5e;font-size:14px}
    section{padding:22px 32px;border-bottom:1px solid #ddd9cf}h2{font-size:18px;margin:0 0 2px}.by{font-size:11px;color:#0a7;background:#e5f5ee;padding:2px 8px;border-radius:10px;vertical-align:middle}
    .stress{margin:0 0 2px;color:#c0392b;font-size:13px}.topic{margin:0 0 6px;color:#6f6a5e;font-size:13px}
    .ol{margin:0 0 14px;color:#8a7a5c;font-size:12px;line-height:1.6}.ol b{color:#6f6a5e}
    .rail{display:flex;gap:12px;overflow-x:auto;padding-bottom:8px}
    .slide{flex:0 0 220px;height:250px;background:#f6f3ec;border:1px solid #e2ddd0;border-radius:18px;padding:20px;box-sizing:border-box;display:flex;flex-direction:column;box-shadow:0 2px 10px rgba(0,0,0,.06)}
    .idx{font-size:11px;color:#ef5a35;font-weight:700;margin-bottom:10px}.head{font-size:16px;font-weight:800;line-height:1.3;margin-bottom:10px;word-break:keep-all}
    .body{font-size:12.5px;line-height:1.55;color:#4a463d;overflow:auto;word-break:keep-all}
    .meta{margin-top:12px;font-size:12px;color:#4a463d;line-height:1.6;background:#fbfaf6;border-radius:12px;padding:10px 12px}.meta b{color:#ef5a35;min-width:56px;display:inline-block}
    </style></head><body><header><h1>✅ 라이브 P4/P5 육안검증 (커밋 4b80ab8 · ai.ts 실함수)</h1>
    <p>app/api/cards가 부르는 라이브 함수 그대로 실 Claude 키로 체인 생성. generatedBy=ai 여야 폴백 아님.</p></header>${sections}</body></html>`;
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) { console.error("❌ ANTHROPIC_API_KEY 없음"); process.exit(1); }
  console.log(`🧪 ${PERSONAS.length}개 페르소나 라이브 P4→P5 체인 생성 중...\n`);
  const rows = await Promise.all(PERSONAS.map((p) => runPersona(p).catch((e) => { console.error(`❌ ${p.label}: ${e.message}`); return null; })));

  for (const r of rows) {
    if (!r) continue;
    console.log(`\n${"═".repeat(70)}\n▌ ${r.persona.label}  [generatedBy=${r.deck.generatedBy}]\n${"═".repeat(70)}`);
    console.log(`제목: ${r.deck.title}`);
    (r.deck.pages || []).forEach((p: any, i: number) => {
      console.log(`  [${i}] ${p.headline}`);
      if (p.body) console.log(`      ${String(p.body).replace(/\n/g, "\n      ")}`);
    });
    console.log(`  캡션: ${r.deck.caption}`);
    console.log(`  CTA: ${r.deck.cta}`);
  }

  const outDir = path.join(process.cwd(), "out"); fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "live-verify-p4p5.html");
  fs.writeFileSync(outPath, renderHtml(rows.filter(Boolean)), "utf8");
  const fell = rows.filter(Boolean).filter((r: any) => r.deck.generatedBy !== "ai").map((r: any) => r.persona.label);
  console.log(`\n📄 렌더 완료 → ${outPath}`);
  if (fell.length) console.log(`⚠️  폴백(template)으로 빠진 페르소나: ${fell.join(", ")}`);
  else console.log(`✅ 전원 generatedBy=ai (폴백 없음)`);
}
main().catch((e) => { console.error("❌", e instanceof Error ? e.message : e); process.exit(1); });
