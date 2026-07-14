"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/workspace/client";
import { Button, Logo } from "@/components/workspace/ui";
import { Generating } from "@/components/workspace/Generating";
import { SurveyForm } from "@/components/workspace/SurveyForm";
import type { SurveyProfile } from "@/lib/workspace/types";

// MVP: 주간 전략 자동 생성 토글. 전략 박스(plans SHOW_STRATEGY)와 함께 꺼둠.
const AUTO_STRATEGY = false;

// 건너뛰기 시 사용할 기본 프로필 (나중에 마이페이지에서 수정 가능)
const DEFAULT_SURVEY: SurveyProfile = {
  niche: "내 주제",
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

export function OnboardingClient({ initial }: { initial: SurveyProfile | null }) {
  const router = useRouter();
  const [working, setWorking] = useState(false);
  const [skipping, setSkipping] = useState(false);

  async function onSaved() {
    // MVP: 저장 직후 주간 전략 자동 생성 잠시 꺼둠(전략 박스 비활성과 일관). 재활성화 시 AUTO_STRATEGY = true.
    if (AUTO_STRATEGY) {
      setWorking(true);
      await api("/api/strategy", { method: "POST" }).catch(() => {});
    }
    router.push("/app/home");
    router.refresh();
  }

  async function onSkip() {
    // 기본값으로 시작 — 설문 없이 바로 워크스페이스로 (전략 생성은 나중에)
    setSkipping(true);
    await api("/api/survey", { method: "PUT", body: initial ?? DEFAULT_SURVEY }).catch(() => {});
    router.push("/app/home");
    router.refresh();
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-5 sm:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <Logo size="md" />
          <span className="text-sm text-muted">시작 설문 · 선택</span>
        </div>
        <div className="mb-7">
          <div className="text-xs font-semibold tracking-wide text-coral uppercase mb-1">
            당신은 어떤 사람/계정인가요
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h1 className="font-display text-3xl">시작 설문</h1>
            <Button variant="ghost" size="sm" onClick={onSkip} disabled={skipping || working}>
              {skipping ? "넘어가는 중…" : "나중에 할게요 · 건너뛰기 →"}
            </Button>
          </div>
          <p className="text-ink-soft mt-2">
            카드뉴스 정보와는 별개예요. 여기서 받은 ‘사람·계정 프로필’이 이후 모든 생성에
            상속돼서, 톤이 흔들리지 않아요. <b>건너뛰면 기본값으로 시작</b>하고, 언제든 마이페이지에서
            채울 수 있어요.
          </p>
        </div>
        <div className="bg-card border border-line rounded-2xl p-6 sm:p-8">
          {working ? (
            <Generating
              title="이번 주 전략을 짜는 중…"
              messages={[
                "운영 단계를 진단하는 중",
                "이번 주 실행 목표를 잡는 중",
                "계정에 맞는 주제를 고르는 중",
                "후킹 방향까지 정리하는 중",
              ]}
            />
          ) : (
            <SurveyForm initial={initial} mode="onboarding" onSaved={onSaved} />
          )}
        </div>

        <div className="text-center mt-5">
          <button onClick={onSkip} disabled={skipping || working} className="text-sm text-muted hover:text-ink">
            {skipping ? "넘어가는 중…" : "설문 없이 바로 워크스페이스로 들어가기"}
          </button>
        </div>
      </div>
    </div>
  );
}
