"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client";
import { Badge, Button, Card, EmptyState, Field, inputClass, SectionTitle } from "@/components/ui";
import { DM_LIMITS, type DmRule, type PublicUser } from "@/lib/types";

export default function DmPage() {
  const [rules, setRules] = useState<DmRule[]>([]);
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    const [{ rules }, { user }] = await Promise.all([
      api<{ rules: DmRule[] }>("/api/dm/rules"),
      api<{ user: PublicUser }>("/api/auth/me"),
    ]);
    setRules(rules);
    setUser(user);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  const sent = useMemo(() => rules.reduce((s, r) => s + r.sentCount, 0), [rules]);
  const limit = user ? DM_LIMITS[user.plan] : 100;
  const limitLabel = limit === Infinity ? "무제한" : limit.toLocaleString();

  async function toggle(rule: DmRule) {
    const { rule: r } = await api<{ rule: DmRule }>("/api/dm/rules", { method: "PATCH", body: { id: rule.id, enabled: !rule.enabled } });
    setRules((rs) => rs.map((x) => (x.id === r.id ? r : x)));
  }
  async function simulate(rule: DmRule) {
    setErr("");
    try {
      const { rule: r } = await api<{ rule: DmRule }>("/api/dm/rules", { method: "PATCH", body: { id: rule.id, action: "simulate" } });
      setRules((rs) => rs.map((x) => (x.id === r.id ? r : x)));
    } catch (e) {
      setErr((e as Error).message);
    }
  }
  async function remove(id: string) {
    await api("/api/dm/rules", { method: "DELETE", body: { id } });
    setRules((rs) => rs.filter((x) => x.id !== id));
  }

  if (loading) return <div className="py-20 text-center text-muted">불러오는 중…</div>;

  return (
    <div className="space-y-6">
      <SectionTitle
        eyebrow="자동화 설정 · 그로스 마케팅"
        title="DM 리드마그넷"
        desc="댓글 트리거 → 정보 DM(공식 API · 옵트인). 콜드 DM·자동팔로우는 하지 않아요."
        action={<Button size="sm" onClick={() => setCreating((v) => !v)}>{creating ? "닫기" : "+ 규칙 추가"}</Button>}
      />

      {/* 플랜 한도 */}
      {user && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium">이번 달 DM 한도 <Badge tone="coral">{user.plan}</Badge></div>
            <div className="text-sm text-ink-soft">{sent.toLocaleString()} / {limitLabel}</div>
          </div>
          <div className="h-2 bg-paper-2 rounded-full overflow-hidden">
            <div className="h-full bg-teal rounded-full" style={{ width: limit === Infinity ? "12%" : `${Math.min(100, (sent / limit) * 100)}%` }} />
          </div>
          <p className="text-xs text-muted mt-2">댓글 수에 따라 발송돼요. 한도: 베이직 100 · 프로 1,000 · 프리미엄 무제한.</p>
        </Card>
      )}

      <Card className="p-4 bg-paper-2/50 text-sm text-ink-soft flex gap-3">
        <span className="text-lg">✉</span>
        특정 게시물에 지정 키워드 댓글이 달리면, 동의 기반으로 정보 DM(리드마그넷 링크)을 보내는 흐름이에요.
        베타에서는 ‘시뮬레이션 발송’으로 동작을 확인합니다.
      </Card>

      {err && <p className="text-sm text-coral">{err}</p>}
      {creating && <RuleForm onCreated={(r) => { setRules((rs) => [r, ...rs]); setCreating(false); }} />}

      {rules.length === 0 && !creating ? (
        <Card>
          <EmptyState title="아직 DM 규칙이 없어요" desc="‘규칙 추가’로 댓글 키워드와 보낼 정보 DM을 설정해 보세요." action={<Button onClick={() => setCreating(true)}>규칙 만들기</Button>} />
        </Card>
      ) : (
        <div className="space-y-3">
          {rules.map((r) => (
            <Card key={r.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge tone={r.enabled ? "teal" : "muted"}>{r.enabled ? "활성" : "비활성"}</Badge>
                    <span className="font-medium">트리거 “{r.triggerKeyword}”</span>
                  </div>
                  {r.postReference && <div className="text-sm text-ink-soft mt-1">게시물: {r.postReference}</div>}
                  <p className="text-sm text-ink-soft mt-2 preserve-lines bg-paper-2/50 rounded-lg p-3">
                    {r.dmMessage}{r.resourceLink && `\n🔗 ${r.resourceLink}`}
                  </p>
                  <div className="text-xs text-muted mt-2">시뮬레이션 발송 {r.sentCount}회</div>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <Button size="sm" variant="outline" onClick={() => toggle(r)}>{r.enabled ? "비활성화" : "활성화"}</Button>
                <Button size="sm" variant="soft" onClick={() => simulate(r)} disabled={!r.enabled}>시뮬레이션 발송</Button>
                <Button size="sm" variant="ghost" onClick={() => remove(r.id)}>삭제</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function RuleForm({ onCreated }: { onCreated: (r: DmRule) => void }) {
  const [triggerKeyword, setTriggerKeyword] = useState("");
  const [postReference, setPostReference] = useState("");
  const [dmMessage, setDmMessage] = useState("");
  const [resourceLink, setResourceLink] = useState("");
  const [optIn, setOptIn] = useState(false);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setSaving(true);
    try {
      const { rule } = await api<{ rule: DmRule }>("/api/dm/rules", {
        method: "POST",
        body: { triggerKeyword, postReference, dmMessage, resourceLink, optIn, enabled: true },
      });
      onCreated(rule);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-6">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="트리거 키워드" hint="댓글에 포함될 단어">
            <input className={inputClass} value={triggerKeyword} onChange={(e) => setTriggerKeyword(e.target.value)} placeholder="자료" />
          </Field>
          <Field label="적용 게시물" hint="설명">
            <input className={inputClass} value={postReference} onChange={(e) => setPostReference(e.target.value)} placeholder="신메뉴 카드뉴스" />
          </Field>
        </div>
        <Field label="발송 DM 내용">
          <textarea className={inputClass} rows={3} value={dmMessage} onChange={(e) => setDmMessage(e.target.value)} placeholder="요청 주셔서 감사해요! 정리해둔 자료 보내드려요 🙌" />
        </Field>
        <Field label="리드마그넷 링크" hint="선택">
          <input className={inputClass} value={resourceLink} onChange={(e) => setResourceLink(e.target.value)} placeholder="https://..." />
        </Field>
        <label className="flex items-start gap-2.5 text-sm bg-paper-2/50 rounded-xl p-3">
          <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[#1f6f63]" />
          <span className="text-ink-soft"><b>옵트인 동의</b> — 동의(키워드 댓글)한 사용자에게만 발송하며, 콜드 DM·자동팔로우·대량 발송을 하지 않는다는 정책에 동의합니다. (필수)</span>
        </label>
        {err && <p className="text-sm text-coral">{err}</p>}
        <Button type="submit" disabled={saving}>{saving ? "저장 중…" : "규칙 저장"}</Button>
      </form>
    </Card>
  );
}
