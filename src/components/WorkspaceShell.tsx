"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import { Badge, Button, Logo } from "@/components/ui";
import { activeIgHandle, type PublicUser } from "@/lib/types";

const NAV = [
  { href: "/app/home", label: "홈", icon: "⌂", desc: "워크스페이스 개요" },
  { href: "/app/plans", label: "AI 기획 리스트", icon: "✦", desc: "주제 기획·제작" },
  { href: "/app/board", label: "콘텐츠 관리", icon: "▦", desc: "칸반 보드" },
  { href: "/app/insights", label: "콘텐츠 성과", icon: "◆", desc: "인사이트·챌린지" },
  { href: "/app/dm", label: "DM 리드마그넷", icon: "✉", desc: "자동화 설정" },
];

export function WorkspaceShell({
  user,
  aiAvailable,
  children,
}: {
  user: PublicUser;
  aiAvailable: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showOnboard, setShowOnboard] = useState(!user.onboarded);

  const handle = activeIgHandle(user);

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }
  async function switchAccount(id: string) {
    await api("/api/ig", { method: "PATCH", body: { activeId: id } });
    router.refresh();
  }
  async function closeOnboard() {
    setShowOnboard(false);
    await api("/api/account", { method: "PATCH", body: { onboarded: true } });
  }

  const SidebarBody = (
    <div className="flex flex-col h-full">
      {/* 연동 인스타 계정 */}
      <div className="px-2 mb-4">
        <div className="text-[11px] font-semibold tracking-wide text-muted uppercase mb-1.5 px-1.5">
          연동 인스타 계정
        </div>
        {user.igAccounts.length === 0 ? (
          <Link
            href="/app/accounts"
            onClick={() => setMenuOpen(false)}
            className="block rounded-xl border border-dashed border-coral/50 bg-coral-soft/40 px-3 py-2.5 text-sm text-coral"
          >
            + 계정 연동하기
          </Link>
        ) : (
          <div className="space-y-1">
            {user.igAccounts.map((a) => (
              <button
                key={a.id}
                onClick={() => switchAccount(a.id)}
                className={`w-full flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${
                  a.id === (user.activeIgAccountId ?? user.igAccounts[0]?.id)
                    ? "bg-card border border-line"
                    : "hover:bg-paper-2 text-ink-soft"
                }`}
              >
                <span className="w-6 h-6 rounded-full bg-ink text-paper grid place-items-center text-xs">
                  {a.handle[0]?.toUpperCase()}
                </span>
                <span className="truncate">@{a.handle}</span>
                {a.id === (user.activeIgAccountId ?? user.igAccounts[0]?.id) && (
                  <span className="ml-auto w-2 h-2 rounded-full bg-teal" />
                )}
              </button>
            ))}
            <Link href="/app/accounts" onClick={() => setMenuOpen(false)} className="block text-xs text-muted px-3 py-1 hover:text-ink">
              + 계정 추가 / 관리
            </Link>
          </div>
        )}
      </div>

      <nav className="space-y-1">
        {NAV.map((n) => {
          const active = pathname === n.href || pathname.startsWith(n.href + "/");
          return (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setMenuOpen(false)}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm transition ${
                active ? "bg-ink text-paper" : "text-ink-soft hover:bg-paper-2"
              }`}
            >
              <span className="w-5 text-center opacity-80">{n.icon}</span>
              <span className="flex-1">{n.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto pt-4 space-y-2">
        <Link href="/app/pricing" onClick={() => setMenuOpen(false)}>
          <div className="rounded-xl bg-paper-2/70 px-3 py-2.5 text-sm flex items-center justify-between hover:bg-paper-2">
            <span>요금제</span>
            <Badge tone="coral">{user.plan}</Badge>
          </div>
        </Link>
        {!aiAvailable && (
          <p className="text-[11px] text-muted px-1 leading-relaxed">
            템플릿 생성 모드 · ANTHROPIC_API_KEY 설정 시 Claude로 생성됩니다.
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col">
      {/* 상단 Header */}
      <header className="sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur">
        <div className="px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => setMenuOpen((o) => !o)} className="lg:hidden text-ink-soft">
              ☰
            </button>
            <Logo size="md" href="/app/home" />
            {user.guest && <Badge tone="amber">비회원</Badge>}
          </div>
          <div className="flex items-center gap-2">
            <Link href="/app/accounts">
              <Button variant="outline" size="sm">
                계정 연동하기
                {user.igAccounts.length > 0 && (
                  <span className="ml-1 inline-grid place-items-center min-w-5 h-5 px-1 rounded-full bg-teal-soft text-teal text-[11px]">
                    {user.igAccounts.length}
                  </span>
                )}
              </Button>
            </Link>
            <Link href="/app/pricing" className="hidden sm:block">
              <Button variant="ghost" size="sm">
                요금제
              </Button>
            </Link>
            <button
              onClick={() => setProfileOpen(true)}
              className="w-9 h-9 rounded-full bg-ink text-paper grid place-items-center text-sm font-medium"
              aria-label="프로필"
            >
              {user.name[0]?.toUpperCase() ?? "U"}
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 lg:flex">
        <aside className="hidden lg:block w-64 shrink-0 border-r border-line px-4 py-5 sticky top-14 h-[calc(100vh-3.5rem)]">
          {SidebarBody}
        </aside>
        {menuOpen && (
          <div className="lg:hidden border-b border-line px-4 py-4 bg-paper">{SidebarBody}</div>
        )}
        <main className="flex-1 min-w-0">
          <div className="max-w-5xl mx-auto px-5 sm:px-8 py-8">{children}</div>
        </main>
      </div>

      {/* 프로필 모달 */}
      {profileOpen && (
        <Modal onClose={() => setProfileOpen(false)}>
          <div className="text-center">
            <div className="w-14 h-14 rounded-full bg-ink text-paper grid place-items-center text-xl font-medium mx-auto">
              {user.name[0]?.toUpperCase() ?? "U"}
            </div>
            <div className="font-display text-xl mt-3">{user.name}</div>
            <div className="text-sm text-muted">{user.guest ? "비회원 이용 중" : user.email}</div>
            <div className="flex items-center justify-center gap-2 mt-2">
              <Badge tone="coral">{user.plan}</Badge>
              {handle && <Badge tone="teal">@{handle}</Badge>}
            </div>
          </div>
          <div className="mt-5 space-y-2">
            <Link href="/app/mypage" onClick={() => setProfileOpen(false)}>
              <Button variant="outline" className="w-full">
                마이페이지
              </Button>
            </Link>
            <Link href="/app/pricing" onClick={() => setProfileOpen(false)}>
              <Button variant="outline" className="w-full">
                요금제 구독 정보
              </Button>
            </Link>
            {user.guest && (
              <Link href="/signup" onClick={() => setProfileOpen(false)}>
                <Button className="w-full">정식 회원가입</Button>
              </Link>
            )}
            <button onClick={logout} className="w-full text-sm text-coral py-2">
              로그아웃
            </button>
          </div>
        </Modal>
      )}

      {/* 온보딩 캐러셀 */}
      {showOnboard && <OnboardingCarousel onClose={closeOnboard} name={user.name} />}
    </div>
  );
}

export function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div className="relative bg-card border border-line rounded-2xl p-6 w-full max-w-sm float-in shadow-xl">
        {children}
      </div>
    </div>
  );
}

const SLIDES = [
  { c: "#0066cc", t: "설문 한 번이면 전략까지", d: "사람·계정·톤·금지표현을 받아 계정에 맞는 전략과 주제를 제안해요." },
  { c: "#1d1d1f", t: "AI 기획 → 제작 → 검수", d: "주제를 고르면 카드뉴스 초안이 한 번에. 발행 전 검수 게이트는 필수예요." },
  { c: "#0071e3", t: "발행은 내가, 성장은 함께", d: "최종 승인·발행은 언제나 나. 칸반·챌린지로 꾸준함을 이어가요." },
];

function OnboardingCarousel({ onClose, name }: { onClose: () => void; name: string }) {
  const [i, setI] = useState(0);
  const last = i === SLIDES.length - 1;
  return (
    <Modal onClose={onClose}>
      <div
        className="rounded-xl h-40 grid place-items-center text-white font-display text-3xl mb-4"
        style={{ background: SLIDES[i].c }}
      >
        GIF
      </div>
      <div className="text-center">
        <h3 className="font-display text-xl">{SLIDES[i].t}</h3>
        <p className="text-sm text-ink-soft mt-2">{SLIDES[i].d}</p>
      </div>
      <div className="flex justify-center gap-1.5 mt-4">
        {SLIDES.map((_, idx) => (
          <span key={idx} className={`w-2 h-2 rounded-full ${idx === i ? "bg-coral" : "bg-paper-2"}`} />
        ))}
      </div>
      <div className="flex items-center justify-between mt-5">
        <button onClick={onClose} className="text-sm text-muted">
          건너뛰기
        </button>
        {last ? (
          <Button onClick={onClose}>{name}님, 시작하기 →</Button>
        ) : (
          <Button onClick={() => setI((x) => x + 1)}>다음</Button>
        )}
      </div>
    </Modal>
  );
}
