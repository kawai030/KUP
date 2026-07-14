import "@/scripts/load-env"; // ⚠️ 최우선 — process.env(ANTHROPIC_API_KEY) 채움
import Anthropic from "@anthropic-ai/sdk";
import { cardSystemPrompt } from "@/lib/workspace/ai";
import type { CardFormat, ContentObjective, SurveyProfile } from "@/lib/workspace/types";

/**
 * 카드뉴스 시스템 프롬프트 A/B 비교 하버스 (라이브 무영향, 읽기 전용).
 *
 *   A = 지금 배포된 프롬프트  (lib/workspace/ai.ts 의 cardSystemPrompt — 그대로 import)
 *   B = 시스템 B(lib/generate)의 품질 규칙을 A의 "출력 스키마 그대로"에 이식한 실험 프롬프트
 *
 * 두 프롬프트에 **동일한 user 페이로드**를 넣어 Claude를 각각 호출 → 출력만 나란히 비교.
 * (변수는 오직 시스템 프롬프트 하나. 스키마·모델·입력은 동일.)
 *
 *   실행: npm run compare                 # 기본 시나리오(카페)
 *         npm run compare -- finance      # 재테크(민감 도메인 가드레일 확인)
 *         npm run compare -- reels        # 릴스 대본
 *
 *   ⚠️ 실 호출이라 .env.local 에 ANTHROPIC_API_KEY 필요(없으면 안내 후 종료).
 */

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

// ── 입력(제작 단계 CardGenInput 과 동일 형태) ────────────────────────────────
interface Scenario {
  label: string;
  survey: SurveyProfile;
  input: {
    topicTitle: string;
    format: CardFormat;
    objective: ContentObjective;
    pageCount: number;
    keyMessage: string;
    toneOverride?: string;
  };
}

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

const SCENARIOS: Record<string, Scenario> = {
  cafe: {
    label: "홈카페 · 카드뉴스",
    survey: baseSurvey({}),
    input: {
      topicTitle: "집에서 카페 라떼 맛내는 법",
      format: "카드뉴스",
      objective: "저장",
      pageCount: 5,
      keyMessage: "우유 온도와 거품이 8할이다",
    },
  },
  finance: {
    label: "재테크 · 카드뉴스 (민감 도메인 가드레일)",
    survey: baseSurvey({
      niche: "사회초년생 재테크",
      brandKeywords: ["재테크", "월급관리"],
      sensitiveDomain: "금융·투자·부동산",
      voiceExample: "담백하고 정보형 존댓말",
    }),
    input: {
      topicTitle: "사회초년생 첫 통장 쪼개기",
      format: "카드뉴스",
      objective: "저장",
      pageCount: 5,
      keyMessage: "쓰는 돈과 모으는 돈을 물리적으로 분리한다",
    },
  },
  songs: {
    label: "플레이리스트 · 카드뉴스 (환각 유발 — 실존 곡/가수 지어내나)",
    survey: baseSurvey({
      niche: "감성 플레이리스트 큐레이션",
      brandKeywords: ["플레이리스트", "감성음악"],
      voiceExample: "잔잔하고 감성적인 존댓말",
    }),
    input: {
      topicTitle: "비 오는 날 듣기 좋은 노래 추천",
      format: "카드뉴스",
      objective: "저장",
      pageCount: 5,
      keyMessage: "빗소리에 어울리는 곡을 장면별로 골랐어요",
    },
  },
  reels: {
    label: "홈카페 · 릴스 대본",
    survey: baseSurvey({}),
    input: {
      topicTitle: "라떼아트 하트 만들기",
      format: "릴스",
      objective: "팔로우",
      pageCount: 4,
      keyMessage: "스팀 우유 붓는 각도가 전부",
    },
  },
};

