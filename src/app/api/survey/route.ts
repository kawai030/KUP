import { mutateDB } from "@/lib/db";
import { bad, json, withUser } from "@/lib/api";
import type { SurveyProfile } from "@/lib/types";

export async function GET() {
  const guard = await withUser();
  if ("res" in guard) return guard.res;
  return json({ survey: guard.user.survey ?? null });
}

// 시작 설문 저장/수정 (§4-A). 온보딩과 마이페이지 양쪽에서 사용.
export async function PUT(req: Request) {
  const guard = await withUser();
  if ("res" in guard) return guard.res;
  const body = (await req.json().catch(() => null)) as Partial<SurveyProfile> | null;
  if (!body) return bad("잘못된 요청입니다.");

  const survey: SurveyProfile = {
    niche: (body.niche || "").trim(),
    followers: Number(body.followers) || 0,
    operatingMonths: Number(body.operatingMonths) || 0,
    goals: Array.isArray(body.goals) ? body.goals : [],
    weeklyCapacity: Number(body.weeklyCapacity) || 2,
    mainFormats: Array.isArray(body.mainFormats) ? body.mainFormats : ["카드뉴스"],
    assets: (body.assets || "").trim(),
    brandKeywords: (Array.isArray(body.brandKeywords) ? body.brandKeywords : [])
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 5),
    brandColor: (body.brandColor || "#0066cc").trim(),
    voiceExample: (body.voiceExample || "").trim(),
    forbiddenExpressions: (Array.isArray(body.forbiddenExpressions) ? body.forbiddenExpressions : [])
      .map((s) => s.trim())
      .filter(Boolean),
    captionLength: body.captionLength === "짧게" || body.captionLength === "길게" ? body.captionLength : "보통",
    hashtagStyle: (body.hashtagStyle || "").trim(),
    ctaStyle: (body.ctaStyle || "").trim(),
    visualGuide: (body.visualGuide || "").trim(),
    sensitiveDomain: body.sensitiveDomain || "없음",
    benchmark: (body.benchmark || "").trim(),
  };

  if (!survey.niche) return bad("주제(니치)는 필수입니다.");

  mutateDB((db) => {
    const u = db.users.find((x) => x.id === guard.user.id);
    if (u) u.survey = survey;
  });
  return json({ survey });
}
