import "@/scripts/load-env"; // ⚠️ 최우선 — ANTHROPIC_API_KEY 로드
import Anthropic from "@anthropic-ai/sdk";
import { cardSystemPrompt } from "@/lib/workspace/ai";
import type { SurveyProfile } from "@/lib/workspace/types";

/**
 * 웹서치 그라운딩 프로토타입 (스파이크, 라이브 무영향).
 *
 * 목적: "비 오는 날 노래 추천" 같이 실제 특정 정보가 필요한 주제에서
 *   - 현재 방식(그라운딩 X): 뭉개거나(뻔함) 지어냄(환각)
 *   - 웹서치 그라운딩:        실제 존재하는 곡을 검색해 근거 기반으로 작성
 * 을 나란히 비교해 "진짜 달라지는지"를 눈으로 확인한다.
 *
 *   실행: npm run ground            # 비 오는 날 감성 노래
 *         npm run ground -- books   # 가을에 읽기 좋은 책
 *
 *   ⚠️ .env.local 에 ANTHROPIC_API_KEY 필요 + 콘솔에서 웹서치 활성화 필요.
 */

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

interface Scenario {
  label: string;
  survey: SurveyProfile;
  topicTitle: string;
  keyMessage: string;
  /** 그라운딩 시 무엇을 실제로 찾아야 하는지 (실존성 검증 대상) */
  groundTarget: string;
}

function musicSurvey(over: Partial<SurveyProfile> = {}): SurveyProfile {
  return {
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
    ...over,
  };
}

const SCENARIOS: Record<string, Scenario> = {
  songs: {
    label: "비 오는 날 감성 노래 추천",
    survey: musicSurvey(),
    topicTitle: "비 오는 날 듣기 좋은 감성 노래",
    keyMessage: "빗소리에 어울리는 잔잔한 한국 노래를 모았어요",
    groundTarget: "실존하는 곡(가수 - 제목). 지어낸 곡·잘못된 가수 매칭 금지.",
  },
  books: {
    label: "가을에 읽기 좋은 책 추천",
    survey: musicSurvey({
      niche: "책 큐레이션",
      brandKeywords: ["책추천", "독서기록"],
    }),
    topicTitle: "가을 밤에 읽기 좋은 책",
    keyMessage: "쓸쓸하지만 따뜻한 가을 감성의 책을 골랐어요",
    groundTarget: "실존하는 책(저자 - 제목). 지어낸 책·잘못된 저자 금지.",
  },
};

// ── 출력 스키마는 라이브 A와 동일하게 유지 (pages/caption/hashtags/cta) ──
const OUTPUT_SCHEMA =
  "결과는 JSON 객체만. 스키마: {title, pages:[{index, headline, body}], caption, hashtags:string[8~12], cta}. 첫 장 후킹, 마지막 장 CTA. 각 body 1~3문장.";

// 그라운딩 시스템 프롬프트: A의 톤/스키마를 유지하되 "실제로 검색해서 실존 항목만" 규칙 추가
function groundedSystemPrompt(s: Scenario): string {
  return [
    "당신은 한국어 인스타 카드뉴스 카피라이터입니다. 사용자의 톤을 살린 수정 가능한 초안을 만듭니다.",
    `브랜드 키워드: ${s.survey.brandKeywords.join(", ")} / 문체: ${s.survey.voiceExample}`,
    "",
    "[그라운딩 규칙] ★ 가장 중요",
    `- 이 주제는 실제 특정 정보가 필요합니다: ${s.groundTarget}`,
    "- 반드시 web_search 도구로 먼저 검색해서 '실제로 존재하는' 항목만 사용하세요. 절대 기억이나 추측으로 지어내지 마세요.",
    "- 각 항목은 검색으로 확인된 것이어야 합니다. 확인 안 되면 그 항목을 빼세요.",
    "- 본문(body)에는 항목명(예: '가수 - 곡제목')을 구체적으로 명시하고, 왜 이 주제에 어울리는지 한 줄 덧붙이세요.",
    "",
    OUTPUT_SCHEMA,
  ].join("\n");
}

function extractJson(text: string): any {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced?.[1] ?? text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("응답에서 JSON을 못 찾음");
  return JSON.parse(candidate.slice(start, end + 1));
}

function userPayload(s: Scenario): string {
  return JSON.stringify({
    주제: s.topicTitle,
    형식: "카드뉴스",
    목적: "저장",
    페이지수: 6,
    핵심메시지: s.keyMessage,
  });
}

