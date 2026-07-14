"use client";

import { useState } from "react";
import { api } from "@/lib/workspace/client";
import { SurveyForm } from "@/components/workspace/SurveyForm";
import { Generating } from "@/components/workspace/Generating";
import type { SurveyProfile } from "@/lib/workspace/types";

/**
 * 시작 설문 모달. 홈 우측 버튼·AI콘텐츠생성 게이트에서 공용으로 띄운다.
 * 저장 직후 전략을 (재)생성해 주간 추천 리스트가 바로 채워지도록 한다.
 */
// MVP: 주간 전략 자동 생성 토글. 전략 박스(plans SHOW_STRATEGY)와 함께 꺼둠.
const AUTO_STRATEGY = false;

export function SurveyModal({
  initial,
  onClose,
  onSaved,
}: {
  initial?: SurveyProfile | null;
  onClose: () => void;
  onSaved?: (s: SurveyProfile) => void;
}) {
  const [working, setWorking] = useState(false);

  async function handleSaved(survey: SurveyProfile) {
    // MVP: 저장 직후 주간 전략 자동 생성 잠시 꺼둠(전략 박스 비활성과 일관). 재활성화 시 AUTO_STRATEGY = true.
    if (AUTO_STRATEGY) {
      setWorking(true);
      // 설문 저장 직후 첫/재생성 전략 → 실패해도 설문은 저장됨(라이브 안 깨짐).
      await api("/api/strategy", { method: "POST" }).catch(() => {});
    }
    onSaved?.(survey);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/40" onClick={working ? undefined : onClose} />
      <div className="relative bg-card border border-line rounded-2xl w-full max-w-xl max-h-[88vh] overflow-y-auto p-6 sm:p-7 float-in shadow-xl">
        <div className="mb-5">
          <div className="text-xs font-semibold tracking-wide text-coral uppercase mb-1">계정 프로필</div>
          <h3 className="font-display text-2xl">시작 설문</h3>
          <p className="text-sm text-ink-soft mt-1">
            여기서 받은 계정 톤·목적이 이후 모든 생성에 상속돼요. 언제든 다시 수정할 수 있어요.
          </p>
        </div>
        {working ? (
          <Generating
            title="이번 주 전략을 짜는 중…"
            messages={["운영 목적을 반영하는 중", "이번 주 실행 목표를 잡는 중", "계정에 맞는 주제를 고르는 중", "후킹 방향까지 정리하는 중"]}
          />
        ) : (
          <SurveyForm initial={initial} mode="onboarding" onSaved={handleSaved} onCancel={onClose} />
        )}
      </div>
    </div>
  );
}
