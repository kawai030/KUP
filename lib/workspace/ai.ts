import Anthropic from "@anthropic-ai/sdk";
import { captureException } from "@/lib/sentry";
import type {
  CardFormat,
  CardPage,
  ContentObjective,
  OperationStage,
  Strategy,
  StrategyTopic,
  SurveyProfile,
  TopicSource,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// 생성 엔진. ANTHROPIC_API_KEY 가 있으면 Claude(claude-opus-4-8 기본)로 생성하고,
// 없거나 호출이 실패하면 설문 기반 템플릿으로 자동 대체한다 → 키 없이도 제품이 돈다.
//
// 두 단계: ① 기획(generatePlanOutline) = 가벼운 아웃라인  ② 제작(generateCard) = 본문 완성
// ─────────────────────────────────────────────────────────────────────────────

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

// 키 없음 = 의도된 mock 모드(키 없이도 제품이 돈다). 키 있는데 실패 = 실제 장애 → 조용히 mock 넣지 않는다.
function hasApiKey(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

function client(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced?.[1] ?? text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("no json");
  return JSON.parse(candidate.slice(start, end + 1));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// 일시적 오류만 재시도(rate limit·과부하·네트워크·파싱 실패). 400(크레딧)·401/403(인증)은 재시도 무의미 → 즉시 실패.
const RETRY_BACKOFF_MS = [400, 1200];
function isRetryable(e: unknown): boolean {
  const status = (e as { status?: number })?.status;
  if (typeof status === "number") return status === 429 || (status >= 500 && status < 600);
  return true; // status 없음 = 네트워크/파싱 오류 → 재시도 가치 있음
}

async function callClaude(system: string, user: string, maxTokens = 4000): Promise<unknown> {
  const c = client();
  if (!c) throw new Error("no api key");
  let lastErr: unknown;
  for (let attempt = 0; attempt <= RETRY_BACKOFF_MS.length; attempt++) {
    try {
      const res = await c.messages.create({
        model: MODEL,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: user }],
      });
      const textBlock = res.content.find((b) => b.type === "text");
      const text = textBlock && "text" in textBlock ? textBlock.text : "";
      return extractJson(text);
    } catch (e) {
      lastErr = e;
      if (attempt === RETRY_BACKOFF_MS.length || !isRetryable(e)) throw e;
      await sleep(RETRY_BACKOFF_MS[attempt] ?? 500);
    }
  }
  throw lastErr;
}

// ── 운영 단계 진단 ─────────────────────────────────────────────────────────────
// 팔로워 수 기반 운영단계 진단. followers 는 resolveFollowerCount(IG 실값 우선)로 계산해 넘긴다.
export function diagnoseStage(followers: number): OperationStage {
  if (followers < 100) return "세팅";
  if (followers < 500) return "누적";
  if (followers < 1000) return "반응 탐색";
  if (followers < 3000) return "성장 실험";
  return "수익화 준비";
}

function recommendedCount(survey: SurveyProfile): number {
  const cap = survey.weeklyCapacity || 2;
  return Math.max(2, Math.min(cap, 7));
}

// ── 전략 생성 ────────────────────────────────────────────────────────────────
function strategySystemPrompt(survey: SurveyProfile, stage: OperationStage, count: number): string {
  return [
    "당신은 인스타그램을 막 키우는 1인 인플루언서를 돕는 한국어 콘텐츠 전략 코파일럿입니다.",
    "원칙: 자동화를 과시하지 말고 사용자의 시간 절감과 통제감을 돕는다. 산출물은 수정 가능한 초안.",
    `계정 컨셉 — 주제: ${survey.niche || "(미정)"} / 브랜드 키워드: ${survey.brandKeywords.join(", ") || "(없음)"} / 문체: ${survey.voiceExample || "(없음)"}.`,
    `운영 단계: ${stage} (팔로워 기반). 단계에 맞는 목표를 잡는다 — 초기(세팅·누적)는 도달·저장·팔로우로 ‘무엇을 주는 계정인지’ 각인이 먼저고, 문의·방문·매출은 계정 목적에 실제로 포함될 때만 뒤에 붙인다.`,
    `[주간 추천 리스트 ★] topics = 이번 주에 그대로 올릴 콘텐츠 ${count}개. 사용자의 주간 업로드 역량에 맞춘 ‘이번 주 발행 계획’이다. 개수를 정확히 ${count}개로 맞추고, 서로 각도·형식이 겹치지 않게 다양하게(정보형·관점형·큐레이션형·후기형 등을 섞어) 한 주 분량이 되도록 구성한다.`,
    "[구체·계정 맞춤 ★] 주제는 이 계정의 니치·키워드에 밀착한 구체적인 것으로. ‘입문자가 하는 실수 5’·‘3분 요약’처럼 어느 계정에나 붙는 뻔한 템플릿은 금지. 실제로 저장·공유할 만한 알맹이가 보이는 제목으로.",
    "[정직 ★] 지어낸 통계·수치·순위·트렌드로 주제를 만들지 않는다. 주제는 아이디어이므로 구체적이되, 검증 안 된 사실을 단정하는 제목은 피한다.",
    "topics[].goal = 이 주제에 가장 맞는 목표 하나 — 조회/저장/공유/방문/문의/팔로우/댓글 중에서 위 운영 단계 원칙에 따라 고른다(초기엔 저장·팔로우·공유 위주).",
    "topics[].hookDirection = 첫 장을 어떻게 후킹할지 한 줄(구체적으로). topics[].why = 지금 이 계정 상황에 왜 이 주제인지 짧게.",
    survey.sensitiveDomain !== "없음"
      ? `민감 도메인(${survey.sensitiveDomain}): 권유·단정·보장·효능 표현을 피하고 정보 제공형으로 제안한다.`
      : "",
    "결과는 JSON 객체만 출력합니다. 설명/마크다운/코드펜스 없이.",
    `스키마: {diagnosis: string(한 줄 진단), weeklyGoal: string(이번 주 실행 목표, 주 ${count}회 발행 전제), focus: string[3](전략 방향), topics: [{title, goal, hookDirection, why}] x${count}}`,
  ].filter(Boolean).join("\n");
}

function profileForPrompt(survey: SurveyProfile, stage: OperationStage, followers: number) {
  return {
    운영단계: stage,
    주제: survey.niche,
    팔로워: followers,
    목적: survey.goals,
    주당가능업로드: survey.weeklyCapacity,
    브랜드키워드: survey.brandKeywords,
    문체예시: survey.voiceExample,
    민감도메인: survey.sensitiveDomain,
  };
}

export async function generateStrategy(survey: SurveyProfile, followers: number): Promise<Strategy> {
  const stage = diagnoseStage(followers);
  const count = recommendedCount(survey);
  if (!hasApiKey()) return templateStrategy(survey, stage, count); // 의도된 mock
  try {
    const data = (await callClaude(
      strategySystemPrompt(survey, stage, count),
      JSON.stringify(profileForPrompt(survey, stage, followers))
    )) as { diagnosis: string; weeklyGoal: string; focus: string[]; topics: StrategyTopic[] };
    return {
      stage,
      diagnosis: data.diagnosis,
      weeklyGoal: data.weeklyGoal,
      recommendedCount: count,
      focus: (data.focus || []).slice(0, 3),
      topics: (data.topics || []).slice(0, count),
      generatedBy: "ai",
      createdAt: Date.now(),
    };
  } catch (e) {
    captureException(e, { op: "generateStrategy", niche: survey.niche }); // 실제 장애는 관측되게
    throw e; // 조용히 mock 넣지 않고 위로 던짐 → 라우트가 503
  }
}

function templateStrategy(survey: SurveyProfile, stage: OperationStage, count: number): Strategy {
  const niche = survey.niche || "내 주제";
  const kw = survey.brandKeywords[0] || niche;
  const goalWord = survey.goals.includes("매출") || survey.goals.includes("문의") ? "문의·방문" : "저장·공유";
  const stageCopy: Record<OperationStage, { diag: string; goal: string; focus: string[] }> = {
    세팅: {
      diag: "계정 컨셉과 톤을 잡는 세팅 단계예요. 일관된 첫인상이 먼저예요.",
      goal: "이번 주는 ‘무엇을 주는 계정인지’가 한눈에 보이는 카드뉴스 2건을 올려요.",
      focus: ["프로필·하이라이트로 컨셉 명확화", "구성 톤 통일(색감·말투)", "저장 부르는 정보형 1건"],
    },
    누적: {
      diag: "콘텐츠를 쌓는 누적 단계예요. 빈도가 가장 큰 변수예요.",
      focus: ["주 2회 루틴 고정", "반응 좋은 포맷 1개 반복", "첫 장 후킹 실험"],
      goal: "이번 주는 같은 시간대에 2건을 꾸준히 올려 루틴을 만들어요.",
    },
    "반응 탐색": {
      diag: "어떤 콘텐츠가 먹히는지 찾는 반응 탐색 단계예요.",
      focus: ["저장·공유 높은 주제 더블다운", "CTA 한 줄 추가", "프로필 방문 유도"],
      goal: `이번 주는 ${goalWord} 를 노린 주제 2건으로 반응 신호를 모아요.`,
    },
    "성장 실험": {
      diag: "팔로우 전환을 키우는 성장 실험 단계예요.",
      focus: ["후킹 A/B", "시리즈물로 재방문 유도", "프로필 CTA 정비"],
      goal: "이번 주는 후킹 두 가지를 실험해 어떤 첫 장이 더 멈추게 하는지 봐요.",
    },
    "수익화 준비": {
      diag: "문의·매출로 잇는 수익화 준비 단계예요.",
      focus: ["오퍼·문의 동선 정비", "신뢰 콘텐츠(후기·사례)", "DM 리드마그넷 도입"],
      goal: "이번 주는 문의로 이어지는 콘텐츠 2건 + 댓글→DM 흐름을 세팅해요.",
    },
  };
  const sc = stageCopy[stage];
  const topics: StrategyTopic[] = [
    { title: `${niche} 입문자가 가장 많이 하는 실수 5`, goal: "저장", hookDirection: "‘이거 모르면 손해’ 형 첫 장", why: "정보 저장형은 초기 노출·저장에 강해요." },
    { title: `${kw} 루틴, 나는 이렇게 한다`, goal: "공유", hookDirection: "개인 관점·얼굴 보이는 톤", why: "관점이 들어가면 ‘남의 계정’처럼 보이지 않아요." },
    { title: `${niche} 3분 요약: 오늘 바로 써먹기`, goal: "조회", hookDirection: "숫자·즉시 효용 강조", why: "짧은 효용 콘텐츠는 진입장벽이 낮아요." },
    {
      title: survey.goals.includes("문의") ? `${niche} 문의 전 꼭 확인할 것` : `${niche} 자주 받는 질문 3가지`,
      goal: survey.goals.includes("문의") ? "문의" : "방문",
      hookDirection: "프로필/링크로 자연스러운 CTA",
      why: "방문·문의 동선을 카드 마지막 장에서 안내해요.",
    },
  ];
  return { stage, diagnosis: sc.diag, weeklyGoal: sc.goal, recommendedCount: count, focus: sc.focus, topics: topics.slice(0, count), generatedBy: "template", createdAt: Date.now() };
}

// ── 카드 입력 ─────────────────────────────────────────────────────────────────
export interface CardGenInput {
  topicSource: TopicSource;
  topicTitle: string;
  format: CardFormat;
  objective: ContentObjective;
  pageCount: number;
  keyMessage: string;
  toneOverride?: string;
}

// ── ① 기획 아웃라인 생성 (가벼움) ─────────────────────────────────────────────
export interface PlanOutline {
  title: string;
  pages: CardPage[]; // headline(서브타이틀) + 짧은 body 한 줄 + photoNote
  generatedBy: "ai" | "template";
}

// ── 템플릿 자동 배정 ───────────────────────────────────────────────────────
// LLM 응답엔 런타임 스키마 검증이 없다(프롬프트 + 파싱 화이트리스트가 전부).
// 그래서 여기서 반드시 정규화한다: 첫 장=cover, 마지막 장=cta, 중간은 유효값이 아니면 list.
const TEMPLATES = ["cover", "list", "compare", "quote", "stat", "cta"] as const;
type Tpl = (typeof TEMPLATES)[number];

function normTemplate(raw: unknown, i: number, n: number): Tpl {
  if (i === 0) return "cover";
  if (i === n - 1) return "cta";
  return TEMPLATES.includes(raw as Tpl) && raw !== "cover" && raw !== "cta" ? (raw as Tpl) : "list";
}

/** 템플릿이 요구하는 부가 필드만 남긴다 — 엉뚱한 템플릿의 잔여 필드가 렌더를 깨지 않도록.
 *  tag 는 헤드라인·본문처럼 전 템플릿 공통이라 여기서 항상 통과시킨다. */
function pickTemplateFields(tpl: Tpl, p: Partial<CardPage>): Partial<CardPage> {
  const tag = typeof p.tag === "string" && p.tag.trim() ? p.tag.trim().slice(0, 20) : undefined;
  switch (tpl) {
    case "list":
      return { tag, items: Array.isArray(p.items) ? p.items.map(String).slice(0, 5) : undefined };
    case "compare":
      return p.compare ? { tag, compare: p.compare } : { tag };
    case "stat":
      return p.stat ? { tag, stat: p.stat } : { tag };
    case "cta":
      return { tag, ctaLabel: typeof p.ctaLabel === "string" ? p.ctaLabel : undefined };
    default: // cover · quote — 태그 외 추가 필드 없음
      return { tag };
  }
}

/** 프롬프트에 넣을 템플릿 규칙 — 기획·제작 프롬프트가 공유한다. */
const TEMPLATE_RULE =
  "각 장에 template 을 배정한다. index 0 = \"cover\"(후킹), 마지막 장 = \"cta\". " +
  "중간 장은 내용 성격에 맞춰 고른다: 항목 나열이면 \"list\", 전후·좌우 대비면 \"compare\", " +
  "수치 강조면 \"stat\", 한 문장 임팩트면 \"quote\". 애매하면 \"list\".";

export async function generatePlanOutline(survey: SurveyProfile, input: CardGenInput): Promise<PlanOutline> {
  const photo = input.format === "사진첨부형 카드뉴스";
  if (!hasApiKey()) return templatePlan(survey, input); // 의도된 mock
  try {
    const system = [
      "당신은 한국어 인스타 카드뉴스 ‘기획’ 어시스턴트입니다. 본문 전체가 아니라 페이지별 아웃라인(뼈대)만 만듭니다.",
      `브랜드 키워드: ${survey.brandKeywords.join(", ") || "(없음)"} / 문체: ${survey.voiceExample || "(없음)"}`,
      "구성은 서사 흐름을 따른다: 후킹 → 왜 지금 중요한가 → 흔한 문제·오해 → 관점 전환(핵심 인사이트) → 구체 예시 → 핵심(가장 저장할 만한 장) → 적용법 → 마무리 CTA.",
      `페이지 수(${input.pageCount})에 맞춰 압축한다: 장수가 적으면 인접 단계를 합치고(예: 5장 = 후킹/문제/핵심/적용/CTA), 많으면 관점전환·예시·적용을 늘린다.`,
      "★ 단, 주제가 ‘추천·베스트·모음·리스트’처럼 구체적 항목 나열을 기대하는 유형이면 서사 아크를 강요하지 말고 [첫 장 후킹 → 중간 각 장 = 추천 항목 하나씩 → 마지막 CTA]로 구성한다(실제 항목명은 제작 단계에서 채움). ‘고르는 법’만 설명하는 구성은 이 유형에선 실패다.",
      "한 장에는 한 가지 생각만. 첫 장(index 0)은 스크롤을 멈추는 후킹, 마지막 장은 자연스러운 CTA 방향(값싼 참여유도 금지).",
      "중간 슬라이드는 실질 정보(운동 동작·요리 단계·추천 항목 등)로 채운다 — 개념·‘하는 법 개요’로 때우지 않는다. 통계·가격·영업시간처럼 검증이 필요한 수치만 지어내지 않는다.",
      "결과는 JSON 객체만(설명·마크다운·코드펜스 없이). 디자인·색·폰트·HTML은 생성하지 않는다.",
      TEMPLATE_RULE,
      "스키마: {title, pages:[{index, headline(각 장 서브타이틀), body(한 줄 요약), template(cover|list|compare|quote|stat|cta)" +
        (photo ? ", photoNote(이 장에 넣을 사진 설명)" : "") +
        "}]}",
    ].join("\n");
    const user = JSON.stringify({ 주제: input.topicTitle, 형식: input.format, 목적: input.objective, 페이지수: input.pageCount, 핵심메시지: input.keyMessage });
    const data = (await callClaude(system, user, 1500)) as { title: string; pages: CardPage[] };
    const raw = (data.pages || []).slice(0, input.pageCount);
    const n = raw.length;
    const pages = raw.map((p, i) => ({
      index: i,
      headline: p.headline || `${i + 1}장`,
      body: p.body || "",
      photoNote: photo ? p.photoNote : undefined,
      template: normTemplate(p.template, i, n),
    }));
    return { title: data.title || input.topicTitle, pages: pages.length ? pages : templatePlan(survey, input).pages, generatedBy: "ai" };
  } catch (e) {
    captureException(e, { op: "generatePlanOutline", topic: input.topicTitle });
    throw e; // 조용히 mock 넣지 않고 위로 던짐 → 라우트가 503
  }
}

function templatePlan(survey: SurveyProfile, input: CardGenInput): PlanOutline {
  const n = Math.max(3, Math.min(input.pageCount || 5, 8));
  const photo = input.format === "사진첨부형 카드뉴스";
  const topic = input.topicTitle || "오늘의 주제";
  const labels = ["후킹: 시선 멈추기", "핵심 1", "핵심 2", "핵심 3", "핵심 4", "핵심 5", "정리", "CTA"];
  const pages: CardPage[] = Array.from({ length: n }).map((_, i) => ({
    index: i,
    headline: i === 0 ? topic : i === n - 1 ? "오늘의 한 줄 + CTA" : labels[Math.min(i, labels.length - 2)] ?? "핵심",
    body: i === 0 ? `${survey.niche || "이 주제"}, 이거 하나만 알아도 달라져요.` : "여기에 한 줄 요약 (기획 단계)",
    photoNote: photo ? (i === 0 ? "대표 사진" : "관련 사진 1장") : undefined,
    template: normTemplate(undefined, i, n), // 0=cover, 마지막=cta, 중간=list
  }));
  return { title: topic, pages, generatedBy: "template" };
}

// ── ② 카드 본문 완성 (제작하러가기) ───────────────────────────────────────────
export interface CardGenResult {
  title: string;
  pages: CardPage[];
  caption: string;
  hashtags: string[];
  cta: string;
  generatedBy: "ai" | "template";
}

// export: 프롬프트 비교 하버스(scripts/compare-card-prompt.ts)가 "라이브와 동일한" A 프롬프트로 대조하기 위함. 런타임 동작 변화 없음.
export function cardSystemPrompt(survey: SurveyProfile, format: CardFormat): string {
  const common = [
    `브랜드 키워드: ${survey.brandKeywords.join(", ") || "(없음)"}`,
    `문체 예시: ${survey.voiceExample || "(없음)"}`,
    `금지 표현: ${survey.forbiddenExpressions.join(", ") || "(없음)"}`,
    `캡션 길이 선호: ${survey.captionLength} / 해시태그 스타일: ${survey.hashtagStyle}`,
    survey.sensitiveDomain !== "없음"
      ? `민감 도메인(${survey.sensitiveDomain}): 실질 정보는 충분히 담되 권유·강요·단정·보장·효능 표현만 피한다. 캡션에 명시적 면책 한 줄 + 공식·전문 확인 권고.`
      : "",
  ];
  // 품질 규칙(스키마 무관, 제작 공통). 사실 최종검증은 발행 전 사람 검수(runReview 출처확인 게이트)가 담당.
  const qualityRules = [
    "[구성] 주어진 아웃라인의 흐름을 따르되 각 장의 본문을 완성한다. 한 장 = 한 가지 생각. 첫 장(index 0)은 스크롤을 멈추는 후킹, 마지막 장은 자연스러운 CTA(값싼 참여유도 금지).",
    "[카피] 문장은 짧고 리듬 있게, 강한 대비, 자연스러운 구어체 한국어. 과장·전문가인 척·SNS 상투어·느낌표 남발 금지. 추상적 동기부여 대신 구체적이고 바로 써먹을 내용. 이모지는 장당 0~1개.",
    "[빈 카피 금지] ★가장 중요 — ‘핵심 1’·‘여기에 한 줄 요약’·‘정리했어요’ 같은 알맹이 없는 placeholder·메타 표현 절대 금지. 말하지 말고 실제 내용을 써라.",
    "[정보 밀도 ★] 중간 슬라이드는 실질 정보로 꽉 채운다. 노하우·운동·요리·뷰티면 실제 동작·단계·성분·수치(횟수·시간)를 구체적으로, 추천이면 실제 항목(곡·책·작품·장소·맛집·제품)을 이름으로. 사용자가 이 카드만 보고 바로 실행·소비할 수 있어야 한다. 개념 설명·‘하는 법 개요’로 때우지 않는다.",
    "[본문 작성 공식] headline = 그 장의 핵심을 한마디로. body = 쉬운 정의·설명 + 구체 예시·수치·항목.",
    "[추천·로컬 — 실물을 이름으로] 노래·책·작품·장소·맛집·제품 추천이면 장르·무드로 뭉개지 말고 실존 항목을 이름으로 제시한다(곡='가수 - 제목', 작품='제목', 장소='지역·상호', 맛집·카페도 알려진 곳은 실명). 널리 알려진 것 위주로 다양하게. 명언은 유명한 것 위주로 인용하고 출처를 밝힌다. ‘직접 채우세요’ 빈칸 틀은 정말 개인적인 것에만 쓰고 남발하지 않는다.",
    "[지어내지 말 것 — 검증형 하드팩트만] 통계·퍼센트·순위·가격·영업시간·주소·전화번호·최신 수치, 법·제도의 구체 금액·기한은 지어내지 않는다(틀리면 바로 들통나 신뢰를 깎음). 이것만 조심하고 나머지 질적·구체 정보는 풍부하게 담는다.",
  ];
  if (format === "릴스") {
    return [
      "당신은 한국어 인스타 릴스(짧은 세로 영상) 기획자입니다. 사용자가 직접 촬영·편집할 수 있도록 ‘대본’을 짭니다. 영상 자체는 만들지 않습니다.",
      ...common,
      ...qualityRules,
      "결과는 JSON 객체만(설명·마크다운·코드펜스 없이). 디자인·색·폰트·HTML은 생성하지 않는다. 스키마: {title, pages:[{index, headline(구간/장면, 예: '후킹 0~3초'), body(대사·자막 문구), note(화면 연출·동작 지시)}], caption, hashtags:string[8~12], cta}",
      "30~60초 분량. index 0 = 첫 3초 강한 후킹(스크롤 멈추게). 마지막 장면 = 행동 유도(CTA: 팔로우·저장·댓글 등). 각 body 는 실제 말할 대사/화면 자막으로 1~2문장 짧게.",
    ].filter(Boolean).join("\n");
  }
  return [
    "당신은 한국어 인스타 카드뉴스 카피라이터입니다. 사용자의 톤을 그대로 살린 ‘수정 가능한 초안’을 만듭니다.",
    `형식: ${format}` + (format === "사진첨부형 카드뉴스" ? " (각 장 사진 위에 얹을 짧은 카피 중심)" : ""),
    ...common,
    ...qualityRules,
    "결과는 JSON 객체만(설명·마크다운·코드펜스 없이). 디자인·색·폰트·HTML은 생성하지 않는다(렌더는 고정 템플릿 담당). 스키마: {title, pages:[{index, headline, body, tag, photoNote, template}], caption, hashtags:string[8~12], cta}. 각 body 는 1~3문장.",
    TEMPLATE_RULE,
    "tag 는 headline/body 처럼 전 템플릿 공통 필드다 — 제목 위에 뱃지로 붙는다(최대 16자, 비우면 뱃지 없음). " +
      "표지 장은 후킹 문구('0-1,000 팔로워를 위한'), 중간 장은 장 번호('2') 나 분류('AI', '체크리스트') 처럼 짧게. 한 카드 안에서 일관된 방식으로.",
    "아웃라인에 template 이 오면 그대로 따른다. 템플릿별 필수 필드를 함께 채운다: " +
      "list → items:string[3~5] (각 항목 한 줄), compare → compare:{leftLabel,left,rightLabel,right}, " +
      "stat → stat:{value(숫자만),unit,caption}, cta → ctaLabel(짧은 유도 문구). " +
      "quote 는 headline/body 만 쓴다. stat 의 value 는 지어내지 말고 근거 있는 수치만 — 없으면 stat 대신 list 를 쓴다. " +
      "list 의 body 는 항목 나열이 아니라 도입 한 줄이다(항목은 items 에만).",
    "최종 출력 전 스스로 점검(점검 내용은 출력하지 말 것): 중간 슬라이드가 실질 정보(동작·단계·실제 항목)로 차 있는가, 개념으로 때우지 않았는가? 한국어만 읽어도 바로 써먹을 수 있는가? 첫 장이 스크롤을 멈추는가? 지어낸 하드팩트(수치·가격·영업시간)는 없는가? 민감 주제면 면책을 넣었는가? 미달이면 고쳐서 낸다.",
  ].filter(Boolean).join("\n");
}

export async function generateCard(survey: SurveyProfile, input: CardGenInput, outline?: CardPage[]): Promise<CardGenResult> {
  if (!hasApiKey()) return templateCard(survey, input, outline); // 의도된 mock
  try {
    const user = JSON.stringify({
      주제: input.topicTitle,
      형식: input.format,
      목적: input.objective,
      페이지수: input.pageCount,
      핵심메시지: input.keyMessage,
      톤미세조정: input.toneOverride || "(없음)",
      // 기획 단계에서 배정한 template 을 제작 단계로 넘긴다 (빼면 두 단계가 어긋난다)
      아웃라인: outline?.map((p) => ({ 장: p.index + 1, 서브타이틀: p.headline, 요약: p.body, template: p.template })) || "(없음)",
    });
    const data = (await callClaude(cardSystemPrompt(survey, input.format), user)) as {
      title: string;
      pages: CardPage[];
      caption: string;
      hashtags: string[];
      cta: string;
    };
    const photo = input.format === "사진첨부형 카드뉴스";
    const reels = input.format === "릴스";
    const raw = (data.pages || []).slice(0, input.pageCount);
    const n = raw.length;
    const pages = raw.map((p, i) => {
      const base = {
        index: i,
        headline: p.headline,
        body: p.body,
        note: p.note,
        photoNote: photo ? p.photoNote : undefined,
      };
      if (reels) return base; // 릴스는 장면 대본 — 템플릿 개념 없음
      const tpl = normTemplate(p.template, i, n);
      return { ...base, template: tpl, ...pickTemplateFields(tpl, p) };
    });
    return {
      title: data.title || input.topicTitle,
      pages: pages.length ? pages : templateCard(survey, input).pages,
      caption: data.caption || "",
      hashtags: (data.hashtags || []).slice(0, 14),
      cta: data.cta || "",
      generatedBy: "ai",
    };
  } catch (e) {
    captureException(e, { op: "generateCard", topic: input.topicTitle });
    throw e; // 조용히 mock 넣지 않고 위로 던짐 → 라우트가 503
  }
}

function templateCard(survey: SurveyProfile, input: CardGenInput, outline?: CardPage[]): CardGenResult {
  const n = Math.max(3, Math.min(input.pageCount || 5, 8));
  const photo = input.format === "사진첨부형 카드뉴스";
  const topic = input.topicTitle || "오늘의 주제";
  const km = input.keyMessage || topic;
  const kw = survey.brandKeywords;

  // ── 릴스 대본 템플릿 ──
  if (input.format === "릴스") {
    const scenes: CardPage[] = [
      { index: 0, headline: "후킹 0~3초", body: `"${topic}" — 이거 모르면 손해예요`, note: "강렬한 첫 화면 + 큰 자막" },
      { index: 1, headline: "도입 3~8초", body: `${survey.niche || "이 주제"}에서 흔히 하는 오해를 짚어요`, note: "말하는 얼굴 또는 B롤" },
      { index: 2, headline: "핵심 8~25초", body: `${km}\n핵심 포인트를 1·2·3으로 빠르게`, note: "자막 강조, 장면 전환 빠르게" },
      { index: 3, headline: "마무리 + CTA", body: "도움 됐다면 팔로우하고 다음 편도 받아보세요 ➕", note: "마지막 자막 + 프로필 안내" },
    ];
    const baseTags = [survey.niche, ...kw, "릴스", "릴스추천"].filter(Boolean).map((t) => `#${t.replace(/\s+/g, "")}`);
    const tags = Array.from(new Set([...baseTags, "#reels", "#일상", "#팁"])).slice(0, 12);
    return {
      title: topic,
      pages: scenes.slice(0, Math.max(3, Math.min(n, 6))),
      caption: `${topic}\n\n${km}\n\n저장해두고 따라 해보세요 🔖`,
      hashtags: tags,
      cta: "팔로우하고 다음 편 받기 ➕",
      generatedBy: "template",
    };
  }
  const points = ["핵심 1 — 출발점", "핵심 2 — 가장 흔한 오해", "핵심 3 — 바로 적용하는 법", "핵심 4 — 한 단계 더", "핵심 5 — 놓치기 쉬운 디테일", "정리"];

  const pages: CardPage[] = [];
  pages.push({
    index: 0,
    headline: outline?.[0]?.headline || topic,
    body: `${survey.niche || "이 주제"}, 이거 하나만 알아도 달라져요.`,
    note: `브랜드 무드 / 큰 제목 + 시선 끄는 배경`,
    photoNote: photo ? "대표 사진" : undefined,
    template: "cover",
    tag: survey.niche || undefined, // 표지 태그 — 사용자가 직접 고쳐 쓰는 자리
  });
  const middle = n - 2;
  for (let i = 0; i < middle; i++) {
    pages.push({
      index: i + 1,
      headline: outline?.[i + 1]?.headline || points[i] || `핵심 ${i + 1}`,
      body: `${kw[i % Math.max(1, kw.length)] || survey.niche || "포인트"} 관점에서 짧게 설명해 주세요. (초안 — 내 말투로 고치기)`,
      note: "텍스트 위주, 가독성 높은 레이아웃",
      photoNote: photo ? "관련 사진 1장" : undefined,
      // 중간 장 기본 태그 = 장 번호. 사용자가 "AI" 같은 문구로 바꿔 쓸 수 있다(뱃지는 태그가 결정).
      tag: String(i + 2),
      // 기획 단계에서 배정한 template 을 승계 (없으면 list)
      template: normTemplate(outline?.[i + 1]?.template, i + 1, n),
    });
  }
  const ctaText =
    input.objective === "문의" ? "더 궁금하면 프로필 링크로 문의 주세요 🙌"
    : input.objective === "방문" ? "프로필에서 더 보기 → 저장도 잊지 마세요"
    : input.objective === "공유" ? "도움 됐다면 친구에게 공유해 주세요 🔁"
    : input.objective === "팔로우" ? "이런 콘텐츠 매주 올려요 → 팔로우하고 받아보기 ➕"
    : input.objective === "댓글" ? "여러분 생각은 어때요? 댓글로 알려주세요 💬"
    : "도움 됐다면 저장하고 다음에 또 보기 🔖";
  pages.push({
    index: n - 1,
    headline: "오늘의 한 줄",
    body: `${km}\n\n${ctaText}`,
    note: "마지막 장: CTA + 계정/프로필 안내",
    photoNote: photo ? "마무리 사진" : undefined,
    template: "cta",
    ctaLabel: ctaText,
  });

  const baseTags = [survey.niche, ...kw].filter(Boolean).map((t) => `#${t.replace(/\s+/g, "")}`);
  const genericTags = ["#카드뉴스", "#인스타팁", "#성장기록", "#일상기록", "#오늘의팁"];
  const hashtags = Array.from(new Set([...baseTags, ...genericTags])).slice(0, 12);
  const caption =
    survey.captionLength === "짧게" ? `${topic} 🔖 저장해두고 보세요.`
    : survey.captionLength === "길게" ? `${topic}\n\n${km}\n\n${ctaText}`
    : `${topic}\n\n${km}\n${ctaText}`;

  return { title: topic, pages, caption: caption.trim(), hashtags, cta: ctaText, generatedBy: "template" };
}

export function aiAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