// ── B의 품질 규칙을 A의 출력 스키마에 이식한 실험 프롬프트 ─────────────────────
// (B의 슬라이드 구조 cover/body/outro·글자수 제약은 가져오지 않음 — A의 pages 스키마 유지)
function cardSystemPromptV2(survey: SurveyProfile, format: CardFormat): string {
  const common = [
    `브랜드 키워드: ${survey.brandKeywords.join(", ") || "(없음)"}`,
    `문체 예시: ${survey.voiceExample || "(없음)"}`,
    `금지 표현: ${survey.forbiddenExpressions.join(", ") || "(없음)"}`,
    `캡션 길이 선호: ${survey.captionLength} / 해시태그 스타일: ${survey.hashtagStyle}`,
    survey.sensitiveDomain !== "없음"
      ? `민감 도메인(${survey.sensitiveDomain}): 권유·강요·단정·보장 표현 금지, 정보 제공형 + 면책 뉘앙스.`
      : "",
  ];

  // ↓ 시스템 B(lib/generate/prompts.ts)에서 이식한 "스키마 무관 품질 규칙"
  const qualityRules = [
    "[톤 확장 규칙] 톤·문체가 짧게 주어져도 의도를 구체 문체 규칙으로 스스로 확장해 일관 적용하라.",
    "- 호칭·종결어미는 문체 예시에 맞춰 통일한다. 한 덱 안에서 섞지 않는다.",
    "- 한 문장 = 한 메시지. 카피는 짧고 또렷하게. 이모지는 슬라이드당 0~1개로 절제. 클릭베이트·낚시 금지.",
    "[디테일 원칙] ★ 가장 중요 — 빈 카피 금지",
    "- \"핵심 1\", \"여기에 한 줄 요약\", \"핵심을 한 문장으로 정리했어요\" 같은 내용 없는 placeholder·메타 표현을 절대 쓰지 않는다.",
    "- 모든 장은 독자가 바로 알거나 써먹을 수 있는 구체적 정보·정의·예시·비유를 담는다. \"정리했어요\"라고 말하지 말고 실제로 그 내용을 써라.",
    "[본문 작성 공식]",
    "- headline: 그 장의 핵심을 용어·한마디로 박는다.",
    "- body: 쉬운 정의/설명 + 구체 예시나 비유 1개. (○ \"X는 ~라는 뜻이에요. 예를 들면 ~.\"  ✗ \"핵심을 한 문장으로 정리했어요.\")",
    "[사실성] 수치·통계·효능·실존 브랜드/매장/종목/날짜를 지어내지 않는다. 불확실하면 일반화한다. 과장·허위·클릭베이트 금지.",
  ];

  if (format === "릴스") {
    return [
      "당신은 한국어 인스타 릴스(짧은 세로 영상) 기획자입니다. 사용자가 직접 촬영·편집할 수 있도록 ‘대본’을 짭니다. 영상 자체는 만들지 않습니다.",
      ...common,
      ...qualityRules,
      "결과는 JSON 객체만. 스키마: {title, pages:[{index, headline(구간/장면, 예: '후킹 0~3초'), body(대사·자막 문구), note(화면 연출·동작 지시)}], caption, hashtags:string[8~12], cta}",
      "30~60초 분량. index 0 = 첫 3초 강한 후킹(스크롤 멈추게). 마지막 장면 = 행동 유도(CTA: 팔로우·저장·댓글 등).",
      "각 body 는 실제 말할 대사/화면 자막으로, 1~2문장 짧게. ‘도입’·‘핵심 설명’ 같은 라벨만 쓰지 말고 실제 대사를 써라.",
    ]
      .filter(Boolean)
      .join("\n");
  }
  return [
    "당신은 한국어 인스타 카드뉴스 카피라이터입니다. 사용자의 톤을 그대로 살린 ‘수정 가능한 초안’을 만듭니다.",
    `형식: ${format}` + (format === "사진첨부형 카드뉴스" ? " (각 장 사진 위에 얹을 짧은 카피 중심)" : ""),
    ...common,
    ...qualityRules,
    "결과는 JSON 객체만. 스키마: {title, pages:[{index, headline, body, photoNote}], caption, hashtags:string[8~12], cta}",
    "첫 페이지(index 0)는 강한 후킹(질문형·숫자형·통념반전형 중 1). 마지막 페이지는 행동 유도(CTA). 각 body 는 1~3문장.",
  ]
    .filter(Boolean)
    .join("\n");
}

