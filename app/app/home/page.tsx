"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { api, formatDay } from "@/lib/workspace/client";
import { Badge, Button, Card } from "@/components/workspace/ui";
import { SurveyModal } from "@/components/workspace/SurveyModal";
import { findIgAccount, DM_LIMITS, type CardNews, type CardStatus, type DmRule, type MetricEntry, type PublicUser, type PublishJob, type SurveyProfile } from "@/lib/workspace/types";
import { resolveFollowerCount } from "@/lib/workspace/followers";

function weekStart(ts: number): number {
  const d = new Date(ts);
  const day = (d.getDay() + 6) % 7;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d.getTime();
}
function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// 카드 상태 → 최근 콘텐츠 리스트의 상태 필(pill) 라벨·톤
type BadgeTone = "ink" | "coral" | "teal" | "amber" | "muted" | "rose";
function statusPill(status: CardStatus): { label: string; tone: BadgeTone } {
  switch (status) {
    case "기획중":
    case "기획완료":
      return { label: "기획", tone: "muted" };
    case "제작중":
      return { label: "제작 중", tone: "amber" };
    case "제작완료":
      return { label: "검수", tone: "amber" };
    case "예약업로드":
      return { label: "예약", tone: "coral" };
    case "업로드완료":
      return { label: "완료", tone: "teal" };
  }
}
function statusSub(status: CardStatus): string {
  switch (status) {
    case "기획중":
      return "AI 초안 · 기획 중";
    case "기획완료":
      return "기획 완료 · 제작 대기";
    case "제작중":
      return "제작 중";
    case "제작완료":
      return "검수 대기";
    case "예약업로드":
      return "예약 발행";
    case "업로드완료":
      return "발행 완료";
  }
}

