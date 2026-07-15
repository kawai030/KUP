"use client";

import { useState } from "react";
import Link from "next/link";
import Script from "next/script";
import { AuthButton, useAuthModal } from "@/app/(marketing)/_components/auth-modal";
import { Icon } from "@/components/ui/icon";
import "./landing.css";

/**
 * KUP 랜딩(홈) — 사용자 제작 kup-hero.html을 Next로 통합.
 * · 디자인/DOM/값은 원본 그대로(.kup-landing 스코프의 landing.css).
 * · 히어로 3D는 r128 CDN + 원본 IIFE(public/kup-hero-anim.js)를 손대지 않고 그대로 실행.
 * · 로그인/시작 버튼은 원래 React 로그인 팝업(AuthButton) 재사용.
 * · Showcase 탭만 React 상태로.
 */

const SHOWCASE = [
  { key: "plan", label: "Plan", t: "무엇을, 언제 올릴지 정해 드려요", d: "계정 콘셉트와 목표를 바탕으로 주 2회 발행 로드맵을 짜 드려요. 다음에 올릴 주제가 늘 준비되어 있습니다.", l: "기획 흐름 보기", hint: "Plan · 기획 화면 자리 (GIF·영상)" },
  { key: "create", label: "Create", t: "내 말투 그대로, 카드뉴스 초안", d: "몇 번의 대화로 내 톤을 학습해 카드뉴스 초안을 만들어요. 손볼 곳이 거의 없이, 결정은 늘 당신 몫으로 남겨 둡니다.", l: "제작 과정 보기", hint: "Create · 제작 화면 자리 (GIF·영상)" },
  { key: "analyze", label: "Analyze", t: "이어지는 발행이 성과가 되도록", d: "발행 성과와, 이번 주에서 다음 주로 이어지는 발행 유지율을 한눈에 봐요. 무엇이 통했는지 확인하고 다음 콘텐츠에 반영합니다.", l: "성과 리포트 보기", hint: "Analyze · 성과 화면 자리 (GIF·영상)" },
] as const;