// ── C: P5 신규안 — "콘텐츠 규칙 코어"(참고 지침 발췌) + B의 빈카피금지/작성공식 병합 ──
// (출력 스키마 그대로. 서사 아크는 P4 아웃라인 담당이라 여기선 아웃라인 준수 + 카피/사실성/자문에 집중)
function cardSystemPromptV3(survey: SurveyProfile, format: CardFormat): string {
  const common = [
    `브랜드 키워드: ${survey.brandKeywords.join(", ") || "(없음)"}`,
    `문체 예시: ${survey.voiceExample || "(없음)"}`,
    `금지 표현: ${survey.forbiddenExpressions.join(", ") || "(없음)"}`,
    `캡션 길이 선호: ${survey.captionLength} / 해시태그 스타일: ${survey.hashtagStyle}`,
    survey.sensitiveDomain !== "없음"
      ? `민감 도메인(${survey.sensitiveDomain}): 권유·강요·단정·보장 표현 금지, 정보 제공형 + 면책 뉘앙스.`
      : "",
  ];

  const qualityRules = [
    "[구성] 주어진 아웃라인의 흐름을 따르되 각 장의 본문을 완성한다. 한 장 = 한 가지 생각. 첫 장(index 0)은 스크롤을 멈추는 후킹, 마지막 장은 자연스러운 CTA(값싼 참여유도 금지).",
    "[카피] 문장은 짧고 리듬 있게, 강한 대비, 자연스러운 구어체 한국어. 과장·전문가인 척·SNS 상투어·느낌표 남발 금지. 추상적 동기부여 대신 구체적이고 바로 써먹을 내용. 이모지는 장당 0~1개.",
    "[빈 카피 금지] ★가장 중요 — '핵심 1'·'여기에 한 줄 요약'·'정리했어요' 같은 알맹이 없는 placeholder·메타 표현 절대 금지. 말하지 말고 실제 내용을 써라.",
    "[본문 작성 공식] headline = 그 장의 핵심을 한마디로. body = 쉬운 정의·설명 + 구체 예시나 비유 1개. (○ 'X는 ~라는 뜻이에요. 예를 들면 ~.'  ✗ '핵심을 한 문장으로 정리했어요.')",
    "[사실성] 통계·연구·순위·시장 데이터, 실존 브랜드/매장/곡/종목/날짜를 지어내지 않는다(사용자가 준 데이터만 사용). 확신 없는 고유명사는 단정하지 말고 '예시' 프레임으로 쓰거나 사용자가 채울 자리로 남긴다.",
  ];

  if (format === "릴스") {
    return [
      "당신은 한국어 인스타 릴스(짧은 세로 영상) 기획자입니다. 사용자가 직접 촬영·편집할 수 있도록 ‘대본’을 짭니다. 영상 자체는 만들지 않습니다.",
      ...common,
      ...qualityRules,
      "결과는 JSON 객체만(설명·마크다운·코드펜스 없이). 디자인·색·폰트·HTML은 생성하지 않는다.",
      "스키마: {title, pages:[{index, headline(구간/장면, 예: '후킹 0~3초'), body(대사·자막 문구), note(화면 연출·동작 지시)}], caption, hashtags:string[8~12], cta}",
      "30~60초 분량. index 0 = 첫 3초 강한 후킹. 마지막 장면 = 행동 유도. 각 body 는 실제 말할 대사/자막으로 1~2문장.",
    ]
      .filter(Boolean)
      .join("\n");
  }
  return [
    "당신은 한국어 인스타 카드뉴스 카피라이터입니다. 사용자의 톤을 그대로 살린 ‘수정 가능한 초안’을 만듭니다.",
    `형식: ${format}` + (format === "사진첨부형 카드뉴스" ? " (각 장 사진 위에 얹을 짧은 카피 중심)" : ""),
    ...common,
    ...qualityRules,
    "결과는 JSON 객체만(설명·마크다운·코드펜스 없이). 디자인·색·폰트·HTML은 생성하지 않는다(렌더는 고정 템플릿 담당).",
    "스키마: {title, pages:[{index, headline, body, photoNote}], caption, hashtags:string[8~12], cta}. 각 body 는 1~3문장.",
    "최종 출력 전 스스로 점검(점검 내용은 출력하지 말 것): 한국어만 읽어도 가치가 완전한가? 첫 장이 스크롤을 멈추는가? 각 장이 다음 장을 넘기게 하는가? 지어낸 수치·고유명사는 없는가? CTA가 자연스러운가? 미달이면 고쳐서 낸다.",
  ]
    .filter(Boolean)
    .join("\n");
}

// ── 공통 플러밍 (ai.ts 의 callClaude/extractJson 과 동일 로직 — 테스트 대상 아님) ──
function extractJson(text: string): any {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced?.[1] ?? text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("no json");
  return JSON.parse(candidate.slice(start, end + 1));
}