export default function HomePage() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [cards, setCards] = useState<CardNews[]>([]);
  const [jobs, setJobs] = useState<PublishJob[]>([]);
  const [metrics, setMetrics] = useState<MetricEntry[]>([]);
  const [dmRules, setDmRules] = useState<DmRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSurvey, setShowSurvey] = useState(false);

  async function load() {
    const [me, cd, sc, mt, dm] = await Promise.all([
      api<{ user: PublicUser }>("/api/auth/me"),
      api<{ cards: CardNews[] }>("/api/cards"),
      api<{ jobs: PublishJob[] }>("/api/schedule"),
      api<{ entries: MetricEntry[] }>("/api/metrics"),
      api<{ rules: DmRule[] }>("/api/dm/rules"),
    ]);
    setUser(me.user);
    setCards(cd.cards);
    setJobs(sc.jobs);
    setMetrics(mt.entries);
    setDmRules(dm.rules);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  // 이번 주 / 지난주 발행 건수 — 발행완료 job 의 publishedAt 기준(업로드 그래프·인사이트와 동일 소스)
  const { thisWeekDone, lastWeekDone } = useMemo(() => {
    const byWeek = new Map<number, number>();
    for (const j of jobs) {
      if (j.status === "발행완료" && j.publishedAt) {
        const w = weekStart(j.publishedAt);
        byWeek.set(w, (byWeek.get(w) ?? 0) + 1);
      }
    }
    const nowWeek = weekStart(Date.now());
    const WEEK = 7 * 24 * 60 * 60 * 1000;
    return { thisWeekDone: byWeek.get(nowWeek) ?? 0, lastWeekDone: byWeek.get(nowWeek - WEEK) ?? 0 };
  }, [jobs]);

  if (loading || !user) return <div className="py-20 text-center text-muted">불러오는 중…</div>;

  const account = findIgAccount(user);
  const followers = resolveFollowerCount(user, metrics);
  const weeklyGrowth = account?.weeklyGrowth ?? 0;
  const publishDelta = thisWeekDone - lastWeekDone;

  // 예약 대기 — 아직 발행 안 된 예약 job. 가장 가까운 예약 시각을 부제로.
  const reservedJobs = jobs.filter((j) => j.status === "예약");
  const nextReservedAt = reservedJobs.map((j) => j.scheduledAt).sort((a, b) => a - b)[0];

  // DM 발송 — 규칙별 누적 발송 합 / 플랜 한도
  const dmSent = dmRules.reduce((s, r) => s + r.sentCount, 0);
  const dmLimit = DM_LIMITS[user.plan];

  // 이번 주 콘텐츠 흐름 — 파이프라인 단계별 스냅샷
  const count = (fn: (c: CardNews) => boolean) => cards.filter(fn).length;
  const flow = [
    { label: "기획", n: count((c) => c.status === "기획중" || c.status === "기획완료") },
    { label: "제작", n: count((c) => c.status === "제작중") },
    { label: "검수", n: count((c) => c.status === "제작완료") },
    { label: "발행", n: thisWeekDone, on: true },
  ];

  const recentCards = [...cards].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 4);

  const quickActions = [
    { icon: "≣", label: "AI로 콘텐츠 기획하기", href: "/app/plans" },
    { icon: "✦", label: "카드뉴스 제작하기", href: "/app/create" },
    { icon: "↗", label: "이번 주 성과 보기", href: "/app/insights" },
  ];

  return (
    <div className="space-y-6">
      {/* 헤더 — 우측: 계정 컨셉 요약(케밥 수정) / 미설정 시 설정 유도 */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl">안녕하세요, {user.name}님 👋</h1>
          <p className="text-sm text-ink-soft mt-1">이번 주 콘텐츠 현황이에요.</p>
        </div>
        {user.survey ? (
          <ConceptCard survey={user.survey} onEdit={() => setShowSurvey(true)} />
        ) : (
          <div className="flex items-center gap-3 self-end">
            <span className="text-sm text-muted">계정 컨셉을 아직 안 정했어요</span>
            <Button onClick={() => setShowSurvey(true)}>컨셉 설정</Button>
          </div>
        )}
      </div>

      {showSurvey && (
        <SurveyModal
          initial={user.survey ?? null}
          onClose={() => setShowSurvey(false)}
          onSaved={() => load()}
        />
      )}

      {/* 통계 4칸 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard k="총 팔로워" v={followers.toLocaleString()} d={weeklyGrowth > 0 ? `주간 +${weeklyGrowth}` : "주간 변화 없음"} dTone={weeklyGrowth > 0 ? "teal" : "muted"} />
        <StatCard k="이번 주 발행" v={String(thisWeekDone)} d={publishDelta === 0 ? "지난주와 같음" : `지난주 대비 ${publishDelta > 0 ? "+" : ""}${publishDelta}`} dTone={publishDelta > 0 ? "teal" : "muted"} />
        <StatCard k="예약 대기" v={String(reservedJobs.length)} d={nextReservedAt ? `${formatDay(nextReservedAt)} 발행 예정` : "예약 없음"} dTone="muted" />
        <StatCard k="DM 발송" v={<>{dmSent}<span className="text-sm text-muted">/{dmLimit === Infinity ? "∞" : dmLimit}</span></>} d={`${user.plan} 한도`} dTone="muted" />
      </div>

      {/* 2단 — 좌: 빠른 시작(+이번 주 업로드) / 우: 이번 주 콘텐츠 흐름(+최근 콘텐츠) */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* 빠른 시작 */}
        <Card className="p-5">
          <div className="text-sm font-medium mb-3">빠른 시작</div>
          <div className="space-y-2">
            {quickActions.map((a) => (
              <Link key={a.href} href={a.href} className="flex items-center gap-3 rounded-xl border border-line bg-card px-4 py-3 hover:bg-paper-2 transition">
                <span className="w-7 h-7 grid place-items-center rounded-lg bg-coral-soft text-coral text-sm">{a.icon}</span>
                <span className="text-sm font-medium">{a.label}</span>
              </Link>
            ))}
          </div>

          {/* 이번 주 업로드 — 기존 '이번 주 현황' 자리 대체 */}
          <div className="flex items-center justify-between mt-6 mb-1">
            <div className="text-sm font-medium">이번 주 업로드</div>
            <Link href="/app/insights" className="text-xs text-coral">전체 릴레이 →</Link>
          </div>
          <p className="text-xs text-muted mb-4">요일별 발행 건수를 색 농도로 — 꾸준히 올리고 있는지 한눈에.</p>
          <WeeklyUploadGraph jobs={jobs} />
        </Card>

        {/* 이번 주 콘텐츠 흐름 */}
        <Card className="p-5">
          <div className="text-sm font-medium mb-3">이번 주 콘텐츠 흐름</div>
          <div className="flex items-center gap-1.5">
            {flow.map((s, i) => (
              <div key={s.label} className="contents">
                <div className={`flex-1 flex flex-col items-center gap-0.5 rounded-xl py-2.5 ${s.on ? "bg-coral-soft" : "bg-paper-2"}`}>
                  <span className={`font-display text-lg ${s.on ? "text-coral" : "text-ink"}`}>{s.n}</span>
                  <span className={`text-xs ${s.on ? "text-coral" : "text-ink-soft"}`}>{s.label}</span>
                </div>
                {i < flow.length - 1 && <span className="text-muted text-sm">→</span>}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between mt-5 mb-2">
            <div className="text-sm font-medium">최근 콘텐츠</div>
            <Link href="/app/board" className="text-xs text-coral">전체 보기 →</Link>
          </div>
          {recentCards.length === 0 ? (
            <p className="text-sm text-ink-soft py-4">아직 만든 콘텐츠가 없어요.</p>
          ) : (
            <div className="space-y-1.5">
              {recentCards.map((c) => {
                const pill = statusPill(c.status);
                return (
                  <Link key={c.id} href="/app/board" className="flex items-center gap-3 rounded-xl px-2 py-2 -mx-2 hover:bg-paper-2/60 transition">
                    <span className="w-10 h-10 rounded-lg bg-paper-2 shrink-0" style={{ background: c.brandColor || undefined }} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{c.title}</div>
                      <div className="text-xs text-muted truncate">{statusSub(c.status)}</div>
                    </div>
                    <Badge tone={pill.tone}>{pill.label}</Badge>
                  </Link>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {cards.length === 0 && (
        <Card className="p-6 text-center">
          <p className="text-ink-soft">아직 만든 콘텐츠가 없어요. 첫 기획부터 시작해 볼까요?</p>
          <Link href="/app/plans" className="inline-block mt-3 text-coral font-medium">AI 콘텐츠 생성으로 →</Link>
        </Card>
      )}
    </div>
  );
}

// 헤더 우측 · 계정 컨셉 요약(박스) + ⋮ 케밥 메뉴(수정 → 설문 모달). 앱 board·plans 케밥과 동일 톤.
function ConceptCard({ survey, onEdit }: { survey: SurveyProfile; onEdit: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  return (
    <div className="relative flex items-start gap-6 rounded-xl border border-line py-3 pl-4 pr-11">
      <ConceptItem label="주제" value={survey.niche || "—"} />
      <ConceptItem label="운영 목적" value={survey.goals.join(", ") || "—"} />
      <ConceptItem label="브랜드 키워드" value={survey.brandKeywords.join(", ") || "—"} />
      <div className="absolute top-2 right-2" ref={ref}>
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label="계정 컨셉 메뉴"
          className="w-6 h-6 grid place-items-center rounded-md text-muted hover:bg-paper-2 hover:text-ink transition leading-none"
        >
          ⋮
        </button>
        {open && (
          <div className="absolute right-0 top-7 z-20 w-24 rounded-xl border border-line bg-card shadow-lg py-1 text-sm">
            <button
              onClick={() => { setOpen(false); onEdit(); }}
              className="w-full text-left px-3 py-2 hover:bg-paper-2 text-ink"
            >
              수정
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// 컨셉 요약 한 칸(마이페이지 Row 스타일 — 작은 회색 라벨 위 · 값 아래)
function ConceptItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-sm font-medium text-ink truncate max-w-[150px]" title={value}>{value}</div>
    </div>
  );
}

// 통계 카드 한 칸
function StatCard({ k, v, d, dTone }: { k: string; v: React.ReactNode; d: string; dTone: BadgeTone }) {
  const tone = { ink: "text-ink", coral: "text-coral", teal: "text-teal", amber: "text-amber", muted: "text-muted", rose: "text-rose" }[dTone];
  return (
    <Card className="p-4">
      <div className="text-xs text-muted">{k}</div>
      <div className="font-display text-2xl mt-1">{v}</div>
      <div className={`text-xs mt-1 ${tone}`}>{d}</div>
    </Card>
  );
}

// 이번 주(월~일) 요일별 발행 건수를 색 농도로 — 인사이트 '업로드 릴레이'와 같은 시각 언어.
// 데이터 소스: 발행완료 job 의 publishedAt (이번 주 발행 통계와 동일 → 숫자 정합).
function WeeklyUploadGraph({ jobs }: { jobs: PublishJob[] }) {
  const counts = new Map<string, number>();
  for (const j of jobs) {
    if (j.status === "발행완료" && j.publishedAt) {
      const k = dayKey(j.publishedAt);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }
  // TDS Toss Blue 시퀀셜 스케일 (연하늘 → Toss Blue)
  const levels = ["#f2f4f6", "#c9e2ff", "#90c2ff", "#4593fc", "#3182f6"];
  const cell = (n: number) => levels[n >= 4 ? 4 : n];
  const labels = ["월", "화", "수", "목", "금", "토", "일"];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = weekStart(Date.now()); // 이번 주 월요일 00:00
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const t = d.getTime();
    const future = t > today.getTime();
    return { label: labels[i], n: future ? -1 : counts.get(dayKey(t)) ?? 0, isToday: t === today.getTime() };
  });

  return (
    <div>
      <div className="flex gap-2">
        {days.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
            <div
              title={d.n >= 0 ? `${d.label} · 발행 ${d.n}건` : `${d.label} · 예정`}
              className={`w-full aspect-square rounded-md border border-black/5 ${d.isToday ? "ring-2 ring-ink ring-offset-1" : ""}`}
              style={{ background: d.n < 0 ? "transparent" : cell(d.n) }}
            />
            <span className={`text-[11px] ${d.isToday ? "text-ink font-medium" : "text-muted"}`}>{d.label}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-end mt-3 text-xs text-muted">
        <span className="flex items-center gap-1">
          적음
          {levels.map((l) => <span key={l} className="w-3 h-3 rounded-sm inline-block border border-black/5" style={{ background: l }} />)}
          많음
        </span>
      </div>
    </div>
  );
}
