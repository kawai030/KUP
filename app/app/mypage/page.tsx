"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, formatDate } from "@/lib/workspace/client";
import { Button, Card, Field, inputClass, SectionTitle } from "@/components/workspace/ui";
import { SurveyForm } from "@/components/workspace/SurveyForm";
import type { CardNews, PublicUser } from "@/lib/workspace/types";

type Tab = "계정" | "콘텐츠 설정" | "구독·결제" | "데이터";

export default function MyPage() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [cards, setCards] = useState<CardNews[]>([]);
  const [tab, setTab] = useState<Tab>("계정");
  const [editingSurvey, setEditingSurvey] = useState(false);

  async function load() {
    const [{ user }, { cards }] = await Promise.all([
      api<{ user: PublicUser }>("/api/auth/me"),
      api<{ cards: CardNews[] }>("/api/cards"),
    ]);
    setUser(user);
    setCards(cards);
  }
  useEffect(() => {
    load();
  }, []);

  async function logout() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/"; // 하드 리로드로 완전 로그아웃
  }

  if (!user) return <div className="py-20 text-center text-muted">불러오는 중…</div>;

  return (
    <div className="space-y-6">
      <SectionTitle eyebrow="마이페이지" title="내 계정" desc="계정·콘텐츠 설정·구독·데이터를 한 곳에서." />

      <div className="flex gap-1 bg-paper-2/60 p-1 rounded-xl w-fit flex-wrap">
        {(["계정", "콘텐츠 설정", "구독·결제", "데이터"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 rounded-lg text-sm font-medium ${tab === t ? "bg-card text-ink shadow-sm" : "text-ink-soft"}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === "계정" && <AccountTab user={user} onUpdated={setUser} onLogout={logout} />}

      {tab === "콘텐츠 설정" && (
        <Card className="p-6">
          {editingSurvey ? (
            <SurveyForm initial={user.survey} mode="edit" onSaved={() => { setEditingSurvey(false); load(); }} />
          ) : (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="font-medium">시작 설문값 (모든 생성에 상속)</div>
                <Button size="sm" variant="outline" onClick={() => setEditingSurvey(true)}>수정</Button>
              </div>
              {user.survey ? (
                <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <Row label="주제" value={user.survey.niche} />
                  <Row label="운영 목적" value={user.survey.goals.join(", ") || "—"} />
                  <Row label="주당 업로드" value={`${user.survey.weeklyCapacity}회`} />
                  <Row label="브랜드 키워드" value={user.survey.brandKeywords.join(", ") || "—"} />
                  <Row label="금지 표현" value={user.survey.forbiddenExpressions.join(", ") || "—"} />
                  <Row label="민감 도메인" value={user.survey.sensitiveDomain} />
                </dl>
              ) : (
                <p className="text-ink-soft text-sm">설문값이 없어요.</p>
              )}
            </div>
          )}
        </Card>
      )}

      {tab === "구독·결제" && <BillingTab user={user} cards={cards} />}

      {tab === "데이터" && <DataTab onChanged={load} />}
    </div>
  );
}

function AccountTab({ user, onUpdated, onLogout }: { user: PublicUser; onUpdated: (u: PublicUser) => void; onLogout: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [pwCur, setPwCur] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function saveName() {
    setErr(""); setMsg("");
    try {
      const { user: u } = await api<{ user: PublicUser }>("/api/account", { method: "PATCH", body: { name } });
      onUpdated(u);
      setMsg("닉네임을 변경했어요.");
    } catch (e) { setErr((e as Error).message); }
  }
  async function changePw() {
    setErr(""); setMsg("");
    try {
      await api("/api/account", { method: "PATCH", body: { passwordCurrent: pwCur, passwordNew: pwNew } });
      setMsg("비밀번호를 변경했어요.");
      setPwCur(""); setPwNew("");
    } catch (e) { setErr((e as Error).message); }
  }
  async function toggleMarketing() {
    const { user: u } = await api<{ user: PublicUser }>("/api/account", { method: "PATCH", body: { marketingConsent: !user.marketingConsent } });
    onUpdated(u);
  }
  async function withdraw() {
    if (!confirm("정말 회원 탈퇴할까요? 모든 데이터가 삭제되고 되돌릴 수 없어요.")) return;
    await api("/api/account", { method: "DELETE", body: { scope: "account" } });
    router.push("/");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card className="p-6 space-y-4">
        <div className="font-medium">계정 정보</div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="닉네임" hint="10자 이내">
            <div className="flex gap-2">
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={10} />
              <Button variant="outline" size="sm" onClick={saveName} disabled={name === user.name || !name.trim()}>저장</Button>
            </div>
          </Field>
          <Field label="이메일">
            <input className={`${inputClass} opacity-60`} value={user.guest ? "비회원" : user.email} disabled />
          </Field>
        </div>
        <Field label="계정 연동 관리">
          <Link href="/app/accounts"><Button variant="outline" size="sm">연동 인스타 계정 관리 →</Button></Link>
        </Field>
      </Card>

      {user.authProvider === "email" && (
        <Card className="p-6 space-y-4">
          <div className="font-medium">비밀번호 변경</div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="현재 비밀번호"><input className={inputClass} type="password" value={pwCur} onChange={(e) => setPwCur(e.target.value)} /></Field>
            <Field label="새 비밀번호" hint="영문·숫자·특수 8~16자"><input className={inputClass} type="password" value={pwNew} onChange={(e) => setPwNew(e.target.value)} /></Field>
          </div>
          <Button variant="outline" size="sm" onClick={changePw} disabled={!pwCur || !pwNew}>변경</Button>
        </Card>
      )}

      <Card className="p-6">
        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <div className="font-medium">이벤트 혜택 및 광고성 정보 수신</div>
            <div className="text-sm text-muted">새 기능·이벤트 소식을 받아요.</div>
          </div>
          <button onClick={toggleMarketing} className={`relative w-12 h-6 rounded-full transition ${user.marketingConsent ? "bg-teal" : "bg-line"}`}>
            <span className="absolute top-0.5 w-5 h-5 rounded-full bg-paper transition-all" style={{ left: user.marketingConsent ? "1.625rem" : "0.125rem" }} />
          </button>
        </label>
      </Card>

      {msg && <p className="text-sm text-teal">{msg}</p>}
      {err && <p className="text-sm text-coral">{err}</p>}

      <Card className="p-6 flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" onClick={onLogout}>로그아웃</Button>
        <button onClick={withdraw} className="text-sm text-coral hover:underline">회원 탈퇴</button>
      </Card>
    </div>
  );
}

function BillingTab({ user, cards }: { user: PublicUser; cards: CardNews[] }) {
  const thisMonth = cards.filter((c) => new Date(c.createdAt).getMonth() === new Date().getMonth()).length;
  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="font-medium mb-3">요금제 구독 정보</div>
        <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <Row label="현재 플랜" value={user.plan} />
          <Row label="구독 여부" value={user.plan === "베이직" ? "무료 이용 중" : "구독 중"} />
          <Row label="결제 주기" value={`${user.billingCycle}간`} />
          <Row label="구독 시작" value={user.subscribedAt ? formatDate(user.subscribedAt) : "—"} />
          <Row label="이번 달 생성" value={`${thisMonth}건`} />
        </dl>
        <div className="mt-4 flex gap-2">
          <Link href="/app/pricing"><Button size="sm">플랜 변경</Button></Link>
          <Button variant="outline" size="sm" onClick={() => alert("영수증 조회 — 정식 결제(PG) 연동 후 제공됩니다.")}>영수증 조회</Button>
        </div>
      </Card>
      <Card className="p-6">
        <div className="font-medium mb-2">결제 내역</div>
        <p className="text-sm text-ink-soft">
          {user.plan === "베이직" ? "결제 내역이 없어요. 베타 기간 동안 전 기능을 무료로 이용 중입니다." : "베타 기간 무료 — 정식 결제 시 내역이 여기 표시돼요."}
        </p>
      </Card>
    </div>
  );
}

function DataTab({ onChanged }: { onChanged: () => void }) {
  const [msg, setMsg] = useState("");
  async function del(period: "all" | "1" | "7" | "30") {
    const label = period === "all" ? "전체" : `${period}일 이전`;
    if (!confirm(`내 프로젝트 데이터(${label})를 삭제할까요? 되돌릴 수 없어요.`)) return;
    const { removed } = await api<{ removed: number }>("/api/account", { method: "DELETE", body: { scope: "data", period } });
    setMsg(`${removed}개 콘텐츠를 삭제했어요.`);
    onChanged();
  }
  return (
    <Card className="p-6">
      <div className="font-medium">내 프로젝트 데이터 관리</div>
      <p className="text-sm text-ink-soft mt-1 mb-4">기획·콘텐츠·발행·성과 데이터를 기간으로 또는 전체 삭제할 수 있어요.</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => del("1")}>1일 이전 삭제</Button>
        <Button variant="outline" size="sm" onClick={() => del("7")}>7일 이전 삭제</Button>
        <Button variant="outline" size="sm" onClick={() => del("30")}>30일 이전 삭제</Button>
        <Button variant="danger" size="sm" onClick={() => del("all")}>전체 삭제</Button>
      </div>
      {msg && <p className="text-sm text-teal mt-3">{msg}</p>}
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted text-xs">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}