export default function HomePage() {
  const [threeReady, setThreeReady] = useState(false);
  const [tab, setTab] = useState<(typeof SHOWCASE)[number]["key"]>("plan");
  const active = SHOWCASE.find((s) => s.key === tab)!;
  // 로그인 상태면 랜딩 CTA를 "워크스페이스로" 하나로 바꾼다(이미 회원인데 "무료로 시작하기"는 어색).
  const { loggedIn } = useAuthModal();

  return (
    <div className="kup-landing">
      {/* header */}
      <header id="hd">
        <nav className="nav">
          <Link className="logo" href="/"><span className="dot" />KUP</Link>
          <div className="nav-links">
            <Link href="/features">주요 기능</Link>
            <Link href="/pricing">요금제</Link>
            <Link href="/contact">문의하기</Link>
          </div>
          <div className="nav-cta">
            {loggedIn ? (
              <AuthButton className="btn btn-primary">워크스페이스로</AuthButton>
            ) : (
              <>
                <AuthButton className="btn btn-ghost">로그인</AuthButton>
                <AuthButton className="btn btn-primary">무료로 시작하기</AuthButton>
              </>
            )}
          </div>
        </nav>
      </header>

      {/* hero */}
      <section className="hero" id="hero">
        <div className="stage">
          <canvas id="scene" />
          <div className="overlay">
            <div className="hero-block" id="heroBlock">
              <span className="eyebrow"><span className="pulse" />0–1,000 팔로워를 위한 콘텐츠 엔진</span>
              <h1>카드 한 장으로<br /><span className="hl">채널을 채우세요</span></h1>
              <p className="sub">KUP가 당신의 말투를 학습해 카드뉴스를 만들고, 정해진 시간에 올리고, 성과까지 정리해 드려요.</p>
              <div className="hero-cta">
                <AuthButton className="btn btn-primary btn-wide">
                  {loggedIn ? "워크스페이스로" : "무료로 시작하기"}
                </AuthButton>
              </div>
            </div>
          </div>
          <div className="endline" id="endline">
            흩어진 아이디어가, 하나의 계정으로
            <small>수천 개의 콘텐츠를 KUP 안에서</small>
          </div>
          <div className="scrollhint" id="hint">
            <div className="mouse" />
            SCROLL
          </div>
        </div>
      </section>

      {/* features */}
      <section className="section" id="feat">
        <span className="kicker">무엇을 하나요</span>
        <h2 className="h2">전략부터 발행까지, 한 흐름으로</h2>
        <p className="lead">아이디어를 붙잡아 두는 포스트잇처럼, KUP는 흩어진 콘텐츠 조각을 모아 꾸준히 발행되는 하나의 채널로 만들어 드려요.</p>
        <div className="grid">
          <div className="feat">
            <div className="no">01</div>
            <h3>성장 전략</h3>
            <p>계정 콘셉트와 목표에 맞춰 주 2회 발행 로드맵을 제안해요. 무엇을, 언제 올릴지 고민을 덜어 드립니다.</p>
            <span className="chip">전략 → 발행 로드맵</span>
          </div>
          <div className="feat">
            <div className="no">02</div>
            <h3>콘텐츠 자동 생성</h3>
            <p>내 말투를 학습한 카드뉴스 초안을 만들어요. 손볼 곳이 거의 없도록, 결정은 늘 당신 몫으로 남겨 둡니다.</p>
            <span className="chip">초안 → 리뷰</span>
          </div>
          <div className="feat">
            <div className="no">03</div>
            <h3>업로드 & 관리</h3>
            <p>예약 발행부터 성과 리포트까지 한 곳에서. 이번 주 발행이 다음 주로 이어지도록 리듬을 지켜 드려요.</p>
            <span className="chip">발행 → 성과</span>
          </div>
        </div>
        <div className="note"><Icon name="sparkle" size={18} className="text-coral" /><span><b>모든 초안은 언제든 직접 수정</b>할 수 있어요. 최종 결정권은 항상 당신에게 있습니다.</span></div>
      </section>

      {/* showcase */}
      <section className="section showcase" id="showcase">
        <span className="kicker">한 흐름으로</span>
        <h2 className="h2">기획부터 성과까지, 끊김 없이</h2>
        <div className="showcase-card">
          <div className="tabs" role="tablist" aria-label="KUP 워크플로우">
            {SHOWCASE.map((s) => (
              <button key={s.key} type="button" role="tab" aria-selected={tab === s.key} className={`tab${tab === s.key ? " active" : ""}`} onClick={() => setTab(s.key)}>
                {s.label}
              </button>
            ))}
          </div>
          <div className="showcase-body">
            <div className="showcase-copy">
              <h3>{active.t}</h3>
              <p>{active.d}</p>
              <a className="sc-link" href="#"><span>{active.l}</span><Icon name="arrowRight" size={18} /></a>
            </div>
            <div className="showcase-visual">
              {SHOWCASE.map((s) => (
                <div key={s.key} className={`media-frame${tab === s.key ? " active" : ""}`}>
                  <span className="media-hint">{s.hint}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* stats */}
      <section className="section" id="stats">
        <span className="kicker">숫자로 보는 KUP</span>
        <h2 className="h2">꾸준함이 만드는 변화</h2>
        <div className="stats">
          <div className="stat"><div className="stat-big">+12%</div><div className="stat-cap">평균 주간 팔로워 증가</div></div>
          <div className="stat"><div className="stat-big">70%</div><div className="stat-cap">콘텐츠 제작 시간 단축</div></div>
          <div className="stat"><div className="stat-big">12,000+</div><div className="stat-cap">누적 발행 콘텐츠</div></div>
        </div>
        <p className="stats-note">* 베타 참여자 기준 예시 수치 (실제 데이터로 교체 예정)</p>
      </section>

      {/* pricing */}
      <section className="section" id="pricing">
        <span className="kicker">요금제</span>
        <h2 className="h2">부담 없이 시작하고, 필요할 때 키우세요</h2>
        <p className="lead">베타 기간엔 모든 플랜을 무료로 써볼 수 있어요.</p>
        <div className="plans">
          <div className="plan">
            <div className="plan-name">베이직</div>
            <div className="plan-price">₩0<small>/월</small></div>
            <p className="plan-desc">가볍게 시작</p>
            <ul className="plan-feats">
              <li><span className="ck"><Icon name="check" size={14} /></span>계정 1개 연동</li>
              <li><span className="ck"><Icon name="check" size={14} /></span>AI 기획·제작 기본</li>
              <li><span className="ck"><Icon name="check" size={14} /></span>DM 리드마그넷 100건</li>
            </ul>
            <AuthButton className="btn btn-line">시작하기</AuthButton>
          </div>
          <div className="plan featured">
            <div className="plan-badge">추천</div>
            <div className="plan-name">프로</div>
            <div className="plan-price">₩9,900<small>/월</small></div>
            <p className="plan-desc">꾸준히 성장</p>
            <ul className="plan-feats">
              <li><span className="ck"><Icon name="check" size={14} /></span>계정 3개 연동</li>
              <li><span className="ck"><Icon name="check" size={14} /></span>AI 제작 무제한</li>
              <li><span className="ck"><Icon name="check" size={14} /></span>DM 1,000건 · 성과 분석</li>
            </ul>
            <AuthButton className="btn btn-primary">무료로 시작하기</AuthButton>
          </div>
          <div className="plan">
            <div className="plan-name">프리미엄</div>
            <div className="plan-price">₩19,900<small>/월</small></div>
            <p className="plan-desc">제한 없이</p>
            <ul className="plan-feats">
              <li><span className="ck"><Icon name="check" size={14} /></span>계정 무제한</li>
              <li><span className="ck"><Icon name="check" size={14} /></span>DM 무제한</li>
              <li><span className="ck"><Icon name="check" size={14} /></span>우선 지원</li>
            </ul>
            <AuthButton className="btn btn-line">시작하기</AuthButton>
          </div>
        </div>
      </section>

      {/* final CTA */}
      <section className="final">
        <span className="kicker">지금 시작하세요</span>
        <h2 className="h2">첫 카드부터, 꾸준한 채널까지</h2>
        <div className="hero-cta">
          <AuthButton className="btn btn-primary btn-wide">
            {loggedIn ? "워크스페이스로" : "무료로 시작하기"}
          </AuthButton>
        </div>
      </section>

      {/* footer */}
      <footer>
        <div className="foot">
          <Link className="logo" href="/"><span className="dot" />KUP</Link>
          <div>© 2026 KUP. Instagram growth studio for creators.</div>
        </div>
      </footer>

      {/* Three.js r128 CDN → 로드되면 원본 IIFE(무수정) 실행 */}
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"
        strategy="afterInteractive"
        onLoad={() => setThreeReady(true)}
      />
      {threeReady && <Script src="/kup-hero-anim.js" strategy="afterInteractive" />}
    </div>
  );
}
