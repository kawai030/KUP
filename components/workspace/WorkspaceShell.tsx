"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/workspace/client";
import { Badge, Button, Logo } from "@/components/workspace/ui";
import { Icon, type IconName } from "@/components/ui/icon";
import { activeIgHandle, type PublicUser } from "@/lib/workspace/types";

const NAV: { href: string; label: string; icon: IconName; desc: string }[] = [
  { href: "/app/home", label: "홈", icon: "home", desc: "워크스페이스 개요" },
  { href: "/app/plans", label: "AI 콘텐츠 생성", icon: "sparkle", desc: "주제 기획·제작" },
  { href: "/app/board", label: "콘텐츠 관리", icon: "layers", desc: "칸반 보드" },
  { href: "/app/insights", label: "콘텐츠 성과", icon: "chart", desc: "인사이트·챌린지" },
  { href: "/app/dm", label: "DM 리드마그넷", icon: "message", desc: "자동화 설정" },
];

export function WorkspaceShell({
  user,
  children,
}: {
  user: PublicUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showOnboard, setShowOnboard] = useState(!user.onboarded);
  const [acctOpen, setAcctOpen] = useState(false);

  const handle = activeIgHandle(user);
  const activeId = user.activeIgAccountId ?? user.igAccounts[0]?.id;

  async function logout() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    // 하드 리로드로 완전 로그아웃 (클라이언트 상태 초기화 + 서버 상태 재조회)
    window.location.href = "/";
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
      {/* 연동 인스타 계정 — 스위처 드롭다운 */}
      <div className="px-2 mb-4 relative">
        <div className="text-[11px] font-semibold tracking-wide text-muted uppercase mb-1.5 px-1.5 flex items-center gap-1.5">
          연동 인스타 계정
          {user.igAccounts.length > 0 && (
            <span className="inline-grid place-items-center min-w-[18px] h-[18px] px-1 rounded-full bg-teal-soft text-teal text-[10px] leading-none normal-case">
              {user.igAccounts.length}
            </span>
          )}
        </div>
        {user.igAccounts.length === 0 ? (
          <Link
            href="/app/accounts"
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-1.5 rounded-[10px] border border-dashed border-line bg-paper-2/50 px-3 py-2.5 text-sm text-ink-soft hover:text-ink"
          >
            <Icon name="plus" size={16} />
            계정 연동하기
          </Link>
        ) : (
          <>
            {/* 현재 계정 = 스위처 트리거 (prototype .acct-switch) */}
            <button
              onClick={() => setAcctOpen((o) => !o)}
              className="w-full flex items-center gap-2.5 rounded-[10px] border border-line bg-paper-2/60 px-3 py-2.5 text-sm hover:bg-paper-2 transition"
            >
              <span className="w-6 h-6 rounded-full bg-ink shrink-0" />
              <span className="flex-1 text-left font-semibold truncate">@{handle}</span>
              <span className="w-2 h-2 rounded-full bg-muted shrink-0" />
            </button>

            {/* 계정 메뉴 (prototype .acct-menu) */}
            {acctOpen && (
              <div className="absolute left-2 right-2 top-full mt-1.5 z-40 rounded-lg border border-line bg-card p-2 shadow-lg">
                {user.igAccounts.map((a) => {
                  const isActive = a.id === activeId;
                  return (
                    <button
                      key={a.id}
                      onClick={() => {
                        switchAccount(a.id);
                        setAcctOpen(false);
                      }}
                      className={`w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition ${
                        isActive ? "bg-paper-2" : "hover:bg-paper-2/70"
                      }`}
                    >
                      <span className="w-7 h-7 rounded-full bg-ink shrink-0" />
                      <span className="min-w-0">
                        <b className="block truncate text-[13px] font-semibold">@{a.handle}</b>
                        <span className="block text-xs text-muted">
                          팔로워 {a.followers ?? 0}
                          {isActive ? " · 현재" : ""}
                        </span>
                      </span>
                    </button>
                  );
                })}

                {/* add 행 — 상단 구분선 + 굵은 글씨 (prototype .acct-row.add) */}
                <Link
                  href="/app/workspaces"
                  onClick={() => {
                    setAcctOpen(false);
                    setMenuOpen(false);
                  }}
                  className="mt-1 flex items-center gap-2 rounded-lg border-t border-line px-2.5 pb-2 pt-3 text-[13px] font-semibold text-ink hover:bg-paper-2 transition"
                >
                  <Icon name="layers" size={16} />
                  전체 워크스페이스
                </Link>
                <Link
                  href="/app/accounts"
                  onClick={() => {
                    setAcctOpen(false);
                    setMenuOpen(false);
                  }}
                  className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] font-semibold text-ink hover:bg-paper-2 transition"
                >
                  <Icon name="plus" size={16} />
                  계정 추가하기
                </Link>
              </div>
            )}
          </>
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
                active ? "bg-coral-soft text-coral font-medium" : "text-ink-soft hover:bg-paper-2"
              }`}
            >
              <span className="w-5 inline-flex items-center justify-center opacity-80">
                <Icon name={n.icon} size={18} />
              </span>
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
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col">
      {/* 상단 Header */}
      <header className="sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur">
        <div className="px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="lg:hidden text-ink-soft inline-flex items-center"
              aria-label="메뉴"
            >
              <Icon name="menu" size={20} />
            </button>
            <Logo size="md" href="/app/home" />
            {user.guest && <Badge tone="amber">비회원</Badge>}
          </div>
          <div className="flex items-center gap-2">
            {/* 연동 계정이 없을 때만: 이 제품의 핵심 첫 액션인 인스타 연동 CTA.
                연동되면 좌측바 '연동 인스타 계정'(카운트 배지 포함)이 관리를 담당한다. */}
            {user.igAccounts.length === 0 && (
              <Link href="/app/accounts">
                <Button variant="outline" size="sm">
                  계정 연동하기
                </Button>
              </Link>
            )}
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
              <Link href="/?auth=1" onClick={() => setProfileOpen(false)}>
                <Button className="w-full">로그인 / 회원가입</Button>
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
  { c: "#e52364", t: "설문 한 번이면 전략까지", d: "사람·계정·톤·금지표현을 받아 계정에 맞는 전략과 주제를 제안해요." },
  { c: "#0aa06e", t: "AI 기획 → 제작 → 검수", d: "주제를 고르면 카드뉴스 초안이 한 번에. 발행 전 검수 게이트는 필수예요." },
  { c: "#c47b00", t: "발행은 내가, 성장은 함께", d: "최종 승인·발행은 언제나 나. 칸반·챌린지로 꾸준함을 이어가요." },
];

function OnboardingCarousel({ onClose, name }: { onClose: () => void; name: string }) {
  const [i, setI] = useState(0);
  const last = i === SLIDES.length - 1;
  const slide = SLIDES[i]!;
  return (
    <Modal onClose={onClose}>
      <div
        className="rounded-xl h-40 grid place-items-center text-white font-display text-3xl mb-4"
        style={{ background: slide.c }}
      >
        GIF
      </div>
      <div className="text-center">
        <h3 className="font-display text-xl">{slide.t}</h3>
        <p className="text-sm text-ink-soft mt-2">{slide.d}</p>
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
          <Button onClick={onClose}>
            {name}님, 시작하기
            <Icon name="arrowRight" size={16} />
          </Button>
        ) : (
          <Button onClick={() => setI((x) => x + 1)}>다음</Button>
        )}
      </div>
    </Modal>
  );
}
