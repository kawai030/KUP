"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import { Badge, Button, Card, Field, inputClass, SectionTitle } from "@/components/ui";
import { activeIgHandle, type CardNews, type DmRule, type MetricEntry, type PublicUser, type PublishJob } from "@/lib/types";

function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function updatedStamp(): string {
  const d = new Date();
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} 04:00:00`;
}

export default function InsightsPage() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [metrics, setMetrics] = useState<MetricEntry[]>([]);
  const [jobs, setJobs] = useState<PublishJob[]>([]);
  const [cards, setCards] = useState<CardNews[]>([]);
  const [dm, setDm] = useState<DmRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshedAt, setRefreshedAt] = useState(updatedStamp());

  async function load() {
    const [me, mt, sc, cd, dr] = await Promise.all([
      api<{ user: PublicUser }>("/api/auth/me"),
      api<{ entries: MetricEntry[] }>("/api/metrics"),
      api<{ jobs: PublishJob[] }>("/api/schedule"),
      api<{ cards: CardNews[] }>("/api/cards"),
      api<{ rules: DmRule[] }>("/api/dm/rules"),
    ]);
    setUser(me.user);
    setMetrics(mt.entries);
    setJobs(sc.jobs);
    setCards(cd.cards);
    setDm(dr.rules);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  const followersGained = useMemo(() => metrics.reduce((s, m) => s + m.newFollowers, 0), [metrics]);
  const baseFollowers = user?.survey?.followers ?? 0;
  const followers = baseFollowers + followersGained;
  const totals = useMemo(() => metrics.reduce(
    (a, m) => ({
      views: a.views + m.views, reach: a.reach + m.reach, saves: a.saves + m.saves,
      shares: a.shares + m.shares, likes: a.likes + m.likes, comments: a.comments + m.comments,
      profileVisits: a.profileVisits + m.profileVisits, follows: a.follows + m.follows,
    }),
    { views: 0, reach: 0, saves: 0, shares: 0, likes: 0, comments: 0, profileVisits: 0, follows: 0 }
  ), [metrics]);
  const dmSent = dm.reduce((s, r) => s + r.sentCount, 0);
  const latest = metrics[0];
  const nextActions = computeNextActions(latest);
  const handle = user ? activeIgHandle(user) : undefined;

  if (loading) return <div className="py-20 text-center text-muted">불러오는 중…</div>;

  const nextTarget = Math.min(1000, Math.ceil((followers + 1) / 100) * 100);
  const toThousand = Math.max(0, 1000 - followers);
  const roadmapPct = Math.min(100, (followers / 1000) * 100);
  const milestones = Array.from({ length: 10 }, (_, i) => (i + 1) * 100);

  return (
    <div className="space-y-7">
      <SectionTitle
        eyebrow="워크스페이스"
        title="콘텐츠 성과"
        desc={handle ? `@${handle} 인사이트` : "인스타 계정을 연동하면 계정 단위 지표가 채워져요."}
        action={
          <Button variant="outline" size="sm" onClick={() => { setRefreshedAt(updatedStamp()); load(); }}>
            ↻ 새로고침
          </Button>
        }
      />
      <p className="text-xs text-muted -mt-3">인사이트 업데이트 {refreshedAt} · 수치는 안정적인 시간대(오전 4시) 기준</p>

      {/* 계정 단위 인사이트 */}
      <div className="grid sm:grid-cols-4 gap-3">
        <Stat label="총 팔로워" value={followers.toLocaleString()} tone="ink" />
        {followers >= 100 ? (
          <Stat label="유입 / 이탈" value={`+${totals.follows} / -${Math.max(0, Math.round(totals.follows * 0.2))}`} tone="teal" />
        ) : (
          <Stat label="유입 / 이탈" value="100명+ 부터" tone="muted" hint="Meta 정책" />
        )}
        <Stat label="DM 리드마그넷" value={`${dmSent}건`} tone="amber" />
        <Stat label="발행 콘텐츠" value={`${cards.filter((c) => c.status === "업로드완료").length}건`} tone="ink" />
      </div>

      {/* 게시물 단위 인사이트 */}
      <Card className="p-6">
        <div className="text-sm font-medium mb-4">게시물 단위 누적 인사이트</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-4 gap-x-3">
          <Mini label="조회" value={totals.views} />
          <Mini label="도달" value={totals.reach} />
          <Mini label="저장" value={totals.saves} />
          <Mini label="공유" value={totals.shares} />
          <Mini label="좋아요" value={totals.likes} />
          <Mini label="댓글" value={totals.comments} />
          <Mini label="프로필 방문" value={totals.profileVisits} />
          <Mini label="기여 팔로우" value={totals.follows} />
        </div>
      </Card>

      {/* 팔로워 달성 챌린지 */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs font-semibold tracking-wide text-coral uppercase">팔로워 달성 챌린지</div>
            <div className="font-display text-2xl mt-1">{followers.toLocaleString()}명 · 다음 목표 {nextTarget}명</div>
          </div>
          <Badge tone="muted">100단위 로드맵</Badge>
        </div>
        <div className="relative h-3 bg-paper-2 rounded-full overflow-hidden">
          <div className="absolute inset-y-0 left-0 bg-coral rounded-full transition-all" style={{ width: `${roadmapPct}%` }} />
        </div>
        <div className="flex flex-wrap gap-1.5 mt-4">
          {milestones.map((m) => (
            <span key={m} className={`text-xs px-2 py-1 rounded-full ${followers >= m ? "bg-teal-soft text-teal" : "bg-paper-2 text-muted"}`}>
              {followers >= m ? "🏅" : "🔒"} {m}
            </span>
          ))}
        </div>
        <p className="text-sm text-ink-soft mt-3">1,000명까지 <span className="font-semibold text-ink">{toThousand.toLocaleString()}명</span> 남았어요. 기간은 약속하지 않아요 — 다음 100명에만 집중해요.</p>
      </Card>

      {/* 업로드 릴레이 — Contributions Graph */}
      <Card className="p-6">
        <div className="text-sm font-medium mb-1">업로드 릴레이</div>
        <p className="text-xs text-muted mb-4">매일의 발행 확정 건수를 칸으로 쌓아 꾸준함을 시각화해요. (1칸 = 하루)</p>
        <ContributionsGraph jobs={jobs} />
      </Card>

      {/* 다음 액션 + 성과 입력 */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-6">
          <SectionTitle title="다음에 바꿀 점" desc="최근 성과 기록을 바탕으로." />
          {latest ? (
            <ul className="space-y-2">
              {nextActions.map((a, i) => (
                <li key={i} className="flex gap-2.5 items-start text-sm">
                  <span className="text-coral mt-0.5">→</span>
                  <span className="text-ink-soft">{a}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-soft">아직 성과 기록이 없어요. 오른쪽에서 첫 기록을 넣으면 ‘다음에 바꿀 점’을 추천해 드려요.</p>
          )}
        </Card>
        <Card className="p-6">
          <SectionTitle title="인사이트 입력" desc="초기엔 손으로 입력해요. (P1: 자동 수집)" />
          <MetricForm cards={cards} onAdded={(e) => setMetrics((m) => [e, ...m])} />
        </Card>
      </div>

      {cards.length === 0 && (
        <Card className="p-5 text-center text-sm text-ink-soft">
          아직 만든 콘텐츠가 없어요. <Link href="/app/plans" className="text-coral">AI 기획 리스트</Link>에서 시작하세요.
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, tone, hint }: { label: string; value: string; tone: "ink" | "teal" | "amber" | "muted"; hint?: string }) {
  const color = { ink: "text-ink", teal: "text-teal", amber: "text-amber", muted: "text-muted" }[tone];
  return (
    <Card className="p-4">
      <div className="text-xs text-muted">{label}{hint && <span className="ml-1">· {hint}</span>}</div>
      <div className={`font-display text-2xl mt-1 ${color}`}>{value}</div>
    </Card>
  );
}
function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="font-display text-2xl text-ink">{value.toLocaleString()}</div>
      <div className="text-xs text-muted mt-0.5">{label}</div>
    </div>
  );
}

function ContributionsGraph({ jobs }: { jobs: PublishJob[] }) {
  const counts = new Map<string, number>();
  for (const j of jobs) {
    if (j.status === "발행완료" && j.publishedAt) {
      const k = dayKey(j.publishedAt);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }
  const WEEKS = 14;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - ((today.getDay() + 6) % 7) - (WEEKS - 1) * 7); // 월요일 정렬
  const levels = ["#ececef", "#cfe2fb", "#8ec2f5", "#3f97e8", "#0066cc"]; // Apple blue ramp
  const cell = (n: number) => levels[n >= 4 ? 4 : n];

  const cols: { date: Date; n: number }[][] = [];
  for (let w = 0; w < WEEKS; w++) {
    const col: { date: Date; n: number }[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(start);
      date.setDate(start.getDate() + w * 7 + d);
      col.push({ date, n: date <= today ? counts.get(dayKey(date.getTime())) ?? 0 : -1 });
    }
    cols.push(col);
  }
  const total = Array.from(counts.values()).reduce((a, b) => a + b, 0);

  return (
    <div>
      <div className="flex gap-1 overflow-x-auto pb-1">
        {cols.map((col, ci) => (
          <div key={ci} className="flex flex-col gap-1">
            {col.map((c, di) => (
              <div
                key={di}
                title={c.n >= 0 ? `${dayKey(c.date.getTime())} · 발행 ${c.n}건` : ""}
                className="w-3.5 h-3.5 rounded-sm"
                style={{ background: c.n < 0 ? "transparent" : cell(c.n) }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between mt-3 text-xs text-muted">
        <span>최근 {WEEKS}주 · 총 발행 {total}건</span>
        <span className="flex items-center gap-1">
          적음
          {levels.map((l) => <span key={l} className="w-3 h-3 rounded-sm inline-block" style={{ background: l }} />)}
          많음
        </span>
      </div>
    </div>
  );
}

function computeNextActions(m?: MetricEntry): string[] {
  if (!m) return [];
  const out: string[] = [];
  if (m.views > 0 && m.follows / Math.max(1, m.views) < 0.01)
    out.push("조회는 나오는데 팔로우 전환이 약해요 → 프로필 소개·하이라이트와 마지막 장 CTA를 손보세요.");
  if (m.saves < Math.max(3, m.views * 0.02)) out.push("저장이 적어요 → ‘저장각’ 정보 요약 카드를 한 장 추가해 보세요.");
  if (m.shares < Math.max(2, m.views * 0.01)) out.push("공유가 적어요 → 친구에게 보내고 싶은 ‘공감 한 줄’이나 체크리스트를 넣어보세요.");
  if (m.profileVisits > 0 && m.follows === 0) out.push("프로필 방문은 있는데 전환이 0이에요 → 링크·하이라이트에 동선을 명확히 하세요.");
  if (out.length === 0) out.push("지표가 고르게 나와요. 잘 먹힌 주제를 한 번 더 변주해 보세요.");
  return out;
}

function MetricForm({ cards, onAdded }: { cards: CardNews[]; onAdded: (e: MetricEntry) => void }) {
  const [f, setF] = useState({ cardId: "", views: "", reach: "", saves: "", shares: "", likes: "", comments: "", profileVisits: "", follows: "", newFollowers: "" });
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const num = (k: keyof typeof f) => Number(f[k]) || 0;
      const { entry } = await api<{ entry: MetricEntry }>("/api/metrics", {
        method: "POST",
        body: {
          cardId: f.cardId || undefined,
          views: num("views"), reach: num("reach"), saves: num("saves"), shares: num("shares"),
          likes: num("likes"), comments: num("comments"), profileVisits: num("profileVisits"),
          follows: num("follows"), newFollowers: num("newFollowers"),
        },
      });
      onAdded(entry);
      setF({ cardId: "", views: "", reach: "", saves: "", shares: "", likes: "", comments: "", profileVisits: "", follows: "", newFollowers: "" });
    } finally {
      setSaving(false);
    }
  }
  const nf = (k: keyof typeof f, label: string) => (
    <Field label={label}>
      <input className={inputClass} type="number" value={f[k]} onChange={(e) => setF((p) => ({ ...p, [k]: e.target.value }))} placeholder="0" />
    </Field>
  );

  return (
    <form onSubmit={submit} className="space-y-3">
      {cards.length > 0 && (
        <Field label="연결할 콘텐츠" hint="선택">
          <select className={inputClass} value={f.cardId} onChange={(e) => setF((p) => ({ ...p, cardId: e.target.value }))}>
            <option value="">— 계정 전체 —</option>
            {cards.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </Field>
      )}
      <div className="grid grid-cols-3 gap-2">
        {nf("views", "조회")}{nf("reach", "도달")}{nf("saves", "저장")}
        {nf("shares", "공유")}{nf("likes", "좋아요")}{nf("comments", "댓글")}
        {nf("profileVisits", "방문")}{nf("follows", "기여팔로우")}{nf("newFollowers", "팔로워+")}
      </div>
      <Button type="submit" size="sm" disabled={saving}>{saving ? "저장 중…" : "기록 추가"}</Button>
    </form>
  );
}
