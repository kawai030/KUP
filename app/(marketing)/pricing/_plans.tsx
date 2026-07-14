"use client";

import { useState } from "react";
import { AuthButton } from "../_components/auth-modal";

/** 요금제 플랜 + 월/연 토글. 연 결제 -30%(홈 요금제 미리보기와 동일 3종). */
const PLANS = [
  { name: "베이직", m: "₩0", y: "₩0", desc: "개인이 가볍게 시작", featured: false, cta: "무료로 시작", feats: ["인스타 계정 1개 연동", "AI 기획·제작 기본", "DM 리드마그넷 100건", "기본 성과 요약"] },
  { name: "프로", m: "₩9,900", y: "₩6,930", desc: "꾸준히 성장하는 운영자", featured: true, cta: "프로 선택하기", feats: ["인스타 계정 3개 연동", "AI 제작 무제한", "DM 리드마그넷 1,000건", "콘텐츠 성과 분석", "예약 발행"] },
  { name: "프리미엄", m: "₩19,900", y: "₩13,930", desc: "제한 없이 운영", featured: false, cta: "프리미엄 선택하기", feats: ["계정 무제한 연동", "DM 리드마그넷 무제한", "전체 성과·성장 플랜", "우선 고객 지원"] },
];

export function PricingPlans() {
  const [billing, setBilling] = useState<"month" | "year">("month");

  return (
    <>
      <div className="billing">
        <div className="billing-seg">
          <button className={billing === "month" ? "active" : ""} onClick={() => setBilling("month")}>
            월 결제
          </button>
          <button className={billing === "year" ? "active" : ""} onClick={() => setBilling("year")}>
            연 결제 <span className="save">-30%</span>
          </button>
        </div>
      </div>

      <div className="plans">
        {PLANS.map((p) => (
          <div key={p.name} className={`plan${p.featured ? " featured" : ""}`}>
            {p.featured && <div className="plan-badge">가장 인기</div>}
            <div className="plan-name">{p.name}</div>
            <div className="plan-price">
              {billing === "month" ? p.m : p.y}
              <small>/월</small>
            </div>
            <p className="plan-desc">{p.desc}</p>
            <ul className="plan-feats">
              {p.feats.map((f) => (
                <li key={f}>
                  <span className="ck">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <AuthButton className={`btn ${p.featured ? "btn-primary" : "btn-line"} btn-block`}>{p.cta}</AuthButton>
          </div>
        ))}
      </div>
    </>
  );
}