// ── ① 현재 방식: 그라운딩 없음 (라이브와 동일 프롬프트, 도구 없음) ──
async function runUngrounded(client: Anthropic, s: Scenario) {
  const t0 = Date.now();
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: cardSystemPrompt(s.survey, "카드뉴스"),
    messages: [{ role: "user", content: userPayload(s) }],
  });
  const text = res.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
  return { deck: extractJson(text), ms: Date.now() - t0, searches: 0, usage: res.usage };
}

// ── ② 그라운딩: web_search 도구 활성화 + 서버 루프(pause_turn) 처리 ──
async function runGrounded(client: Anthropic, s: Scenario) {
  const t0 = Date.now();
  // 구버전 SDK(0.40.1)엔 web_search 타입이 없어 any 캐스팅 — 런타임은 API가 처리
  const tools: any = [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }];
  const messages: any[] = [{ role: "user", content: userPayload(s) }];
  const system = groundedSystemPrompt(s);

  let searches = 0;
  let res: any;
  for (let guard = 0; guard < 6; guard++) {
    res = await client.messages.create({ model: MODEL, max_tokens: 3000, system, messages, tools } as any);
    searches += res.usage?.server_tool_use?.web_search_requests ?? 0;
    if (res.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: res.content }); // 서버 루프 계속
      continue;
    }
    break;
  }
  const text = res.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
  return { deck: extractJson(text), ms: Date.now() - t0, searches, usage: res.usage };
}

function printDeck(tag: string, r: { deck: any; ms: number; searches: number; usage: any }) {
  const d = r.deck;
  const inTok = r.usage?.input_tokens ?? 0;
  const outTok = r.usage?.output_tokens ?? 0;
  console.log(`\n${"═".repeat(66)}`);
  console.log(`▌ ${tag}   (${r.ms}ms · 검색 ${r.searches}회 · in ${inTok}/out ${outTok} tok)`);
  console.log("═".repeat(66));
  console.log(`제목: ${d.title}`);
  (d.pages || []).forEach((p: any, i: number) => {
    console.log(`\n  [${i}] ${p.headline ?? ""}`);
    if (p.body) console.log(`      ${String(p.body).replace(/\n/g, "\n      ")}`);
  });
  console.log(`\n  캡션: ${d.caption ?? ""}`);
  console.log(`  해시태그: ${(d.hashtags || []).join(" ")}`);
  console.log(`  CTA: ${d.cta ?? ""}`);
}

async function main() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    console.error("❌ ANTHROPIC_API_KEY 없음. .env.local 에 넣고 다시 실행하세요.");
    process.exit(1);
  }
  const which = (process.argv[2] || "songs").toLowerCase();
  const scenario = SCENARIOS[which];
  if (!scenario) {
    console.error(`❌ 알 수 없는 시나리오 '${which}'. 사용 가능: ${Object.keys(SCENARIOS).join(", ")}`);
    process.exit(1);
  }

  const client = new Anthropic({ apiKey: key });
  console.log(`\n🧪 시나리오: ${scenario.label}`);
  console.log(`   주제: ${scenario.topicTitle} / 모델: ${MODEL}`);
  console.log(`   검증 대상: ${scenario.groundTarget}`);

  let ungrounded, grounded;
  try {
    ungrounded = await runUngrounded(client, scenario);
    printDeck("① 현재 방식 (그라운딩 없음)", ungrounded);
  } catch (e) {
    console.error("① 현재 방식 실패:", e instanceof Error ? e.message : e);
  }
  try {
    grounded = await runGrounded(client, scenario);
    printDeck("② 웹서치 그라운딩", grounded);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("② 그라운딩 실패:", msg);
    if (/web.?search|tool|permission|not.?enabled|403/i.test(msg)) {
      console.error("   → 콘솔(claude.com/settings/privacy)에서 웹서치가 활성화됐는지 확인하세요.");
    }
  }

  if (grounded) {
    const cost = (grounded.searches * 10) / 1000; // $10/1000 검색
    console.log(`\n${"─".repeat(66)}`);
    console.log(`💰 이번 그라운딩 생성 검색비: ${grounded.searches}회 × $0.01 = $${cost.toFixed(3)} (토큰 별도)`);
    console.log("👀 ①은 실제 곡/책이 나왔나요, 아니면 뭉갰나요/지어냈나요? ②와 비교하세요.");
  }
}

main().catch((e) => {
  console.error("❌ 실패:", e instanceof Error ? e.message : e);
  process.exit(1);
});
