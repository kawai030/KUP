import "@/scripts/load-env";
import fs from "node:fs";
import path from "node:path";
import { generateStrategy, generatePlanOutline, generateCard, type CardGenInput } from "@/lib/workspace/ai";
import type { ContentObjective, SurveyProfile } from "@/lib/workspace/types";

/**
 * 진짜 프로덕션 체인 검증: P2(전략) → 주제 클릭 → P4(기획) → P5(제작).
 * 목적: P2 연동 후에도 P4/P5 단독 검증 때의 품질이 유지되는가.
 * 각 계정에서 전략 topics 중 대표 1건을 골라 실제 openAdd 흐름대로 카드까지 만든다.
 *   npx tsx scripts/verify-live-chain.ts   →   out/live-verify-chain.html
 */
function survey(over: Partial<SurveyProfile>): SurveyProfile {
  return {
    niche: "라이프스타일", followers: 600, goals: ["브랜딩"], weeklyCapacity: 3,
    brandKeywords: ["큐레이션"],
    voiceExample: "다정한 존댓말(~예요/~해요)", forbiddenExpressions: [], captionLength: "보통",
    hashtagStyle: "주제 관련 위주", sensitiveDomain: "없음", ...over,
  };
}
const OBJ: ContentObjective[] = ["조회", "저장", "공유", "방문", "문의", "팔로우", "댓글"];
const mapGoal = (g: string): ContentObjective => (OBJ.find((o) => o === g) as ContentObjective) || "저장";

const CASES: { label: string; pick: string; survey: SurveyProfile }[] = [
  { label: "① 홈트(누적·건강민감)", pick: "층간소음|무소음|하체|스트레칭|운동", survey: survey({ niche: "홈트레이닝", followers: 480, weeklyCapacity: 2, brandKeywords: ["홈트", "맨몸운동"], voiceExample: "활기차고 친근한 존댓말(~해요/~해봐요)", sensitiveDomain: "의료·건강·다이어트" }) },
  { label: "② 드라마(추천/리스트·실물환각)", pick: "완결|모음|추천|드라마|정주행", survey: survey({ niche: "드라마·영화 큐레이션", followers: 2200, weeklyCapacity: 5, goals: ["브랜딩", "협찬"], brandKeywords: ["넷플릭스추천", "정주행"], voiceExample: "다정하고 몰입감 있는 존댓말" }) },
  { label: "③ 수제청 공방(노하우·수익화)", pick: "곰팡이|실패|원인|조합|과정", survey: survey({ niche: "수제청·홈카페 공방", followers: 3400, weeklyCapacity: 4, goals: ["매출", "문의"], brandKeywords: ["수제청", "클래스"], voiceExample: "다정하고 솔직한 존댓말" }) },
];

async function runCase(c: (typeof CASES)[number]) {
  const strat = await generateStrategy(c.survey, c.survey.followers);
  const re = new RegExp(c.pick);
  const topic = strat.topics.find((t) => re.test(t.title)) ?? strat.topics[0];
  if (!topic) throw new Error("전략 topics 비어 있음");
  const input: CardGenInput = {
    topicSource: "추천", topicTitle: topic.title, format: "카드뉴스",
    objective: mapGoal(topic.goal), pageCount: 5, keyMessage: "",
  };
  const outline = await generatePlanOutline(c.survey, input);
  const deck = await generateCard(c.survey, input, outline.pages);
  return { c, topic, input, outline, deck };
}

