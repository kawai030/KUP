"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthButton } from "./auth-modal";
import { Icon } from "@/components/ui/icon";

/**
 * 홍보 사이트 GNB — 홈(kup-hero)과 동일한 핑크 헤더. 모바일 햄버거 토글.
 * 로그인 상태에 따라 우측 CTA 분기:
 *  - 로그아웃: 로그인 · 시작하기(팝업)
 *  - 로그인:   워크스페이스로 · 로그아웃
 */
const NAV = [
  { href: "/features", label: "주요 기능" },
  { href: "/pricing", label: "요금제" },
  { href: "/contact", label: "문의하기" },
];

function LogoutButton({ className }: { className?: string }) {
  // 로그아웃 = /auth/signout 로 POST (세션 종료 후 홈으로)
  return (
    <form action="/auth/signout" method="post" style={{ display: "inline-flex" }}>
      <button type="submit" className={className}>
        로그아웃
      </button>
    </form>
  );
}

function Cta({ loggedIn, mobile }: { loggedIn: boolean; mobile?: boolean }) {
  if (loggedIn) {
    return (
      <>
        <Link href="/app/home" className="btn btn-primary">
          워크스페이스로
        </Link>
        <LogoutButton className={mobile ? "btn btn-line" : "btn btn-ghost"} />
      </>
    );
  }
  return (
    <>
      <AuthButton className={mobile ? "btn btn-line" : "btn btn-ghost"}>로그인</AuthButton>
      <AuthButton className="btn btn-primary">시작하기</AuthButton>
    </>
  );
}

export function Gnb({ loggedIn }: { loggedIn: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="gnb">
      <div className="gnb-inner">
        <Link href="/" className="logo">
          <span className="dot" />
          KUP
        </Link>
        <nav className="gnb-nav">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="gnb-cta">
          <Cta loggedIn={loggedIn} />
        </div>
        <button className="gnb-burger" onClick={() => setOpen((v) => !v)} aria-label="메뉴">
          <Icon name="menu" size={22} />
        </button>
      </div>
      {open && (
        <div className="mob-menu show">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} onClick={() => setOpen(false)}>
              {n.label}
            </Link>
          ))}
          <Cta loggedIn={loggedIn} mobile />
        </div>
      )}
    </header>
  );
}
