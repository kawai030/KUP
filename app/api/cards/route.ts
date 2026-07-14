import { mutateDB, readDB, uid } from "@/lib/workspace/db";
import { bad, json, withUser } from "@/lib/workspace/api";
import { generateCard, generatePlanOutline, type CardGenInput } from "@/lib/workspace/ai";
import { runReview } from "@/lib/workspace/compliance";
import type { CardFormat, CardNews, ContentObjective, TopicSource } from "@/lib/workspace/types";

const FORMATS: CardFormat[] = ["카드뉴스", "사진첨부형 카드뉴스", "릴스"];

// 내 카드/기획 목록 (최신순)
export async function GET() {
  const guard = await withUser();
  if ("res" in guard) return guard.res;
  const cards = (await readDB())
    .cards.filter((c) => c.userId === guard.user.id)
    .sort((a, b) => b.updatedAt - a.updatedAt);
  return json({ cards });
}

// ① 기획 추가 (AI 기획 리스트) — 가벼운 아웃라인 생성, 상태 = 기획중
export async function POST(req: Request) {
  const guard = await withUser();
  if ("res" in guard) return guard.res;
  if (!guard.user.survey) return bad("먼저 시작 설문을 완료하세요.", 409);

  const body = (await req.json().catch(() => null)) as {
    topicSource?: TopicSource;
    topicTitle?: string;
    format?: CardFormat;
    objective?: ContentObjective;
    pageCount?: number;
    keyMessage?: string;
    toneOverride?: string;
  } | null;
  if (!body) return bad("잘못된 요청입니다.");

  const topicTitle = (body.topicTitle || "").trim();
  if (!topicTitle) return bad("주제를 입력하거나 선택하세요.");

  const input: CardGenInput = {
    topicSource: body.topicSource === "직접입력" ? "직접입력" : "추천",
    topicTitle,
    format: FORMATS.includes(body.format as CardFormat) ? (body.format as CardFormat) : "카드뉴스",
    objective: body.objective || "저장",
    pageCount: Math.max(3, Math.min(Number(body.pageCount) || 5, 8)),
    keyMessage: (body.keyMessage || "").trim(),
    toneOverride: (body.toneOverride || "").trim(),
  };

  const isReels = input.format === "릴스";
  // 릴스: 기획 단계에서 대본·캡션·해시태그까지 완성(제작 단계 없음). 카드뉴스: 가벼운 아웃라인.
  let gen;
  try {
    gen = isReels
      ? await generateCard(guard.user.survey, input)
      : await generatePlanOutline(guard.user.survey, input);
  } catch {
    return bad("지금 AI가 혼잡해요. 잠시 후 다시 시도해 주세요.", 503);
  }

  const card: CardNews = {
    id: uid("card"),
    userId: guard.user.id,
    igAccountId: guard.user.activeIgAccountId,
    title: gen.title,
    format: input.format,
    topicSource: input.topicSource,
    objective: input.objective,
    pageCount: gen.pages.length,
    keyMessage: input.keyMessage,
    pages: gen.pages,
    caption: isReels ? (gen as { caption?: string }).caption ?? "" : "",
    hashtags: isReels ? (gen as { hashtags?: string[] }).hashtags ?? [] : [],
    cta: isReels ? (gen as { cta?: string }).cta ?? "" : "",
    aiLabel: "AI 생성 콘텐츠",
    aiEdited: false,
    status: isReels ? "기획완료" : "기획중",
    reviewFlags: [],
    approvalLog: [],
    generatedBy: isReels ? (gen as { generatedBy: "ai" | "template" }).generatedBy : "기획",
    hasVideo: isReels ? false : undefined,
    theme: "cream",
    brandColor: "#ef5a35", // 기본 브랜드색. 카드별로 제작 화면에서 변경(설문에선 안 받음).
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  if (isReels) card.reviewFlags = runReview(card, guard.user.survey);

  await mutateDB((db) => db.cards.push(card));
  return json({ card });
}
