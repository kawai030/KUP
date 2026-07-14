"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, Suspense, useContext, useEffect, useState, type ReactNode } from "react";
import { continueAsGuest, signInWithGoogle, signInWithPassword, signUpWithPassword } from "./auth-actions";

/**
 * 로그인/회원가입 모달 (화면흐름 L1/L2 — 팝업) + 로그인 상태 인식.
 * 서비스 로그인 진입점은 이 팝업 하나뿐(별도 로그인 페이지 없음).
 * - 로그아웃 상태: 버튼 → 팝업(구글·이메일·비회원 둘러보기)
 * - 로그인 상태: 버튼 → 워크스페이스(/app/home)로 바로 이동 (AuthButton)
 * - URL 쿼리로도 열린다: `/?auth=1`(모달 열기), `/?authError=메시지`(에러와 함께 열기).
 *   워크스페이스 프로필의 로그인/회원가입, 로그인 실패 리다이렉트가 이 경로로 되돌아온다.
 */
const INP: React.CSSProperties = {
  width: "100%",
  border: "1px solid var(--border2)",
  borderRadius: 6,
  padding: "10px 13px",
  fontSize: 14,
  background: "#fff",
};

const Ctx = createContext<{ open: (error?: string) => void; close: () => void; loggedIn: boolean } | null>(null);

export function AuthModalProvider({ loggedIn = false, children }: { loggedIn?: boolean; children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Ctx.Provider
      value={{
        open: (err?: string) => {
          setError(err ?? null);
          setIsOpen(true);
        },
        close: () => setIsOpen(false),
        loggedIn,
      }}
    >
      {children}
      <Suspense fallback={null}>
        <AuthUrlSync />
      </Suspense>
      {isOpen && <AuthModalOverlay error={error} onClose={() => setIsOpen(false)} />}
    </Ctx.Provider>
  );
}

export function useAuthModal() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuthModal must be used within <AuthModalProvider>");
  return c;
}

/**
 * URL 쿼리(`auth`, `authError`)를 감지해 모달을 자동으로 연 뒤 쿼리를 정리한다.
 * (뒤로가기·새로고침에 모달이 다시 뜨지 않도록 열자마자 pathname으로 replace)
 */
function AuthUrlSync() {
  const { open } = useAuthModal();
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const authError = params.get("authError");
  const auth = params.get("auth");

  useEffect(() => {
    if (authError !== null) {
      open(authError || "로그인에 실패했어요");
    } else if (auth !== null) {
      open();
    } else {
      return;
    }
    router.replace(pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authError, auth]);

  return null;
}

/** 로그아웃 상태 → 팝업 / 로그인 상태 → 워크스페이스 이동. */
export function AuthButton({ className, children }: { className?: string; children: ReactNode }) {
  const { open, loggedIn } = useAuthModal();
  if (loggedIn) {
    return (
      <Link href="/app/home" className={className}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={className} onClick={() => open()}>
      {children}
    </button>
  );
}

function AuthModalOverlay({ error, onClose }: { error: string | null; onClose: () => void }) {
  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}
    >
      <div style={{ background: "#fff", borderRadius: 14, padding: 32, width: "min(94vw, 400px)", position: "relative" }}>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          style={{ position: "absolute", top: 14, right: 16, border: "none", background: "none", fontSize: 18, color: "var(--ink3)", cursor: "pointer" }}
        >
          ✕
        </button>

        <h2 style={{ fontSize: 22, fontWeight: 800, textAlign: "center" }}>Kup 시작하기</h2>
        <p style={{ textAlign: "center", color: "var(--ink3)", fontSize: 14, marginTop: 6, marginBottom: 22 }}>
          구글 계정으로 1초 만에 시작하세요
        </p>

        {error && (
          <p style={{ background: "var(--coral-soft, #e8f3ff)", color: "var(--coral, #3182f6)", fontSize: 13, borderRadius: 8, padding: "9px 12px", marginBottom: 16, textAlign: "center" }}>
            {error}
          </p>
        )}

        <form action={signInWithGoogle}>
          <button type="submit" className="btn line block" style={{ gap: 8 }}>
            <span style={{ color: "#4285F4", fontWeight: 800 }}>G</span> 구글로 계속하기
          </button>
        </form>

        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0", color: "var(--ink3)", fontSize: 12 }}>
          <span style={{ height: 1, flex: 1, background: "var(--border)" }} />또는 이메일 (개발·테스트용)
          <span style={{ height: 1, flex: 1, background: "var(--border)" }} />
        </div>

        <form style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input name="email" type="email" required placeholder="이메일" style={INP} />
          <input name="password" type="password" required minLength={6} placeholder="비밀번호 (6자 이상)" style={INP} />
          <div style={{ display: "flex", gap: 8 }}>
            <button formAction={signInWithPassword} className="btn line block">
              로그인
            </button>
            <button formAction={signUpWithPassword} className="btn primary block">
              가입
            </button>
          </div>
        </form>

        {/* 비회원으로 둘러보기 (화면흐름 §4) — 게스트 세션 발급 후 워크스페이스 진입(가입 없이 체험) */}
        <form action={continueAsGuest} style={{ textAlign: "center", marginTop: 18 }}>
          <button type="submit" style={{ fontSize: 13, color: "var(--ink2)", textDecoration: "underline", background: "none", border: "none", cursor: "pointer" }}>
            비회원으로 둘러보기
          </button>
        </form>
      </div>
    </div>
  );
}
