"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/workspace/client";
import { Button } from "@/components/workspace/ui";
import type { IgAccount, PublicUser } from "@/lib/workspace/types";

/**
 * 전체 워크스페이스 · 계정 (kup-prototype-lowfi.html #view-hub 이식).
 * 계정 카드(팔로워·이번주 발행·주간순증) + 워크스페이스 열기/계정 관리 + 새 계정 연동.
 * (mock 단계: 데모 계정 시드 표시. 실연동 시 인스타 인사이트로 교체)
 */
export default function WorkspacesPage() {
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    api<{ user: PublicUser }>("/api/auth/me")
      .then((r) => setUser(r.user))
      .catch(() => setUser(null));
  }, []);

  async function openWorkspace(id: string) {
    setBusy(id);
    await api("/api/ig", { method: "PATCH", body: { activeId: id } });
    router.push("/app/home");
    router.refresh();
  }

  if (!user) return <p className="text-sm text-muted">불러오는 중…</p>;

  const activeId = user.activeIgAccountId ?? user.igAccounts[0]?.id;

  return (
    <div className="float-in">
      {/* page-head */}
      <header className="mb-6">
        <h1 className="font-display text-2xl text-ink">내 워크스페이스 · 계정</h1>
        <p className="mt-1 text-sm text-ink-soft">
          계정을 골라 워크스페이스로 들어가고, 여기서 연동을 추가·관리해요.
        </p>
      </header>

      {/* hub-grid: 2열 */}
      <div className="grid gap-4 sm:grid-cols-2">
        {user.igAccounts.map((a) => (
          <AccountCard
            key={a.id}
            acc={a}
            active={a.id === activeId}
            busy={busy === a.id}
            onOpen={() => openWorkspace(a.id)}
          />
        ))}

        {/* hub-card.add — 그리드 셀 하나 */}
        <Link
          href="/app/accounts"
          className="grid min-h-[180px] place-items-center rounded-lg border border-dashed border-line bg-card/40 p-5 text-center text-ink-soft transition hover:border-ink/30 hover:text-ink"
        >
          <span className="text-sm font-medium">＋ 새 인스타그램 계정 연동</span>
        </Link>
      </div>

      {/* safe-note */}
      <p className="mt-5 rounded-lg bg-paper-2/60 px-4 py-3 text-xs text-muted">
        🔒 인스타그램 공식 연동(OAuth)을 사용해요. KUP는 비밀번호를 보관하지 않으며, 권한은 콘텐츠 발행·인사이트 조회에만 쓰입니다.
      </p>
    </div>
  );
}

function AccountCard({
  acc,
  active,
  busy,
  onOpen,
}: {
  acc: IgAccount;
  active: boolean;
  busy: boolean;
  onOpen: () => void;
}) {
  return (
    <div className="rounded-lg border border-line bg-card p-5 transition hover:border-ink/25">
      {/* hub-top */}
      <div className="flex items-center gap-3">
        <span className="w-11 h-11 rounded-full bg-ink shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-ink truncate">@{acc.handle}</div>
          <div className="text-xs text-muted truncate">
            {acc.niche ? `${acc.niche} · ` : ""}연동됨
          </div>
        </div>
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${active ? "bg-ink-soft" : "bg-line"}`} />
      </div>

      {/* hub-stats */}
      <div className="my-4 grid grid-cols-3 gap-2 border-y border-line py-3.5 text-center">
        <Stat value={acc.followers ?? 0} label="팔로워" />
        <Stat value={acc.weeklyPublished ?? 0} label="이번 주 발행" />
        <Stat value={`+${acc.weeklyGrowth ?? 0}`} label="주간 순증" />
      </div>

      {/* hub-card-foot */}
      <div className="flex gap-2">
        <Button size="sm" className="flex-1" onClick={onOpen} disabled={busy}>
          {busy ? "여는 중…" : "워크스페이스 열기"}
        </Button>
        <Link href="/app/accounts" className="flex-1">
          <Button variant="outline" size="sm" className="w-full">
            계정 관리
          </Button>
        </Link>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div>
      <div className="text-lg font-bold text-ink">{value}</div>
      <div className="mt-0.5 text-xs text-muted">{label}</div>
    </div>
  );
}
