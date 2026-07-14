"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/workspace/client";
import { Badge, Button, Card, EmptyState, Field, inputClass, SectionTitle } from "@/components/workspace/ui";
import { DM_LIMITS, DM_TEMPLATE, renderDmMessage, type DmRule, type PublicUser } from "@/lib/workspace/types";

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
        desc="게시물에 키워드를 걸어, 댓글 단 사람에게 자료를 자동 DM으로 보내요. (공식 API · 옵트인)"
        action={!creating ? <Button size="sm" onClick={() => setCreating(true)}>+ 규칙 추가</Button> : undefined}
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

      {err && <p className="text-sm text-coral">{err}</p>}

      {creating && (
        <RuleForm
          onCreated={(r) => { setRules((rs) => [r, ...rs]); setCreating(false); }}
          onCancel={() => setCreating(false)}
        />
      )}

      {rules.length === 0 && !creating ? (
        <Card>
          <EmptyState
            title="아직 DM 규칙이 없어요"
            desc="‘규칙 추가’로 게시물·댓글 키워드와 보낼 정보 DM을 설정해 보세요."
            action={<Button onClick={() => setCreating(true)}>규칙 만들기</Button>}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {rules.map((r) => (
            <RuleCard key={r.id} rule={r} onToggle={toggle} onSimulate={simulate} onRemove={remove} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── 규칙 카드 (목록) ──────────────────────────────────────────────────────────
function RuleCard({
  rule, onToggle, onSimulate, onRemove,
}: {
  rule: DmRule;
  onToggle: (r: DmRule) => void;
  onSimulate: (r: DmRule) => void;
  onRemove: (id: string) => void;
}) {
  const target = rule.mediaId ? `📷 ${rule.postReference || "특정 게시물"}` : "전체 게시물";
  const title = (rule.dmMessage.split("\n")[0] || "DM 자동 발송").trim();
  return (
    <Card className={`group p-4 flex items-center gap-3 ${rule.enabled ? "" : "opacity-60"}`}>
      {/* 키워드 칩 */}
      <span className="inline-flex items-center rounded-md bg-paper-2 px-2.5 py-1 text-sm font-medium text-ink shrink-0">{rule.triggerKeyword}</span>

      {/* 제목(보낼 DM) + 서브라인(게시물·흐름) */}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-ink truncate">{title}</div>
        <div className="text-xs text-muted truncate">{target} · 댓글 → DM</div>
      </div>

      {/* 시뮬레이션·삭제 — 평소 숨김, hover 시 노출 */}
      <div className="hidden group-hover:flex items-center gap-1 shrink-0">
        <Button size="sm" variant="ghost" onClick={() => onSimulate(rule)} disabled={!rule.enabled}>시뮬레이션</Button>
        <Button size="sm" variant="ghost" onClick={() => onRemove(rule.id)}>삭제</Button>
      </div>

      <span className="text-xs text-muted shrink-0">발송 {rule.sentCount.toLocaleString()}</span>
      <Switch on={rule.enabled} onClick={() => onToggle(rule)} />
    </Card>
  );
}

// 활성/비활성 토글 스위치
function Switch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onClick}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${on ? "bg-coral" : "bg-line"}`}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-card shadow transition-transform ${on ? "translate-x-4" : "translate-x-0.5"}`} />
    </button>
  );
}

// ── DM 말풍선 (미리보기 공용) ─────────────────────────────────────────────────
function DmBubble({ text, link, muted }: { text: string; link?: string; muted?: boolean }) {
  return (
    <div className={`inline-block max-w-[85%] rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm preserve-lines ${muted ? "bg-paper-2/60 text-muted" : "bg-paper-2 text-ink-soft"}`}>
      {renderDmMessage(text || DM_TEMPLATE, link)}
    </div>
  );
}

interface IgMediaSummary { id: string; caption: string; permalink?: string; mediaType?: string; timestamp?: string }

// 게시물 라벨: 캡션 첫 줄(없으면 형식) + 날짜
function mediaLabel(m: IgMediaSummary): string {
  const head = (m.caption.split("\n")[0] || m.mediaType || "게시물").slice(0, 28);
  const date = m.timestamp ? m.timestamp.slice(0, 10) : "";
  return date ? `${head} · ${date}` : head;
}

// ── 규칙 추가 폼 ──────────────────────────────────────────────────────────────
// 규칙 작성 가이드 — 각 항목 미니 예시 + 설명을 한눈에(텍스트 나열 대신 시각적으로)
function RuleHelp() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 text-xs text-ink-soft border border-line rounded-full pl-1.5 pr-2.5 py-1 hover:bg-paper-2"
      >
        <span className="w-4 h-4 inline-flex items-center justify-center rounded-full border border-line text-[10px] leading-none">?</span>
        작성 가이드
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-[360px] max-w-[88vw] rounded-xl border border-line bg-card shadow-xl z-40 p-4">
            <div className="flex items-center justify-between mb-1">
              <div className="text-sm font-medium">이렇게 작성해요</div>
              <button type="button" onClick={() => setOpen(false)} className="text-muted hover:text-ink">✕</button>
            </div>
            <p className="text-xs text-muted mb-3">대상 게시물에 키워드 댓글이 달리면 → 작성한 DM이 자동 발송돼요.</p>
            <div className="space-y-3">
              <HelpRow n="①" title="대상 게시물" desc="어떤 게시물의 댓글에 반응할지 (전체도 가능)">
                <div className="rounded-lg border border-line px-3 py-1.5 text-xs text-ink flex items-center justify-between"><span>전체 게시물</span><span className="text-muted">▾</span></div>
              </HelpRow>
              <HelpRow n="②" title="트리거 키워드" desc="댓글에 이 단어가 있으면 DM 발동">
                <div className="rounded-lg border border-line px-3 py-1.5 text-xs text-ink w-24">자료</div>
              </HelpRow>
              <HelpRow n="③" title="발송 DM 문구" desc="댓글 단 사람에게 보낼 메시지">
                <div className="rounded-lg border border-line px-3 py-1.5 text-xs text-ink">안녕하세요! 자료 보내드려요 🙌</div>
              </HelpRow>
              <HelpRow n="④" title="자료 링크" desc="팔로워에게 줄 자료 — DM 끝에 자동 첨부 (쿠폰·정리본 등)">
                <div className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted">https://…</div>
              </HelpRow>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function HelpRow({ n, title, desc, children }: { n: string; title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5">
      <span className="text-coral text-sm shrink-0 leading-6">{n}</span>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-ink">{title}</div>
        <div className="mt-1">{children}</div>
        <div className="text-[11px] text-muted mt-1">{desc}</div>
      </div>
    </div>
  );
}

function RuleForm({ onCreated, onCancel }: { onCreated: (r: DmRule) => void; onCancel: () => void }) {
  const [triggerKeyword, setTriggerKeyword] = useState("");
  const [mediaId, setMediaId] = useState(""); // "" = 전체 게시물
  const [dmMessage, setDmMessage] = useState(DM_TEMPLATE); // 기본 문구 미리 채움(수정 가능)
  const [resourceLink, setResourceLink] = useState("");
  const [optIn, setOptIn] = useState(false);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [media, setMedia] = useState<IgMediaSummary[]>([]);
  const [mediaLive, setMediaLive] = useState(true);

  // 활성(정식) 계정의 게시물 목록 로드 — 선택기 채우기
  useEffect(() => {
    api<{ live: boolean; media: IgMediaSummary[] }>("/api/ig/media")
      .then((r) => { setMedia(r.media); setMediaLive(r.live); })
      .catch(() => setMediaLive(false));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setSaving(true);
    try {
      const picked = media.find((m) => m.id === mediaId);
      const postReference = picked ? mediaLabel(picked) : "";
      const { rule } = await api<{ rule: DmRule }>("/api/dm/rules", {
        method: "POST",
        body: { triggerKeyword, mediaId: mediaId || undefined, postReference, dmMessage, resourceLink, optIn, enabled: true },
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
      {/* 헤더 + 시각적 작성 가이드 */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-medium">규칙 추가 <span className="text-muted font-normal">· 게시물에 키워드를 연결해요</span></div>
        <RuleHelp />
      </div>
      <form onSubmit={submit} className="space-y-4">
        <Field label="① 대상 게시물">
          <select className={inputClass} value={mediaId} onChange={(e) => setMediaId(e.target.value)} disabled={!mediaLive || media.length === 0}>
            <option value="">전체 게시물</option>
            {media.map((m) => (
              <option key={m.id} value={m.id}>{mediaLabel(m)}</option>
            ))}
          </select>
        </Field>

        <Field label="② 트리거 키워드">
          <input className={inputClass} value={triggerKeyword} onChange={(e) => setTriggerKeyword(e.target.value)} placeholder="자료" />
        </Field>

        <Field label="③ 발송 DM 문구">
          <textarea className={inputClass} rows={3} value={dmMessage} onChange={(e) => setDmMessage(e.target.value)} placeholder={DM_TEMPLATE} />
        </Field>

        <Field label="④ 자료 링크 (선택)">
          <input className={inputClass} value={resourceLink} onChange={(e) => setResourceLink(e.target.value)} placeholder="https://… (DM 끝에 자동 첨부)" />
        </Field>

        {/* 실시간 DM 미리보기 */}
        <div className="rounded-xl border border-line bg-paper/60 p-4">
          <div className="text-xs text-muted mb-2">DM 미리보기 — 팔로워가 받는 메시지</div>
          <DmBubble text={dmMessage} link={resourceLink} muted={!dmMessage} />
        </div>

        <label className="flex items-start gap-2.5 text-sm bg-paper-2/50 rounded-xl p-3">
          <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[#3182f6]" />
          <span className="text-ink-soft"><b>옵트인 동의</b> — 동의(키워드 댓글)한 사용자에게만 발송하며, 콜드 DM·자동팔로우·대량 발송을 하지 않는다는 정책에 동의합니다. (필수)</span>
        </label>

        {err && <p className="text-sm text-coral">{err}</p>}

        <div className="flex items-center justify-between pt-1">
          <Button type="button" variant="outline" onClick={onCancel}>취소</Button>
          <Button type="submit" disabled={saving}>{saving ? "저장 중…" : "규칙 저장"}</Button>
        </div>
      </form>
    </Card>
  );
}
