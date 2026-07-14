import Anthropic from "@anthropic-ai/sdk";

/**
 * AI 카드 검수기(독립 코어) — 카드 "내용"을 받아 Claude 로 7축 품질/규제 판단을 내린다.
 *
 * 설계 의도: 이 파일은 lib/workspace/* (라이브 검수 로직)를 전혀 건드리지 않는다.
 * 화면 배선(/api/cards/[id]/review + compliance.ts)은 카드 로직 편집이 끝난 뒤 별도로 붙인다.
 * 그래서 입력을 CardNews 타입 통째가 아니라 문자열 몇 개(decoupled)로 받고, 출력도 중립적인
 * 리포트로 돌려준다 → 나중에 ReviewFlag 로 매핑하는 얇은 어댑터만 배선 시점에 작성하면 된다.
 *
 * 판단 기준은 검증된 generateDeck 검수 프롬프트(lib/generate/prompts.reviewUserPrompt)를
 * 카드 형태에 맞게 옮긴 것 — regulatory Precision 우선, 지어낸 사실 적발이 핵심.
 *
 * Claude 호출은 ai.ts 가 다른 워크트리에서 편집 중이므로 의존하지 않고 자체 포함한다(~10줄 중복).
 * 키가 없거나 호출이 실패하면 available:false + 빈 결과 → 라이브 흐름을 절대 깨지 않는다.
 */

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

export type CardReviewInput = {
  title: string;
  pages: { headline: string; body: string }[];
  caption?: string;
  hashtags?: string[];
  cta?: string;
  // 설문 맥락(선택) — 분야 가중·금지어 판단에 사용
  niche?: string;
  sensitiveDomain?: string;
  forbiddenExpressions?: string[];
};

export type ReviewAxis =
  | "factuality"
  | "regulatory"
  | "tone"
  | "request"
  | "completeness"
  | "format"
  | "ux";

export type AxisResult = { status: "pass" | "warn" | "fail"; note: string };

export type CardFinding = {
  slide: string;
  axis: string;
  severity: "block" | "warn";
  issue: string;
  suggestion: string;
};

export type CardReviewReport = {
  /** AI 가 실제로 돌았는지. 키 없거나 실패면 false(→ 라이브는 정규식만으로 진행). */
  available: boolean;
  domain: string;
  axes: Record<ReviewAxis, AxisResult>;
  flags: CardFinding[];
};

const AXES: ReviewAxis[] = [
  "factuality",
  "regulatory",
  "tone",
  "request",
  "completeness",
  "format",
  "ux",
];

function emptyReport(available: boolean): CardReviewReport {
  const pass: AxisResult = { status: "pass", note: "" };
  return {
    available,
    domain: "일반",
    axes: Object.fromEntries(AXES.map((a) => [a, { ...pass }])) as CardReviewReport["axes"],
    flags: [],
  };
}

function client(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}

/** 모델 응답에서 JSON 객체 본문만 추출(코드펜스·서두 텍스트 제거). */
function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced?.[1] ?? text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("no json");
  return JSON.parse(candidate.slice(start, end + 1));
}

function systemPrompt(): string {
  return [
    "너는 인스타그램 카드뉴스 발행 전 검수자다. 작성자의 결과물을 비판적으로 의심하며 점검한다.",
    "결과는 JSON 객체만 출력한다. 설명·마크다운·코드펜스 없이.",
    "오경고는 신뢰를 깎는다 — 애매하면 pass/warn 으로 두고 명백할 때만 fail(Precision 우선).",
  ].join("\n");
}

