import Anthropic from "@anthropic-ai/sdk";
import type {
  CardFormat,
  CardNews,
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

function client(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("no json");
  return JSON.parse(candidate.slice(start, end + 1));
}

async function callClaude(system: string, user: string, maxTokens = 4000): Promise<unknown> {
  const c = client();
  if (!c) throw new Error("no api key");
  const res = await c.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
  });
  const textBlock = res.content.find((b) => b.type === "text");
  const text = textBlock && "text" in textBlock ? textBlock.text : "";
  return extractJson(text);
}

// ── 운영 단계 진단 ─────────────────────────────────────────────────────────────
export function diagnoseStage(survey: SurveyProfile): OperationStage {
  const f = survey.followers;
  if (survey.operatingMonths < 1 || f < 100) return "세팅";
  if (f < 500) return "누적";
  if (f < 1000) return "반응 탐색";
  if (f < 3000) return "성장 실험";
  return "수익화 준비";
}

function recommendedCount(survey: SurveyProfile): number {
  const cap = survey.weeklyCapacity || 2;
  return Math.max(2, Math.min(cap, 7));
}

// ── 전략 생성 ────────────────────────────────────────────────────────────────
function strategySystemPrompt(): string {
  return [
    "당신은 인스타그램을 막 키우는 1인 인플루언서를 돕는 한국어 코파일럿입니다.",
    "원칙: 자동화를 과시하지 말고 사용자의 시간 절감과 통제감을 돕는다. 산출물은 수정 가능한 초안.",
    "결과는 JSON 객체만 출력합니다. 설명/마크다운/코드펜스 없이.",
    "스키마: {diagnosis: string(한 줄 진단), weeklyGoal: string(이번 주 실행 목표), focus: string[3](전략 방향), topics: [{title, goal, hookDirection, why}] x4}",
    "topics 의 goal 은 조회/저장/공유/방문/문의 중 하나의 의도를 담고, why 는 이 계정 상황에 맞는 이유를 짧게.",
    "민감 도메인(금융·의료 등)일 경우 권유/단정/보장 표현을 피하고 정보 제공형으로 제안.",
  ].join("\n");
}

function profileForPrompt(survey: SurveyProfile, stage: OperationStage) {
  return {
    운영단계: stage,
    주제: survey.niche,
    팔로워: survey.followers,
    운영개월: survey.operatingMonths,
    목적: survey.goals,
    주당가능업로드: survey.weeklyCapacity,
    브랜드키워드: survey.brandKeywords,
    문체예시: survey.voiceExample,
    비주얼무드: survey.visualGuide,
    민감도메인: survey.sensitiveDomain,
    벤치마크: survey.benchmark,
  };
}

