"use client";

import { useState } from "react";
import { api } from "@/lib/client";
import { Button, Field, inputClass } from "@/components/ui";
import type {
  ContentFormat,
  OperationGoal,
  SensitiveDomain,
  SurveyProfile,
} from "@/lib/types";

const GOALS: OperationGoal[] = ["취미", "브랜딩", "협찬", "매출", "문의", "포트폴리오"];
const FORMATS: ContentFormat[] = ["카드뉴스", "릴스", "사진", "스토리"];
const DOMAINS: SensitiveDomain[] = ["없음", "금융·투자·부동산", "의료·건강·다이어트", "법률·세무", "기타 규제"];
const LENGTHS = ["짧게", "보통", "길게"] as const;

const EMPTY: SurveyProfile = {
  niche: "",
  followers: 0,
  operatingMonths: 0,
  goals: [],
  weeklyCapacity: 2,
  mainFormats: ["카드뉴스"],
  assets: "",
  brandKeywords: [],
  brandColor: "#0066cc",
  voiceExample: "",
  forbiddenExpressions: [],
  captionLength: "보통",
  hashtagStyle: "",
  ctaStyle: "",
  visualGuide: "",
  sensitiveDomain: "없음",
  benchmark: "",
};

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3.5 py-1.5 rounded-full text-sm border transition ${
        active ? "bg-ink text-paper border-ink" : "bg-card text-ink-soft border-line hover:border-ink/30"
      }`}
    >
      {children}
    </button>
  );
}

export function SurveyForm({
  initial,
  mode,
  onSaved,
}: {
  initial?: SurveyProfile | null;
  mode: "onboarding" | "edit";
  onSaved?: (s: SurveyProfile) => void;
}) {
  const [s, setS] = useState<SurveyProfile>({ ...EMPTY, ...(initial ?? {}) });
  const [step, setStep] = useState(0);
  const [keywordsText, setKeywordsText] = useState((initial?.brandKeywords ?? []).join(", "));
  const [forbiddenText, setForbiddenText] = useState((initial?.forbiddenExpressions ?? []).join(", "));
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  function set<K extends keyof SurveyProfile>(k: K, v: SurveyProfile[K]) {
    setS((prev) => ({ ...prev, [k]: v }));
  }
  function toggle<T>(arr: T[], v: T): T[] {
    return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
  }

  async function save() {
    setErr("");
    const payload: SurveyProfile = {
      ...s,
      brandKeywords: keywordsText.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 5),
      forbiddenExpressions: forbiddenText.split(",").map((x) => x.trim()).filter(Boolean),
    };
    if (!payload.niche.trim()) {
      setErr("주제(니치)는 필수예요.");
      setStep(0);
      return;
    }
    setSaving(true);
    try {
      const { survey } = await api<{ survey: SurveyProfile }>("/api/survey", {
        method: "PUT",
        body: payload,
      });
      onSaved?.(survey);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const steps = ["계정 · 여건", "톤앤매너", "민감도 · 벤치마크"];

  return (
    <div>
      {/* step nav */}
      <div className="flex gap-2 mb-6">
        {steps.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setStep(i)}
            className={`flex-1 text-left rounded-xl border px-3 py-2 transition ${
              step === i ? "border-ink bg-card" : "border-line bg-paper-2/50"
            }`}
          >
            <div className="text-xs text-muted">STEP {i + 1}</div>
            <div className={`text-sm font-medium ${step === i ? "text-ink" : "text-ink-soft"}`}>
              {label}
            </div>
          </button>
        ))}
      </div>

      {step === 0 && (
        <div className="space-y-4 float-in">
          <Field label="주제(니치)" hint="필수">
            <input
              className={inputClass}
              value={s.niche}
              onChange={(e) => set("niche", e.target.value)}
              placeholder="예: 퇴근 후 운동·식단 / 동네 베이커리"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="현재 팔로워 수">
              <input
                className={inputClass}
                type="number"
                value={s.followers || ""}
                onChange={(e) => set("followers", Number(e.target.value))}
                placeholder="280"
              />
            </Field>
            <Field label="운영 기간(개월)">
              <input
                className={inputClass}
                type="number"
                value={s.operatingMonths || ""}
                onChange={(e) => set("operatingMonths", Number(e.target.value))}
                placeholder="6"
              />
            </Field>
          </div>
          <Field label="운영 목적" hint="복수 선택">
            <div className="flex flex-wrap gap-2">
              {GOALS.map((g) => (
                <Chip key={g} active={s.goals.includes(g)} onClick={() => set("goals", toggle(s.goals, g))}>
                  {g}
                </Chip>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="주당 업로드 가능 횟수" hint="주 2회 권장">
              <input
                className={inputClass}
                type="number"
                value={s.weeklyCapacity || ""}
                onChange={(e) => set("weeklyCapacity", Number(e.target.value))}
                placeholder="2"
              />
            </Field>
            <Field label="주 콘텐츠 형식">
              <div className="flex flex-wrap gap-2 pt-1">
                {FORMATS.map((f) => (
                  <Chip
                    key={f}
                    active={s.mainFormats.includes(f)}
                    onClick={() => set("mainFormats", toggle(s.mainFormats, f))}
                  >
                    {f}
                  </Chip>
                ))}
              </div>
            </Field>
          </div>
          <Field label="보유 자산" hint="사진·영상·제품/매장">
            <input
              className={inputClass}
              value={s.assets}
              onChange={(e) => set("assets", e.target.value)}
              placeholder="예: 운동 사진 다수 / 신메뉴 사진 보유"
            />
          </Field>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4 float-in">
          <Field label="브랜드 키워드" hint="3~5개, 쉼표로 구분">
            <input
              className={inputClass}
              value={keywordsText}
              onChange={(e) => setKeywordsText(e.target.value)}
              placeholder="담백한, 솔직한, 실용적인"
            />
          </Field>
          <Field label="문체 예시">
            <textarea
              className={inputClass}
              rows={2}
              value={s.voiceExample}
              onChange={(e) => set("voiceExample", e.target.value)}
              placeholder="예: 친구한테 말하듯 편하게, 과장 없이."
            />
          </Field>
          <Field label="금지 표현/스타일" hint="쉼표로 구분">
            <input
              className={inputClass}
              value={forbiddenText}
              onChange={(e) => setForbiddenText(e.target.value)}
              placeholder="무조건, 보장, 이모지 남발"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="선호 캡션 길이">
              <div className="flex gap-2 pt-1">
                {LENGTHS.map((l) => (
                  <Chip key={l} active={s.captionLength === l} onClick={() => set("captionLength", l)}>
                    {l}
                  </Chip>
                ))}
              </div>
            </Field>
            <Field label="해시태그 스타일">
              <input
                className={inputClass}
                value={s.hashtagStyle}
                onChange={(e) => set("hashtagStyle", e.target.value)}
                placeholder="니치 위주 8~12개"
              />
            </Field>
          </div>
          <Field label="CTA 스타일">
            <input
              className={inputClass}
              value={s.ctaStyle}
              onChange={(e) => set("ctaStyle", e.target.value)}
              placeholder="저장 유도 / 프로필 방문 안내"
            />
          </Field>
          <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
            <Field label="비주얼 가이드" hint="색감·무드">
              <input
                className={inputClass}
                value={s.visualGuide}
                onChange={(e) => set("visualGuide", e.target.value)}
                placeholder="따뜻한 크림톤, 군더더기 없는 레이아웃"
              />
            </Field>
            <Field label="브랜드 컬러">
              <input
                type="color"
                value={s.brandColor}
                onChange={(e) => set("brandColor", e.target.value)}
                className="w-14 h-11 rounded-xl border border-line bg-card cursor-pointer p-1"
              />
            </Field>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4 float-in">
          <Field label="민감/규제 도메인" hint="해당 시 검수 룰셋 자동 적용">
            <div className="flex flex-wrap gap-2">
              {DOMAINS.map((d) => (
                <Chip key={d} active={s.sensitiveDomain === d} onClick={() => set("sensitiveDomain", d)}>
                  {d}
                </Chip>
              ))}
            </div>
          </Field>
          {s.sensitiveDomain !== "없음" && (
            <p className="text-sm text-amber bg-amber-soft rounded-xl px-4 py-3">
              ⚠ 이 도메인은 ‘권유·강요·단정·보장’ 표현을 검수 단계에서 자동 플래그하고, 생성 시에도
              정보 제공형으로 유도해요.
            </p>
          )}
          <Field label="벤치마크 계정" hint="선택">
            <input
              className={inputClass}
              value={s.benchmark}
              onChange={(e) => set("benchmark", e.target.value)}
              placeholder="@reference_account"
            />
          </Field>
        </div>
      )}

      {err && <p className="text-sm text-coral mt-4">{err}</p>}

      <div className="flex items-center justify-between mt-7">
        <Button
          variant="ghost"
          onClick={() => setStep((x) => Math.max(0, x - 1))}
          disabled={step === 0}
        >
          ← 이전
        </Button>
        {step < 2 ? (
          <Button onClick={() => setStep((x) => Math.min(2, x + 1))}>다음 →</Button>
        ) : (
          <Button onClick={save} disabled={saving}>
            {saving ? "저장 중…" : mode === "onboarding" ? "설문 완료하고 전략 받기" : "변경 저장"}
          </Button>
        )}
      </div>
    </div>
  );
}