function userPrompt(input: CardReviewInput): string {
  const card = {
    제목: input.title,
    슬라이드: input.pages.map((p, i) => ({ n: i + 1, 소제목: p.headline, 본문: p.body })),
    캡션: input.caption ?? "",
    해시태그: input.hashtags ?? [],
    CTA: input.cta ?? "",
    분야: input.niche ?? "(미지정)",
    민감도메인: input.sensitiveDomain ?? "없음",
    사용자금지표현: input.forbiddenExpressions ?? [],
  };

  return `[작업] 아래 카드뉴스를 검수해 7축을 채점하고 문제 플래그를 남겨라.
${JSON.stringify(card, null, 2)}

[규제 판단 원칙] regulatory 축은 "표현이 거센지"가 아니라 "검증 가능한 사실·효과를 단정·보장하는지"로 판단하라.
- pass: 주관적 의견·취향·추천("무조건 가야 돼요", "강추", "최고예요"). 열정·과장 자체는 막지 않는다.
- warn: 근거 없이 객관적 우위·효과를 암시("1위", "검증된", 출처 없는 수치) — 회색지대.
- fail: 아래 ①②에 명백히 걸릴 때만. 애매하면 pass/warn.

[fail 근거 — 둘 중 하나에 명백히 해당할 때만]
① 인스타가 실제 삭제하는 해악: 사기·기만, 혐오·차별, 타인 사진·저작물 도용, 해로운 허위정보.
② 한국 법령 위반: 표시광고법(허위·과장·기만), 의료법·건강기능식품법(질병 치료·효능 단정·"부작용 없음"), 자본시장법(투자 권유·수익/원금 보장·확정 수익률).

[분야 가중] 위 '분야'/'민감도메인'으로 강도 조절:
- 음식·맛집·여행·취미·인테리어: 주관적 추천·열정은 자유. ①②에 걸릴 때만 표시.
- 금융·재테크 / 의료·건강·뷰티: 엄격(효과·수익 단정에 민감).
- 협찬·광고 맥락이면 광고 표시(뒷광고) 누락 주의.
- '사용자금지표현'에 든 문구가 있으면 반드시 플래그.

[7개 품질 축 — 각각 pass/warn/fail]
- factuality(필수): 수치·통계·실존 매장/브랜드/종목/날짜를 지어내지 않았나. 초보자가 그대로 따라 하면 실패할 누락 단계(예: 사전 준비)도 여기서 잡아라.
- regulatory(필수): 위 [규제 판단 원칙]대로.
- tone: 채널 톤·페르소나 일관(주관적 추천은 톤 문제 아님), 비속어·은어는 warn.
- request: 제목·주제를 본문이 제대로 반영했나.
- completeness: 표지·본문·마무리 완결, "첫 번째 포인트"·"정리했어요" 같은 빈 표현 없나.
- format: 구성·해시태그·분량 규칙 문제 있으면 fail, 없으면 pass.
- ux: 가독성·분량 적절한가.

[플래그] 문제 있는 축마다 항목을 남겨라. severity 는 fail(①② 명백 위반)이면 "block", warn(회색지대·품질)이면 "warn". slide 는 해당 슬라이드(예 "표지"·"2번"·"캡션"), issue 에 근거, suggestion 에 고칠 방향.

[출력 JSON]  // 판정 등급은 시스템이 계산하니 너는 axes·flags 만 출력하라.
{
  "domain": string,
  "axes": {
    "factuality":   { "status": "pass"|"warn"|"fail", "note": string },
    "regulatory":   { "status": "pass"|"warn"|"fail", "note": string },
    "tone":         { "status": "pass"|"warn"|"fail", "note": string },
    "request":      { "status": "pass"|"warn"|"fail", "note": string },
    "completeness": { "status": "pass"|"warn"|"fail", "note": string },
    "format":       { "status": "pass"|"warn"|"fail", "note": string },
    "ux":           { "status": "pass"|"warn"|"fail", "note": string }
  },
  "flags": [ { "slide": string, "axis": string, "severity": "warn"|"block", "issue": string, "suggestion": string } ]
}`;
}

/** 파싱 결과를 안전한 리포트 형태로 정규화(누락 축은 pass, flags 방어). */
function normalize(raw: unknown): CardReviewReport {
  const report = emptyReport(true);
  if (!raw || typeof raw !== "object") return report;
  const obj = raw as Record<string, unknown>;

  if (typeof obj.domain === "string") report.domain = obj.domain;

  const axes = obj.axes as Record<string, unknown> | undefined;
  if (axes) {
    for (const a of AXES) {
      const v = axes[a] as Record<string, unknown> | undefined;
      const status = v?.status;
      if (status === "pass" || status === "warn" || status === "fail") {
        report.axes[a] = { status, note: typeof v?.note === "string" ? v.note : "" };
      }
    }
  }

  if (Array.isArray(obj.flags)) {
    report.flags = obj.flags
      .map((f): CardFinding | null => {
        if (!f || typeof f !== "object") return null;
        const g = f as Record<string, unknown>;
        const severity = g.severity === "block" ? "block" : "warn";
        const issue = typeof g.issue === "string" ? g.issue : "";
        if (!issue) return null;
        return {
          slide: typeof g.slide === "string" ? g.slide : "",
          axis: typeof g.axis === "string" ? g.axis : "",
          severity,
          issue,
          suggestion: typeof g.suggestion === "string" ? g.suggestion : "",
        };
      })
      .filter((f): f is CardFinding => f !== null);
  }

  return report;
}

/**
 * 카드 내용을 AI로 검수한다. 키 없거나 실패 시 available:false + 빈 리포트(라이브 흐름 안 깨짐).
 */
export async function reviewCard(input: CardReviewInput): Promise<CardReviewReport> {
  const c = client();
  if (!c) return emptyReport(false);

  try {
    const res = await c.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: systemPrompt(),
      messages: [{ role: "user", content: userPrompt(input) }],
    });
    const textBlock = res.content.find((b) => b.type === "text");
    const raw = textBlock && "text" in textBlock ? textBlock.text : "";
    return normalize(extractJson(raw));
  } catch (err) {
    console.error("[card-review] AI 검수 실패 — 정규식 검수만으로 진행:", (err as Error).message);
    return emptyReport(false);
  }
}