async function callClaude(client: Anthropic, system: string, user: string) {
  const t0 = Date.now();
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system,
    messages: [{ role: "user", content: user }],
  });
  const textBlock = res.content.find((b) => b.type === "text");
  const text = textBlock && "text" in textBlock ? textBlock.text : "";
  return {
    deck: extractJson(text),
    ms: Date.now() - t0,
    usage: { in: res.usage.input_tokens, out: res.usage.output_tokens },
  };
}

// ── 출력 렌더 ───────────────────────────────────────────────────────────────
function printDeck(tag: string, r: { deck: any; ms: number; usage: { in: number; out: number } }) {
  const d = r.deck;
  console.log(`\n${"═".repeat(64)}`);
  console.log(`▌ ${tag}   (${r.ms}ms · in ${r.usage.in} / out ${r.usage.out} tok)`);
  console.log("═".repeat(64));
  console.log(`제목: ${d.title}`);
  (d.pages || []).forEach((p: any, i: number) => {
    console.log(`\n  [${i}] ${p.headline ?? ""}`);
    if (p.body) console.log(`      ${String(p.body).replace(/\n/g, "\n      ")}`);
    if (p.note) console.log(`      · 연출: ${p.note}`);
    if (p.photoNote) console.log(`      · 사진: ${p.photoNote}`);
  });
  console.log(`\n  캡션: ${d.caption ?? ""}`);
  console.log(`  해시태그(${(d.hashtags || []).length}): ${(d.hashtags || []).join(" ")}`);
  console.log(`  CTA: ${d.cta ?? ""}`);
}

async function main() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    console.error(
      "❌ ANTHROPIC_API_KEY 없음.\n" +
        "   .env.local 파일에 `ANTHROPIC_API_KEY=sk-...` 한 줄을 넣고 다시 실행하세요.\n" +
        "   (.env.local 은 .gitignore 처리되어 커밋되지 않습니다.)",
    );
    process.exit(1);
  }

  const which = (process.argv[2] || "cafe").toLowerCase();
  const runs = Math.max(1, Math.min(Number(process.argv[3]) || 1, 5)); // 변동성 검증용 반복(최대 5)
  const scenario = SCENARIOS[which];
  if (!scenario) {
    console.error(`❌ 알 수 없는 시나리오 '${which}'. 사용 가능: ${Object.keys(SCENARIOS).join(", ")}`);
    process.exit(1);
  }

  const client = new Anthropic({ apiKey: key });
  const { survey, input } = scenario;
  const user = JSON.stringify({
    주제: input.topicTitle,
    형식: input.format,
    목적: input.objective,
    페이지수: input.pageCount,
    핵심메시지: input.keyMessage,
    톤미세조정: input.toneOverride || "(없음)",
    아웃라인: "(없음)",
  });

  console.log(`\n🧪 시나리오: ${scenario.label}${runs > 1 ? `  (×${runs}회 반복)` : ""}`);
  console.log(`   주제: ${input.topicTitle} / 형식: ${input.format} / 목적: ${input.objective} / ${input.pageCount}장`);
  console.log(`   핵심메시지: ${input.keyMessage}`);
  console.log(`   모델: ${MODEL}`);

  for (let i = 1; i <= runs; i++) {
    const suffix = runs > 1 ? `  [${i}/${runs}회차]` : "";
    // 동일 user, 시스템 프롬프트만 A vs B
    const [a, b, c] = await Promise.all([
      callClaude(client, cardSystemPrompt(survey, input.format), user),
      callClaude(client, cardSystemPromptV2(survey, input.format), user),
      callClaude(client, cardSystemPromptV3(survey, input.format), user),
    ]);
    printDeck(`A · 현재 라이브 프롬프트${suffix}`, a);
    printDeck(`B · (어제) 품질 규칙 이식 실험${suffix}`, b);
    printDeck(`C · (P5 신규) 콘텐츠 규칙 코어 병합${suffix}`, c);
  }
  console.log(`\n${"─".repeat(64)}`);
  console.log("👀 위를 나란히 비교하세요. B가 일관되게 나으면 cardSystemPrompt 에 반영 → PR.");
}

main().catch((e) => {
  console.error("❌ 비교 실패:", e instanceof Error ? e.message : e);
  process.exit(1);
});