function esc(s: string) { return String(s ?? "").replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[ch]!)); }
function renderHtml(rows: any[]) {
  const sections = rows.map((r) => {
    const slides = (r.deck.pages || []).map((p: any, i: number) => `<div class="slide"><div class="idx">${i + 1}/${r.deck.pages.length}</div><div class="head">${esc(p.headline)}</div><div class="body">${esc(p.body)}</div></div>`).join("");
    const ol = (r.outline.pages || []).map((o: any, i: number) => `${i + 1}. ${esc(o.headline)}`).join("　·　");
    return `<section><h2>${esc(r.c.label)} <span class="by">P2·${r.outline.generatedBy}→P5·${r.deck.generatedBy}</span></h2>
      <p class="topic"><b>P2 선택 주제</b> ${esc(r.topic.title)} <span class="goal">goal=${esc(r.topic.goal)}→목적 ${esc(r.input.objective)}</span></p>
      <p class="ol"><b>P4 아웃라인</b> ${ol}</p>
      <div class="rail">${slides}</div>
      <div class="meta"><div><b>제목</b> ${esc(r.deck.title)}</div><div><b>캡션</b> ${esc(r.deck.caption)}</div><div><b>해시</b> ${esc((r.deck.hashtags || []).join(" "))}</div><div><b>CTA</b> ${esc(r.deck.cta)}</div></div></section>`;
  }).join("");
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>P2→P4→P5 체인 검증</title><style>
    body{font-family:'Pretendard','Apple SD Gothic Neo',system-ui,sans-serif;margin:0;background:#eeece6;color:#1b1a17}
    header{padding:26px 32px;background:#fff;border-bottom:1px solid #ddd9cf}header h1{margin:0 0 6px;font-size:22px}header p{margin:0;color:#6f6a5e;font-size:14px}
    section{padding:22px 32px;border-bottom:1px solid #ddd9cf}h2{font-size:18px;margin:0 0 6px}.by{font-size:11px;color:#0a7;background:#e5f5ee;padding:2px 8px;border-radius:10px;vertical-align:middle}
    .topic{margin:0 0 4px;font-size:13px;color:#3a3730}.goal{color:#ef5a35;font-size:12px;margin-left:6px}
    .ol{margin:0 0 14px;color:#8a7a5c;font-size:12px;line-height:1.6}.ol b{color:#6f6a5e}
    .rail{display:flex;gap:12px;overflow-x:auto;padding-bottom:8px}
    .slide{flex:0 0 220px;height:250px;background:#f6f3ec;border:1px solid #e2ddd0;border-radius:18px;padding:20px;box-sizing:border-box;display:flex;flex-direction:column;box-shadow:0 2px 10px rgba(0,0,0,.06)}
    .idx{font-size:11px;color:#ef5a35;font-weight:700;margin-bottom:10px}.head{font-size:16px;font-weight:800;line-height:1.3;margin-bottom:10px;word-break:keep-all}
    .body{font-size:12.5px;line-height:1.55;color:#4a463d;overflow:auto;word-break:keep-all}
    .meta{margin-top:12px;font-size:12px;color:#4a463d;line-height:1.6;background:#fbfaf6;border-radius:12px;padding:10px 12px}.meta b{color:#ef5a35;min-width:44px;display:inline-block}
    </style></head><body><header><h1>🔗 P2→P4→P5 전체 체인 검증</h1>
    <p>전략이 만든 주제를 실제 클릭 흐름대로 기획·제작까지. P2 연동 후에도 P4/P5 품질이 유지되는지 확인.</p></header>${sections}</body></html>`;
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) { console.error("❌ ANTHROPIC_API_KEY 없음"); process.exit(1); }
  console.log(`🔗 ${CASES.length}개 계정 P2→P4→P5 체인 생성 중(순차)...\n`);
  const rows: any[] = [];
  for (const c of CASES) {
    try { rows.push(await runCase(c)); } catch (e: any) { console.error(`❌ ${c.label}: ${e.message}`); rows.push(null); }
  }
  for (const r of rows) {
    if (!r) continue;
    console.log(`\n${"═".repeat(72)}\n▌ ${r.c.label}  [P4=${r.outline.generatedBy}, P5=${r.deck.generatedBy}]\n${"═".repeat(72)}`);
    console.log(`P2 주제: ${r.topic.title}  (goal=${r.topic.goal}→목적 ${r.input.objective})`);
    console.log(`제목: ${r.deck.title}`);
    (r.deck.pages || []).forEach((p: any, i: number) => { console.log(`  [${i}] ${p.headline}`); if (p.body) console.log(`      ${String(p.body).replace(/\n/g, "\n      ")}`); });
    console.log(`  캡션: ${r.deck.caption}`);
    console.log(`  CTA: ${r.deck.cta}`);
  }
  const outDir = path.join(process.cwd(), "out"); fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "live-verify-chain.html");
  fs.writeFileSync(outPath, renderHtml(rows.filter(Boolean)), "utf8");
  const fell = rows.filter(Boolean).filter((r: any) => r.deck.generatedBy !== "ai" || r.outline.generatedBy !== "ai");
  console.log(`\n📄 렌더 완료 → ${outPath}`);
  console.log(fell.length ? `⚠️ 폴백 발생: ${fell.map((r: any) => r.c.label).join(", ")}` : `✅ 전 체인 generatedBy=ai (폴백 없음)`);
}
main().catch((e) => { console.error("❌", e instanceof Error ? e.message : e); process.exit(1); });
