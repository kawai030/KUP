"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api, formatDate } from "@/lib/workspace/client";
import { Badge, Button, Card, EmptyState, Field, inputClass, SectionTitle } from "@/components/workspace/ui";
import type { PublicUser } from "@/lib/workspace/types";

export default function AccountsPage() {
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [publicBase, setPublicBase] = useState<string | null>(null);
  const [mode, setMode] = useState<"테스터" | "정식">("테스터");
  const [handle, setHandle] = useState("");
  const [token, setToken] = useState(""); // 정식 연동 — Meta 대시보드에서 '토큰 생성'으로 받은 액세스 토큰
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState<{ tone: "ok" | "err"; msg: string } | null>(null);

  async function load() {
    const me = await api<{ user: PublicUser; publicBaseUrl: string | null }>("/api/auth/me");
    setUser(me.user);
    setPublicBase(me.publicBaseUrl);
  }
  useEffect(() => {
    load();
  }, []);

  // OAuth 콜백 결과(/api/ig/oauth/callback 리다이렉트) 표시 후 URL 정리
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const connected = sp.get("ig_connected");
    const error = sp.get("ig_error");
    if (connected) setNotice({ tone: "ok", msg: `인스타 연동 완료! ${connected !== "1" ? `@${connected}` : ""}`.trim() });
    else if (error) setNotice({ tone: "err", msg: `연동 실패: ${error}` });
    if (connected || error) window.history.replaceState({}, "", "/app/accounts");
  }, []);

  // 테스터(시뮬레이션) 연동 — 핸들만 입력. 정식 연동은 "인스타로 로그인"(OAuth) 사용.
  async function connect() {
    setErr("");
    if (!handle.trim()) return setErr("핸들을 입력하세요.");
    setBusy(true);
    try {
      const { user } = await api<{ user: PublicUser }>("/api/ig", {
        method: "POST",
        body: { handle },
      });
      setUser(user);
      setHandle("");
      router.refresh(); // 서버 레이아웃 재조회 → 좌측 사이드바 계정 스위처 즉시 갱신
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  // 정식 연동(토큰 직접) — Meta 대시보드 '액세스 토큰 생성'으로 받은 토큰을 붙여넣어 실제 계정 연결.
  // OAuth 리디렉션·앱 자격증명 없이도 되는 가장 빠른 경로(Instagram 로그인 방식).
  async function connectWithToken() {
    setErr("");
    if (!token.trim()) return setErr("액세스 토큰을 붙여넣으세요.");
    setBusy(true);
    try {
      const { user } = await api<{ user: PublicUser }>("/api/ig", {
        method: "POST",
        body: { accessToken: token.trim() },
      });
      setUser(user);
      setToken("");
      setNotice({ tone: "ok", msg: "인스타 계정을 연결했어요." });
      router.refresh(); // 사이드바 계정 스위처 즉시 갱신
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function setActive(id: string) {
    const { user } = await api<{ user: PublicUser }>("/api/ig", { method: "PATCH", body: { activeId: id } });
    setUser(user);
    router.refresh(); // 활성 계정 변경 → 사이드바 반영
  }
  async function remove(id: string) {
    const { user } = await api<{ user: PublicUser }>("/api/ig", { method: "DELETE", body: { id } });
    setUser(user);
    router.refresh(); // 해제 → 사이드바 반영
  }

  if (!user) return <div className="py-20 text-center text-muted">불러오는 중…</div>;

  return (
    <div className="space-y-6">
      <SectionTitle eyebrow="워크스페이스" title="연동 인스타 계정" desc="한 워크스페이스에서 여러 계정을 연결하고 전환하며 운영해요." />

      {notice && (
        <Card className={`p-4 text-sm flex items-center justify-between gap-3 ${notice.tone === "ok" ? "bg-teal-soft/40 border-teal-soft text-ink" : "bg-coral/10 border-coral/30 text-coral"}`}>
          <span>{notice.msg}</span>
          <button onClick={() => setNotice(null)} className="text-muted hover:text-ink">✕</button>
        </Card>
      )}

      <Card className="p-5 bg-teal-soft/40 border-teal-soft flex gap-3">
        <span className="text-lg">🔒</span>
        <p className="text-sm text-ink-soft">
          공식 Graph API로 연결되며 <b>비밀번호는 저장하지 않아요.</b> 토큰은 발행 목적에만 사용됩니다.
          실제 발행은 인스타 비즈니스/크리에이터 계정 + 발행 권한 토큰이 필요해요.
        </p>
      </Card>

      <Card className="p-5">
        {/* 연결 방식 */}
        <div className="flex gap-1 bg-paper-2/60 p-1 rounded-xl w-fit mb-4">
          {(["테스터", "정식"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={`px-3.5 py-1.5 rounded-lg text-sm ${mode === m ? "bg-card shadow-sm text-ink" : "text-ink-soft"}`}>
              {m === "테스터" ? "테스터 (시뮬레이션)" : "정식 연동 (실제 발행)"}
            </button>
          ))}
        </div>

        {mode === "테스터" ? (
          <div className="flex gap-2 items-end max-w-md">
            <Field label="인스타 핸들" hint="발행은 모의 처리">
              <input className={inputClass} value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@my_account" />
            </Field>
            <Button onClick={connect} disabled={busy}>{busy ? "연동 중…" : "연동"}</Button>
          </div>
        ) : (
          <div className="space-y-3 max-w-md">
            {/* 메인 — 실사용자 경로. 사용자가 자기 인스타로 로그인해 '허용'만 누르면 연동. */}
            <div className="rounded-xl border border-line p-4">
              <div className="font-medium text-sm">인스타로 로그인</div>
              <p className="text-xs text-muted mt-1">인스타 인증 화면에서 &lsquo;허용&rsquo;만 누르면 연동돼요. 토큰을 직접 다룰 필요가 없어요.</p>
              <Button className="mt-3" onClick={() => { window.location.href = "/api/ig/oauth/start"; }}>
                인스타로 로그인
              </Button>
            </div>
            {/* 고급 — 개발자/테스터가 Meta 대시보드에서 생성한 토큰을 직접 붙여넣는 경로(접힘). */}
            <details className="rounded-xl border border-line px-4 py-3">
              <summary className="text-sm text-ink-soft cursor-pointer select-none">개발자 · 액세스 토큰 직접 입력</summary>
              <div className="mt-3">
                <p className="text-xs text-muted">
                  Meta 앱 대시보드에서 생성한 <b>테스터 토큰</b>이 있을 때만 사용하세요. 일반 사용자는 위 &lsquo;인스타로 로그인&rsquo;을 씁니다.
                </p>
                <Field label="액세스 토큰" hint="IGAA… 로 시작하는 긴 문자열">
                  <input className={inputClass} value={token} onChange={(e) => setToken(e.target.value)} placeholder="IGAA..." autoComplete="off" spellCheck={false} />
                </Field>
                <Button variant="ghost" className="mt-2" onClick={connectWithToken} disabled={busy}>{busy ? "연동 중…" : "이 토큰으로 연동"}</Button>
              </div>
            </details>
          </div>
        )}
        {err && <p className="text-sm text-coral mt-2">{err}</p>}
      </Card>

      {/* 공개 URL 상태 */}
      <Card className="p-4 flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm">
          이미지 공개 주소(PUBLIC_BASE_URL):{" "}
          {publicBase ? <Badge tone="teal">설정됨</Badge> : <Badge tone="amber">미설정</Badge>}
        </div>
        <span className="text-xs text-muted">{publicBase ?? "정식 발행하려면 ngrok 등 공개 https 주소가 필요해요."}</span>
      </Card>

      {user.igAccounts.length === 0 ? (
        <Card>
          <EmptyState icon="instagram" title="연동된 계정이 없어요" desc="위에서 계정을 추가하세요." />
        </Card>
      ) : (
        <div className="space-y-2">
          {user.igAccounts.map((a) => {
            const active = a.id === (user.activeIgAccountId ?? user.igAccounts[0]?.id);
            return (
              <Card key={a.id} className="group p-4 flex items-center justify-between gap-3 transition hover:border-coral/25 hover:bg-coral-soft/30">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-10 h-10 rounded-full bg-ink text-paper grid place-items-center font-medium">{a.handle[0]?.toUpperCase()}</span>
                  <div className="min-w-0">
                    <div className="font-medium truncate flex items-center gap-2">
                      @{a.handle}
                      <Badge tone={a.mode === "정식" ? "teal" : "amber"}>{a.mode === "정식" ? "정식" : "테스터"}</Badge>
                    </div>
                    <div className="text-xs text-muted">연동 {formatDate(a.connectedAt)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {active ? <Badge tone="teal">활성 계정</Badge> : <Button variant="outline" size="sm" onClick={() => setActive(a.id)}>활성으로</Button>}
                  <Button variant="ghost" size="sm" onClick={() => remove(a.id)}>해제</Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
