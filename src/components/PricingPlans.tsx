"use client";

import { useState } from "react";
import { Badge, Button, Card } from "@/components/ui";
import type { BillingCycle, Plan } from "@/lib/types";

interface PlanDef {
  key: Plan;
  monthly: number;
  tagline: string;
  features: string[];
  dm: string;
  highlight?: boolean;
}

const PLANS: PlanDef[] = [
  {
    key: "베이직",
    monthly: 0,
    tagline: "막 시작한 계정의 첫 루틴",
    dm: "DM 리드마그넷 100건",
    features: ["월 5건 AI 기획·제작", "검수 게이트·승인 로그", "인스타 1계정 연동", "기본 인사이트"],
  },
  {
    key: "프로",
    monthly: 19900,
    tagline: "꾸준히 발행하는 운영자",
    dm: "DM 리드마그넷 1,000건",
    highlight: true,
    features: ["월 30건 AI 기획·제작", "예약 발행", "인스타 3계정 연동", "Contributions 그래프·챌린지"],
  },
  {
    key: "프리미엄",
    monthly: 39900,
    tagline: "여러 계정·브랜드 운영",
    dm: "DM 리드마그넷 무제한",
    features: ["무제한 AI 기획·제작", "다중 계정 무제한", "우선 생성·지원", "전체 인사이트"],
  },
];

function won(n: number): string {
  return "₩" + n.toLocaleString();
}

export function PricingPlans({
  mode,
  currentPlan,
  currentCycle,
  onSelect,
  startHref,
}: {
  mode: "marketing" | "workspace";
  currentPlan?: Plan;
  currentCycle?: BillingCycle;
  onSelect?: (plan: Plan, cycle: BillingCycle) => void;
  startHref?: string;
}) {
  const [cycle, setCycle] = useState<BillingCycle>(currentCycle ?? "월");

  return (
    <div>
      <div className="flex items-center justify-center gap-3 mb-6">
        <span className={`text-sm ${cycle === "월" ? "text-ink font-medium" : "text-muted"}`}>월간</span>
        <button
          onClick={() => setCycle((c) => (c === "월" ? "연" : "월"))}
          className="relative w-12 h-6 rounded-full bg-ink transition"
          aria-label="결제 주기"
        >
          <span
            className="absolute top-0.5 w-5 h-5 rounded-full bg-paper transition-all"
            style={{ left: cycle === "연" ? "1.625rem" : "0.125rem" }}
          />
        </button>
        <span className={`text-sm ${cycle === "연" ? "text-ink font-medium" : "text-muted"}`}>
          연간 <span className="text-coral font-medium">30% 할인</span>
        </span>
      </div>

      <div className="text-center mb-5">
        <Badge tone="teal">베타 기간 전 기능 무료</Badge>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {PLANS.map((p) => {
          const price = cycle === "연" ? Math.round((p.monthly * 12 * 0.7) / 12) : p.monthly;
          const isCurrent = currentPlan === p.key;
          return (
            <Card
              key={p.key}
              className={`p-6 flex flex-col ${p.highlight ? "border-ink ring-1 ring-ink" : ""}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-xl">{p.key}</span>
                {p.highlight && <Badge tone="coral">인기</Badge>}
                {isCurrent && <Badge tone="teal">현재</Badge>}
              </div>
              <p className="text-sm text-ink-soft mt-1">{p.tagline}</p>
              <div className="mt-4">
                <span className="font-display text-3xl">{p.monthly === 0 ? "무료" : won(price)}</span>
                {p.monthly > 0 && <span className="text-sm text-muted">/월</span>}
                {p.monthly > 0 && cycle === "연" && (
                  <div className="text-xs text-muted mt-0.5">연 {won(Math.round(p.monthly * 12 * 0.7))} 청구</div>
                )}
              </div>
              <ul className="mt-4 space-y-1.5 text-sm text-ink-soft flex-1">
                <li className="flex gap-2">
                  <span className="text-coral">✦</span>
                  <span className="font-medium text-ink">{p.dm}</span>
                </li>
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="text-teal">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-5">
                {mode === "marketing" ? (
                  <a href={startHref || "/signup"}>
                    <Button variant={p.highlight ? "primary" : "outline"} className="w-full">
                      시작하기
                    </Button>
                  </a>
                ) : isCurrent ? (
                  <Button variant="outline" className="w-full" disabled>
                    이용 중
                  </Button>
                ) : (
                  <Button
                    variant={p.highlight ? "primary" : "outline"}
                    className="w-full"
                    onClick={() => onSelect?.(p.key, cycle)}
                  >
                    {p.monthly === 0 ? "이 플랜으로" : "구독하기"}
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
