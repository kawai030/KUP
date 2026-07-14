"use client";

import { Fragment, useState } from "react";
import { api } from "@/lib/workspace/client";
import { Button, Field, inputClass } from "@/components/workspace/ui";
import type {
  OperationGoal,
  SurveyProfile,
} from "@/lib/workspace/types";

const GOALS: OperationGoal[] = ["취미", "브랜딩", "협찬", "매출", "문의", "포트폴리오"];
const LENGTHS = ["짧게", "보통", "길게"] as const;
const WEEKLY = [2, 3, 4, 5, 6, 7];

// 프리셋(탭 한 번). 직접 입력 텍스트로 언제든 덮어쓸 수 있음.
const VOICE_PRESETS = ["담백한 존댓말", "다정한 반말", "활기찬 존댓말(~해요/~해봐요)", "전문적·신뢰감 있는", "위트 있는 구어체"];
const HASHTAG_PRESETS = ["니치 위주 8~12개", "대형+니치 혼합", "최소한만(3~5개)", "트렌드 태그 포함"];
const FORBIDDEN_PRESETS = ["과장·보장 표현", "이모지 남발", "반말", "영어 남용", "느낌표 남발"];

const STEP_LABELS = ["계정 기본", "톤앤매너", "디테일"];

const EMPTY: SurveyProfile = {
  niche: "",
  followers: 0,
  goals: [],
  weeklyCapacity: 2,
  brandKeywords: [],
  voiceExample: "",
  forbiddenExpressions: [],
  captionLength: "보통",
  hashtagStyle: "",
  sensitiveDomain: "없음",
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
        active
          ? "bg-coral-soft text-[#d81e46] border-[#ffc2cd] font-medium"
          : "bg-card text-ink-soft border-line hover:border-[#ffc2cd]"
      }`}
    >
      {children}
    </button>
  );
}

// 상단 진행 로드맵. 각 단계는 눌러서 이동 가능(완료값 검증은 저장 시점).
function Stepper({ current, onJump }: { current: number; onJump: (i: number) => void }) {
  return (
    <div className="flex items-start">
      {STEP_LABELS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <Fragment key={label}>
            {i > 0 && (
              <div className="flex-1 mt-[13px] mx-1.5 h-px bg-line overflow-hidden rounded-full">
                <div
                  className="h-full bg-coral transition-all duration-300"
                  style={{ width: i <= current ? "100%" : "0%" }}
                />
              </div>
            )}
            <button
              type="button"
              onClick={() => onJump(i)}
              className="flex flex-col items-center gap-1.5 shrink-0 w-10"
            >
              <span
                className={`w-7 h-7 rounded-full grid place-items-center text-xs font-bold border transition ${
                  active
                    ? "bg-coral text-white border-coral"
                    : done
                      ? "bg-coral-soft text-[#d81e46] border-[#ffc2cd]"
                      : "bg-card text-muted border-line"
                }`}
              >
                {i + 1}
              </span>
              <span
                className={`text-[10.5px] leading-tight text-center whitespace-nowrap transition ${
                  active ? "text-ink font-semibold" : done ? "text-ink-soft" : "text-muted"
                }`}
              >
                {label}
              </span>
            </button>
          </Fragment>
        );
      })}
    </div>
  );
}

// 프리셋 칩(단일) + 직접 입력. 텍스트가 곧 저장값이고, 칩은 텍스트를 채우는 단축.
function PresetField({
  label,
  hint,
  presets,
  value,
  onChange,
  placeholder,
  textarea,
}: {
  label: string;
  hint?: string;
  presets: string[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  textarea?: boolean;
}) {
  return (
    <Field label={label} hint={hint}>
      <div className="flex flex-wrap gap-2 mb-2">
        {presets.map((p) => (
          <Chip key={p} active={value.trim() === p} onClick={() => onChange(p)}>
            {p}
          </Chip>
        ))}
      </div>
      {textarea ? (
        <textarea className={inputClass} rows={2} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      ) : (
        <input className={inputClass} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      )}
    </Field>
  );
}

// 프리셋 칩(다중, 콤마 문자열) + 직접 입력. 칩은 콤마 목록의 항목을 토글.
function MultiPresetField({
  label,
  hint,
  presets,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  hint?: string;
  presets: string[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const items = value.split(",").map((x) => x.trim()).filter(Boolean);
  const has = (p: string) => items.includes(p);
  const toggleItem = (p: string) => onChange((has(p) ? items.filter((x) => x !== p) : [...items, p]).join(", "));
  return (
    <Field label={label} hint={hint}>
      <div className="flex flex-wrap gap-2 mb-2">
        {presets.map((p) => (
          <Chip key={p} active={has(p)} onClick={() => toggleItem(p)}>
            {p}
          </Chip>
        ))}
      </div>
      <input className={inputClass} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </Field>
  );
}

export function SurveyForm({
  initial,
  mode,
  onSaved,
  onCancel,
}: {
  initial?: SurveyProfile | null;
  mode: "onboarding" | "edit";
  onSaved?: (s: SurveyProfile) => void;
  onCancel?: () => void;
}) {
  const [s, setS] = useState<SurveyProfile>({ ...EMPTY, ...(initial ?? {}) });
  const [keywordsText, setKeywordsText] = useState((initial?.brandKeywords ?? []).join(", "));
  const [forbiddenText, setForbiddenText] = useState((initial?.forbiddenExpressions ?? []).join(", "));
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(0);
  const LAST = STEP_LABELS.length - 1;

  function set<K extends keyof SurveyProfile>(k: K, v: SurveyProfile[K]) {
    setS((prev) => ({ ...prev, [k]: v }));
  }
  function toggle<T>(arr: T[], v: T): T[] {
    return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
  }

  // 1단계의 필수값(주제)만 진행 전에 검증. 나머지는 자유.
  function goNext() {
    setErr("");
    if (step === 0 && !s.niche.trim()) {
      setErr("주제(카테고리)는 필수예요.");
      return;
    }
    setStep((v) => Math.min(LAST, v + 1));
  }
  function goBack() {
    setErr("");
    setStep((v) => Math.max(0, v - 1));
  }
  function jump(i: number) {
    setErr("");
    setStep(i);
  }

  async function save() {
    setErr("");
    // 민감도(sensitiveDomain)는 설문에서 안 받고 서버가 니치로 자동 감지 → 안전 가드레일 유지.
    const payload: SurveyProfile = {
      ...s,
      brandKeywords: keywordsText.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 5),
      forbiddenExpressions: forbiddenText.split(",").map((x) => x.trim()).filter(Boolean),
    };
    if (!payload.niche.trim()) {
      setStep(0);
      setErr("주제(카테고리)는 필수예요.");
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

  return (
    <div>
      <Stepper current={step} onJump={jump} />

      <div className="space-y-4 mt-6">
        {/* 1단계 · 계정 기본 */}
        {step === 0 && (
          <>
            <Field label="계정 주제(카테고리)" hint="필수">
              <input
                className={inputClass}
                value={s.niche}
                onChange={(e) => set("niche", e.target.value)}
                placeholder="예: 퇴근 후 운동·식단 / 동네 베이커리 / 사회초년생 재테크"
              />
            </Field>
            <Field label="운영 목적" hint="복수 선택">
              <div className="flex flex-wrap gap-2">
                {GOALS.map((g) => (
                  <Chip key={g} active={s.goals.includes(g)} onClick={() => set("goals", toggle(s.goals, g))}>
                    {g}
                  </Chip>
                ))}
              </div>
            </Field>
            <Field label="주당 업로드 가능 횟수" hint="주 2회 이상 권장">
              <div className="flex flex-wrap gap-2 pt-1">
                {WEEKLY.map((n) => (
                  <Chip key={n} active={s.weeklyCapacity === n} onClick={() => set("weeklyCapacity", n)}>
                    주 {n}회
                  </Chip>
                ))}
              </div>
            </Field>
          </>
        )}

        {/* 2단계 · 톤앤매너 */}
        {step === 1 && (
          <>
            <Field label="브랜드 키워드" hint="3~5개, 쉼표로 구분">
              <input
                className={inputClass}
                value={keywordsText}
                onChange={(e) => setKeywordsText(e.target.value)}
                placeholder="담백한, 솔직한, 실용적인"
              />
            </Field>
            <PresetField
              label="문체 예시"
              presets={VOICE_PRESETS}
              value={s.voiceExample}
              onChange={(v) => set("voiceExample", v)}
              placeholder="또는 직접 입력 (예: 친구한테 말하듯 편하게, 과장 없이)"
              textarea
            />
            <MultiPresetField
              label="금지 표현/스타일"
              hint="복수 선택 · 직접 추가 가능"
              presets={FORBIDDEN_PRESETS}
              value={forbiddenText}
              onChange={setForbiddenText}
              placeholder="또는 직접 입력 (쉼표로 구분)"
            />
          </>
        )}

        {/* 3단계 · 디테일 */}
        {step === 2 && (
          <>
            <Field label="선호 캡션 길이">
              <div className="flex gap-2 pt-1">
                {LENGTHS.map((l) => (
                  <Chip key={l} active={s.captionLength === l} onClick={() => set("captionLength", l)}>
                    {l}
                  </Chip>
                ))}
              </div>
            </Field>
            <PresetField
              label="해시태그 스타일"
              presets={HASHTAG_PRESETS}
              value={s.hashtagStyle}
              onChange={(v) => set("hashtagStyle", v)}
              placeholder="또는 직접 입력"
            />
          </>
        )}
      </div>

      {err && <p className="text-sm text-coral mt-3">{err}</p>}

      <div className="flex items-center justify-between gap-2 pt-4 mt-5 border-t border-line">
        <span className="text-xs text-muted tabular-nums">{step + 1} / {STEP_LABELS.length}</span>
        <div className="flex items-center gap-2">
          {step === 0 && onCancel && (
            <Button variant="ghost" onClick={onCancel} disabled={saving}>
              취소
            </Button>
          )}
          {step > 0 && (
            <Button variant="ghost" onClick={goBack} disabled={saving}>
              ← 이전
            </Button>
          )}
          {step < LAST ? (
            <Button onClick={goNext}>다음 →</Button>
          ) : (
            <Button onClick={save} disabled={saving}>
              {saving ? "저장 중…" : mode === "onboarding" ? "완료하고 전략 받기" : "저장"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
