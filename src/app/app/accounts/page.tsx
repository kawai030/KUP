"use client";

import { useState, useEffect } from "react";
import { api, formatDate } from "@/lib/client";
import { Badge, Button, Card, EmptyState, Field, inputClass, SectionTitle } from "@/components/ui";
import type { PublicUser } from "@/lib/types";

export default function AccountsPage() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [publicBase, setPublicBase] = useState<string | null>(null);
  const [mode, setMode] = useState<"테스터" | "정식">("테스터");
  const [fbLogin, setFbLogin] = useState(false); // 고급: Facebook 로그인 방식
  const [handle, setHandle] = useState("");
  const [igUserId, setIgUserId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    const me = await api<{ user: PublicUser; publicBaseUrl: string | null }>("/api/auth/me");
    setUser(me.user);
    setPublicBase(me.publicBaseUrl);
  }
  useEffect(() => {
    load();
  }, []);

  async function connect() {
    setErr("");
    if (mode === "테스터" && !handle.trim()) return setErr("핸들을 입력하세요.");
    if (mode === "정식") {
      if (!accessToken.trim()) return setErr("액세스 토큰을 입력하세요.");
      if (fbLogin && !igUserId.trim()) return setErr("Facebook 로그인 방식은 IG User ID도 필요해요.");
    }
    setBusy(true);
    try {
      const { user } = await api<{ user: PublicUser }>("/api/ig", {
        method: "POST",
        body:
          mode === "정식"
            ? { accessToken, igUserId: fbLogin ? igUserId : undefined, handle }
            : { handle },
      });
      setUser(user);
      setHandle(""); setIgUserId(""); setAccessToken("");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function setActive(id: string) {
    const { user } = await api<{ user: PublicUser }>("/api/ig", { method: "PATCH", body: { activeId: id } });
    setUser(user);
  }
  async function remove(id: string) {
    const { user } = await api<{ user: PublicUser }>("/api/ig", { method: "DELETE", body: { id } });
    setUser(user);
  }

  if (!user) return <div className="py-20 text-center text-muted">불러오는 중…</div>;

  return (
    <div className="space-y-6">
      <SectionTitle eyebrow="워크스페이스" title="연동 인스타 계정" desc="한 워크스페이스에서 여러 계정을 연결하고 전환하며 운영해요." />

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
          <div className="space-y-3">
            <Field label="액세스 토큰" hint="콘텐츠 발행 권한 토큰">
              <input className={inputClass} value={accessToken} onChange={(e) => setAccessToken(e.target.value)} placeholder="IG... 또는 EAAB..." type="password" />
            </Field>
            <details className="text-xs text-muted" open>
              <summary className="cursor-pointer text-ink-soft font-medium">토큰은 어떻게 받나요? (Instagram 로그인 방식 · 권장)</summary>
              <ol className="list-decimal list-inside mt-2 space-y-1">
                <li>인스타를 <b>프로페셔널(비즈니스/크리에이터)</b> 계정으로 전환</li>
                <li>Meta 앱 → 앱 역할에서 본인 인스타를 <b>Instagram 테스터</b>로 추가하고, 인스타 앱에서 수락</li>
                <li>앱 → Instagram API → <b>“Instagram 로그인이 포함된 API 설정” → 2. 액세스 토큰 생성 → 계정 추가</b></li>
                <li>나온 <b>액세스 토큰</b>을 위에 붙여넣기 (IG User ID는 자동으로 찾아요)</li>
              </ol>
              <p className="mt-2">권한 및 기능에서 <code>instagram_business_content_publish</code> 가 추가돼 있어야 발행됩니다.</p>
            </details>

            <details className="text-xs text-muted">
              <summary className="cursor-pointer text-ink-soft">고급: Facebook 로그인 방식 (페이지 연결 + IG User ID)</summary>
              <label className="flex items-center gap-2 mt-2">
                <input type="checkbox" checked={fbLogin} onChange={(e) => setFbLogin(e.target.checked)} className="w-4 h-4 accent-[#0066cc]" />
                Facebook 로그인 방식 사용 (IG User ID 직접 입력)
              </label>
              {fbLogin && (
                <div className="mt-2">
                  <Field label="Instagram User ID">
                    <input className={inputClass} value={igUserId} onChange={(e) => setIgUserId(e.target.value)} placeholder="17841400000000000" />
                  </Field>
                </div>
              )}
            </details>

            <Button onClick={connect} disabled={busy}>{busy ? "검증·연동 중…" : "정식 연동"}</Button>
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
          <EmptyState title="연동된 계정이 없어요" desc="위에서 계정을 추가하세요." />
        </Card>
      ) : (
        <div className="space-y-2">
          {user.igAccounts.map((a) => {
            const active = a.id === (user.activeIgAccountId ?? user.igAccounts[0]?.id);
            return (
              <Card key={a.id} className="p-4 flex items-center justify-between gap-3">
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