export async function generateStrategy(survey: SurveyProfile): Promise<Strategy> {
  const stage = diagnoseStage(survey);
  const count = recommendedCount(survey);
  try {
    const data = (await callClaude(
      strategySystemPrompt(),
      JSON.stringify(profileForPrompt(survey, stage))
    )) as { diagnosis: string; weeklyGoal: string; focus: string[]; topics: StrategyTopic[] };
    return {
      stage,
      diagnosis: data.diagnosis,
      weeklyGoal: data.weeklyGoal,
      recommendedCount: count,
      focus: (data.focus || []).slice(0, 3),
      topics: (data.topics || []).slice(0, 6),
      generatedBy: "ai",
      createdAt: Date.now(),
    };
  } catch {
    return templateStrategy(survey, stage, count);
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
  return { stage, diagnosis: sc.diag, weeklyGoal: sc.goal, recommendedCount: count, focus: sc.focus, topics, generatedBy: "template", createdAt: Date.now() };
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

export async function generatePlanOutline(survey: SurveyProfile, input: CardGenInput): Promise<PlanOutline> {
  const photo = input.format === "사진첨부형 카드뉴스";
  try {
    const system = [
      "당신은 한국어 인스타 카드뉴스 ‘기획’ 어시스턴트입니다. 본문 전체가 아니라 페이지별 아웃라인만 만듭니다.",
      `브랜드 키워드: ${survey.brandKeywords.join(", ") || "(없음)"} / 문체: ${survey.voiceExample || "(없음)"}`,
      "결과는 JSON 객체만. 스키마: {title, pages:[{index, headline(각 장 서브타이틀), body(한 줄 요약)" +
        (photo ? ", photoNote(이 장에 넣을 사진 설명)" : "") +
        "}]}",
      "첫 장은 후킹, 마지막 장은 CTA 방향.",
    ].join("\n");
    const user = JSON.stringify({ 주제: input.topicTitle, 형식: input.format, 목적: input.objective, 페이지수: input.pageCount, 핵심메시지: input.keyMessage });
    const data = (await callClaude(system, user, 1500)) as { title: string; pages: CardPage[] };
    const pages = (data.pages || []).slice(0, input.pageCount).map((p, i) => ({
      index: i,
      headline: p.headline || `${i + 1}장`,
      body: p.body || "",
      photoNote: photo ? p.photoNote : undefined,
    }));
    return { title: data.title || input.topicTitle, pages: pages.length ? pages : templatePlan(survey, input).pages, generatedBy: "ai" };
  } catch {
    return templatePlan(survey, input);
  }
}

function templatePlan(survey: SurveyProfile, input: CardGenInput): PlanOutline {
  const n = Math.max(3, Math.min(input.pageCount || 5, 8));
  const photo = input.format === "사진첨부형 카드뉴스";
  const topic = input.topicTitle || "오늘의 주제";
  const labels = ["후킹: 시선 멈추기", "핵심 1", "핵심 2", "핵심 3", "핵심 4", "핵심 5", "정리", "CTA"];
  const pages: CardPage[] = Array.from({ length: n }).map((_, i) => ({
    index: i,
    headline: i === 0 ? topic : i === n - 1 ? "오늘의 한 줄 + CTA" : labels[Math.min(i, labels.length - 2)],
    body: i === 0 ? `${survey.niche || "이 주제"}, 이거 하나만 알아도 달라져요.` : "여기에 한 줄 요약 (기획 단계)",
    photoNote: photo ? (i === 0 ? "대표 사진" : "관련 사진 1장") : undefined,
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

function cardSystemPrompt(survey: SurveyProfile, format: CardFormat): string {
  const common = [
    `브랜드 키워드: ${survey.brandKeywords.join(", ") || "(없음)"}`,
    `문체 예시: ${survey.voiceExample || "(없음)"}`,
    `금지 표현: ${survey.forbiddenExpressions.join(", ") || "(없음)"}`,
    `캡션 길이 선호: ${survey.captionLength} / 해시태그 스타일: ${survey.hashtagStyle} / CTA 스타일: ${survey.ctaStyle}`,
    survey.sensitiveDomain !== "없음"
      ? `민감 도메인(${survey.sensitiveDomain}): 권유·강요·단정·보장 표현 금지, 정보 제공형 + 면책 고지.`
      : "",
  ];
  if (format === "릴스") {
    return [
      "당신은 한국어 인스타 릴스(짧은 세로 영상) 기획자입니다. 사용자가 직접 촬영·편집할 수 있도록 ‘대본’을 짭니다. 영상 자체는 만들지 않습니다.",
      ...common,
      "결과는 JSON 객체만. 스키마: {title, pages:[{index, headline(구간/장면, 예: '후킹 0~3초'), body(대사·자막 문구), note(화면 연출·동작 지시)}], caption, hashtags:string[8~12], cta}",
      "30~60초 분량. index 0 = 첫 3초 강한 후킹(스크롤 멈추게). 마지막 장면 = 행동 유도(CTA: 팔로우·저장·댓글 등).",
      "각 body 는 실제 말할 대사/화면 자막으로, 1~2문장 짧게.",
    ].filter(Boolean).join("\n");
  }
  return [
    "당신은 한국어 인스타 카드뉴스 카피라이터입니다. 사용자의 톤을 그대로 살린 ‘수정 가능한 초안’을 만듭니다.",
    `형식: ${format}` + (format === "사진첨부형 카드뉴스" ? " (각 장 사진 위에 얹을 짧은 카피 중심)" : ""),
    ...common,
    "결과는 JSON 객체만. 스키마: {title, pages:[{index, headline, body, photoNote}], caption, hashtags:string[8~12], cta}",
    "첫 페이지(index 0)는 강한 후킹. 마지막 페이지는 행동 유도(CTA). 각 body 는 1~3문장.",
  ].filter(Boolean).join("\n");
}

export async function generateCard(survey: SurveyProfile, input: CardGenInput, outline?: CardPage[]): Promise<CardGenResult> {
  try {
    const user = JSON.stringify({
      주제: input.topicTitle,
      형식: input.format,
      목적: input.objective,
      페이지수: input.pageCount,
      핵심메시지: input.keyMessage,
      톤미세조정: input.toneOverride || "(없음)",
      아웃라인: outline?.map((p) => ({ 장: p.index + 1, 서브타이틀: p.headline, 요약: p.body })) || "(없음)",
    });
    const data = (await callClaude(cardSystemPrompt(survey, input.format), user)) as {
      title: string;
      pages: CardPage[];
      caption: string;
      hashtags: string[];
      cta: string;
    };
    const photo = input.format === "사진첨부형 카드뉴스";
    const pages = (data.pages || []).slice(0, input.pageCount).map((p, i) => ({
      index: i,
      headline: p.headline,
      body: p.body,
      note: p.note,
      photoNote: photo ? p.photoNote : undefined,
    }));
    return {
      title: data.title || input.topicTitle,
      pages: pages.length ? pages : templateCard(survey, input).pages,
      caption: data.caption || "",
      hashtags: (data.hashtags || []).slice(0, 14),
      cta: data.cta || "",
      generatedBy: "ai",
    };
  } catch {
    return templateCard(survey, input, outline);
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
      cta: survey.ctaStyle || "팔로우하고 다음 편 받기 ➕",
      generatedBy: "template",
    };
  }
  const points = ["핵심 1 — 출발점", "핵심 2 — 가장 흔한 오해", "핵심 3 — 바로 적용하는 법", "핵심 4 — 한 단계 더", "핵심 5 — 놓치기 쉬운 디테일", "정리"];

  const pages: CardPage[] = [];
  pages.push({
    index: 0,
    headline: outline?.[0]?.headline || topic,
    body: `${survey.niche || "이 주제"}, 이거 하나만 알아도 달라져요.`,
    note: `${survey.visualGuide || "브랜드 무드"} / 큰 제목 + 시선 끄는 배경`,
    photoNote: photo ? "대표 사진" : undefined,
  });
  const middle = n - 2;
  for (let i = 0; i < middle; i++) {
    pages.push({
      index: i + 1,
      headline: outline?.[i + 1]?.headline || points[i] || `핵심 ${i + 1}`,
      body: `${kw[i % Math.max(1, kw.length)] || survey.niche || "포인트"} 관점에서 짧게 설명해 주세요. (초안 — 내 말투로 고치기)`,
      note: "텍스트 위주, 가독성 높은 레이아웃",
      photoNote: photo ? "관련 사진 1장" : undefined,
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
    body: `${km}\n\n${survey.ctaStyle || ctaText}`,
    note: "마지막 장: CTA + 계정/프로필 안내",
    photoNote: photo ? "마무리 사진" : undefined,
  });

  const baseTags = [survey.niche, ...kw].filter(Boolean).map((t) => `#${t.replace(/\s+/g, "")}`);
  const genericTags = ["#카드뉴스", "#인스타팁", "#성장기록", "#일상기록", "#오늘의팁"];
  const hashtags = Array.from(new Set([...baseTags, ...genericTags])).slice(0, 12);
  const caption =
    survey.captionLength === "짧게" ? `${topic} 🔖 저장해두고 보세요.`
    : survey.captionLength === "길게" ? `${topic}\n\n${km}\n\n${ctaText}`
    : `${topic}\n\n${km}\n${ctaText}`;

  return { title: topic, pages, caption: caption.trim(), hashtags, cta: survey.ctaStyle || ctaText, generatedBy: "template" };
}

export function aiAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
