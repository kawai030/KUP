import "@/scripts/load-env";
import fs from "node:fs";
import path from "node:path";
import { generatePlanOutline, generateCard, type CardGenInput } from "@/lib/workspace/ai";
import type { ContentObjective, SurveyProfile } from "@/lib/workspace/types";

/**
 * A/B ablation: 같은 주제를 (A) 풀 설문 vs (B) 최소·빈 설문 으로 P4→P5 생성 후 비교.
 * 질문: 하류(P4/P5)의 설문 조향이 품질에 도움인가, 무해한가, 해인가.
 *   - B가 이미 충분 → 실속은 주제·규칙이 담당(설문=폴리시). soft로 안심.
 *   - A가 확연히 나음(더 이 사람답고 안전) → 설문 가치 입증.
 *   - A가 더 나쁨(뭉툭·부자연·키워드스터핑) → 조향 과잉 → 완화.
 *   npx tsx scripts/verify-live-ablation.ts   →   out/live-verify-ablation.html
 */
function base(over: Partial<SurveyProfile>): SurveyProfile {
  return {
    niche: "", followers: 600, goals: ["브랜딩"], weeklyCapacity: 2,
    brandKeywords: [],
    voiceExample: "", forbiddenExpressions: [], captionLength: "보통",
    hashtagStyle: "주제 관련 위주", sensitiveDomain: "없음", ...over,
  };
}

interface Trial { label: string; topic: string; objective: ContentObjective; pageCount: number; full: SurveyProfile; }
const MINIMAL = base({}); // 니치·키워드·톤·민감도 전부 빔 — "주제만 넣은" 상태

const TRIALS: Trial[] = [
  {
    label: "① 건강·민감(면책·톤 검증)", topic: "앉아서 하는 등·목 통증 스트레칭", objective: "저장", pageCount: 5,
    full: base({ niche: "홈트레이닝", brandKeywords: ["홈트", "맨몸운동"], voiceExample: "활기차고 친근한 존댓말(~해요/~해봐요)", sensitiveDomain: "의료·건강·다이어트", forbiddenExpressions: ["대박", "완벽"] }),
  },
  {
    label: "② 추천/실물(실속이 설문 없이도 서나)", topic: "여운 오래 남는 넷플릭스 드라마 추천", objective: "저장", pageCount: 5,
    full: base({ niche: "드라마·영화 큐레이션", brandKeywords: ["넷플릭스추천", "정주행"], voiceExample: "다정하고 몰입감 있는 존댓말" }),
  },
];

async function gen(topic: string, objective: ContentObjective, pageCount: number, survey: SurveyProfile) {
  const input: CardGenInput = { topicSource: "직접입력", topicTitle: topic, format: "카드뉴스", objective, pageCount, keyMessage: "" };
  const outline = await generatePlanOutline(survey, input);
  const deck = await generateCard(survey, input, outline.pages);
  return deck;
}

function esc(s: string) { return String(s ?? "").replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[ch]!)); }
function col(title: string, sub: string, deck: any) {
  const slides = (deck.pages || []).map((p: any, i: number) => `<div class="slide"><div class="idx">${i + 1}</div><div class="head">${esc(p.headline)}</div><div class="body">${esc(p.body)}</div></div>`).join("");
  return `<div class="colwrap"><h3>${esc(title)} <span class="by">${deck.generatedBy}</span></h3><p class="sub">${esc(sub)}</p><div class="rail">${slides}</div>
    <div class="meta"><div><b>제목</b> ${esc(deck.title)}</div><div><b>캡션</b> ${esc(deck.caption)}</div><div><b>CTA</b> ${esc(deck.cta)}</div></div></div>`;
}
function renderHtml(rows: any[]) {
  const sections = rows.map((r) => `<section><h2>${esc(r.label)}</h2><p class="topic">주제(공통): ${esc(r.topic)}</p>
    <div class="cols">${col("A · 풀 설문", "니치·키워드·톤·민감도·금지어·CTA 반영", r.a)}${col("B · 최소 설문", "주제만 (니치·톤·민감도 전부 빔)", r.b)}</div></section>`).join("");
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>A/B ablation — 설문 조향 효과</title><style>
    body{font-family:'Pretendard','Apple SD Gothic Neo',system-ui,sans-serif;margin:0;background:#eeece6;color:#1b1a17}
    header{padding:26px 32px;background:#fff;border-bottom:1px solid #ddd9cf}header h1{margin:0 0 6px;font-size:22px}header p{margin:0;color:#6f6a5e;font-size:14px}
    section{padding:22px 32px;border-bottom:1px solid #ddd9cf}h2{font-size:18px;margin:0 0 2px}.topic{margin:0 0 14px;color:#6f6a5e;font-size:13px}
    .cols{display:grid;grid-template-columns:1fr 1fr;gap:20px}
    h3{font-size:14px;margin:0 0 2px}.by{font-size:11px;color:#0a7;background:#e5f5ee;padding:1px 7px;border-radius:10px}.sub{margin:0 0 10px;color:#8a7a5c;font-size:12px}
    .rail{display:flex;gap:10px;overflow-x:auto;padding-bottom:8px}
    .slide{flex:0 0 190px;height:230px;background:#f6f3ec;border:1px solid #e2ddd0;border-radius:16px;padding:16px;box-sizing:border-box;display:flex;flex-direction:column}
    .idx{font-size:11px;color:#ef5a35;font-weight:700;margin-bottom:8px}.head{font-size:14px;font-weight:800;line-height:1.3;margin-bottom:8px;word-break:keep-all}
    .body{font-size:12px;line-height:1.5;color:#4a463d;overflow:auto;word-break:keep-all}
    .meta{margin-top:10px;font-size:12px;color:#4a463d;line-height:1.6;background:#fbfaf6;border-radius:12px;padding:10px 12px}.meta b{color:#ef5a35;min-width:40px;display:inline-block}
    </style></head><body><header><h1>⚖️ A/B ablation — 하류 설문 조향의 효과</h1>
    <p>같은 주제, 왼쪽=풀 설문 / 오른쪽=주제만. 실속(정보밀도·실물)이 유지되는지, 설문이 톤·안전·브랜드를 더하는지 비교.</p></header>${sections}</body></html>`;
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) { console.error("❌ ANTHROPIC_API_KEY 없음"); process.exit(1); }
  const rows: any[] = [];
  for (const t of TRIALS) {
    console.log(`\n${"═".repeat(72)}\n▌ ${t.label} — 주제: ${t.topic}\n${"═".repeat(72)}`);
    const a = await gen(t.topic, t.objective, t.pageCount, t.full);
    const b = await gen(t.topic, t.objective, t.pageCount, MINIMAL);
    for (const [tag, d] of [["A 풀설문", a], ["B 최소설문", b]] as const) {
      console.log(`\n─ ${tag} [${d.generatedBy}] · 제목: ${d.title}`);
      (d.pages || []).forEach((p: any, i: number) => { console.log(`  [${i}] ${p.headline} — ${String(p.body).replace(/\n/g, " ")}`); });
      console.log(`  캡션: ${String(d.caption).replace(/\n/g, " ")}`);
      console.log(`  CTA: ${d.cta}`);
    }
    rows.push({ ...t, a, b });
  }
  const outDir = path.join(process.cwd(), "out"); fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "live-verify-ablation.html");
  fs.writeFileSync(outPath, renderHtml(rows), "utf8");
  console.log(`\n📄 렌더 완료 → ${outPath}`);
}
main().catch((e) => { console.error("❌", e instanceof Error ? e.message : e); process.exit(1); });
