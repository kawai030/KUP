"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import { Badge, Button, Card } from "@/components/ui";
import { activeIgHandle, KANBAN_COLUMNS, type CardNews, type CardStatus, type MetricEntry, type PublicUser, type PublishJob, type Strategy } from "@/lib/types";

function weekStart(ts: number): number {
  const d = new Date(ts);
  const day = (d.getDay() + 6) % 7;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d.getTime();
}

const STAGE_TONE: Record<CardStatus, string> = {
  기획중: "#8b8579", 기획완료: "#d99413", 제작중: "#d99413", 제작완료: "#1f6f63", 예약업로드: "#d99413", 업로드완료: "#1f6f63",
};

export default function HomePage() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [cards, setCards] = useState<CardNews[]>([]);
  const [jobs, setJobs] = useState<PublishJob[]>([]);
  const [metrics, setMetrics] = useState<MetricEntry[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const [me, st, cd, sc, mt] = await Promise.all([
      api<{ user: PublicUser }>("/api/auth/me"),
      api<{ strategy: Strategy | null }>("/api/strategy"),
      api<{ cards: CardNews[] }>("/api/cards"),
      api<{ jobs: PublishJob[] }>("/api/schedule"),
      api<{ entries: MetricEntry[] }>("/api/metrics"),
    ]);
    setUser(me.user);
    setStrategy(st.strategy);
    setCards(cd.cards);
    setJobs(sc.jobs);
    setMetrics(mt.entries);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  const { thisWeekDone, streak } = useMemo(() => {
    const published = jobs.filter((j) => j.status === "발행완료" && j.publishedAt);
    const byWeek = new Map<number, number>();
    for (const j of published) {
      const w = weekStart(j.publishedAt!);
      byWeek.set(w, (byWeek.get(w) ?? 0) + 1);
    }
    const nowWeek = weekStart(Date.now());
    let streak = 0;
    let w = nowWeek;
    while ((byWeek.get(w) ?? 0) >= 1) {
      streak++;
      w -= 7 * 24 * 60 * 60 * 1000;
    }
    return { thisWeekDone: byWeek.get(nowWeek) ?? 0, streak };
  }, [jobs]);

  if (loading || !user) return <div className="py-20 text-center text-muted">불러오는 중…</div>;

  const handle = activeIgHandle(user);
  const target = strategy?.recommendedCount ?? Math.max(2, user.survey?.weeklyCapacity ?? 2);
  const followers = (user.survey?.followers ?? 0) + metrics.reduce((s, m) => s + m.newFollowers, 0);
  const nextTarget = Math.min(1000, Math.ceil((followers + 1) / 100) * 100);
  const roadmapPct = Math.min(100, (followers / 1000) * 100);
  const stageCount = (s: CardStatus) => cards.filter((c) => c.status === s).length;
  const reserved = jobs.filter((j) => j.status === "예약");
  const todo = cards.filter((c) => c.status === "제작완료").length; // 발행 대기

  return (
    <div className="space-y-6">
      {/* 인사 + 단계 */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="text-sm text-ink-soft">안녕하세요, {user.name}님 👋</div>
          <h1 className="font-display text-3xl mt-1">워크스페이스</h1>
        </div>
        {strategy && <Badge tone="coral">운영 단계 · {strategy.stage}</Badge>}
      </div>

      {/* 빠른 액션 */}
      <div className="grid sm:grid-cols-3 gap-3">
        <Link href="/app/plans"><Card className="p-4 hover:-translate-y-0.5 transition"><div className="text-2xl">✦</div><div className="font-medium mt-1">기획 추가</div><div className="text-xs text-muted">주제로 카드 만들기</div></Card></Link>
        <Link href="/app/board"><Card className="p-4 hover:-translate-y-0.5 transition"><div className="text-2xl">▦</div><div className="font-medium mt-1">콘텐츠 관리</div><div className="text-xs text-muted">칸반으로 진행 관리</div></Card></Link>
        <Link href="/app/insights"><Card className="p-4 hover:-translate-y-0.5 transition"><div className="text-2xl">◆</div><div className="font-medium mt-1">콘텐츠 성과</div><div className="text-xs text-muted">인사이트·챌린지</div></Card></Link>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* 이번 주 루틴 */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium">이번 주 루틴</div>
            <Badge tone={thisWeekDone >= target ? "teal" : "amber"}>{thisWeekDone} / {target} 발행</Badge>
          </div>
          <div className="flex gap-1.5">
            {Array.from({ length: Math.max(target, thisWeekDone) }).map((_, i) => (
              <div key={i} className={`h-2.5 flex-1 rounded-full ${i < thisWeekDone ? "bg-teal" : "bg-paper-2"}`} />
            ))}
          </div>
          <div className="flex items-center justify-between mt-3">
            <p className="text-sm text-ink-soft">{thisWeekDone >= target ? "이번 주 목표 달성! 🎉" : `${Math.max(0, target - thisWeekDone)}건 더 올리면 완성`}</p>
            <span className="text-sm text-coral font-medium">연속 {streak}주 🔥</span>
          </div>
          {strategy && <p className="text-xs text-muted mt-2 preserve-lines">{strategy.weeklyGoal}</p>}
        </Card>

        {/* 팔로워 챌린지 요약 */}
        <Card className="p-5">
          <div className="text-sm font-medium mb-1">팔로워 챌린지</div>
          <div className="font-display text-2xl">{followers.toLocaleString()}명 <span className="text-base text-muted">· 다음 {nextTarget}</span></div>
          <div className="relative h-2.5 bg-paper-2 rounded-full overflow-hidden mt-3">
            <div className="absolute inset-y-0 left-0 bg-coral rounded-full" style={{ width: `${roadmapPct}%` }} />
          </div>
          <Link href="/app/insights" className="text-xs text-coral mt-2 inline-block">성과·챌린지 자세히 →</Link>
        </Card>
      </div>

      {/* 연동 계정 + 발행 대기 */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="text-sm font-medium mb-2">연동 인스타 계정</div>
          {user.igAccounts.length === 0 ? (
            <div className="flex items-center justify-between">
              <p className="text-sm text-ink-soft">아직 연동된 계정이 없어요.</p>
              <Link href="/app/accounts"><Button size="sm">연동하기</Button></Link>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-ink text-paper grid place-items-center text-sm">{handle?.[0]?.toUpperCase()}</span>
                <div>
                  <div className="font-medium">@{handle}</div>
                  <div className="text-xs text-muted">{user.igAccounts.length}개 계정 · {user.igAccounts.find((a) => a.id === user.activeIgAccountId)?.mode === "정식" ? "정식 연동" : "테스터"}</div>
                </div>
              </div>
              <Link href="/app/accounts"><Button variant="outline" size="sm">관리</Button></Link>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium">바로 할 일</div>
          </div>
          <div className="space-y-1.5 text-sm">
            <Row label="발행 대기 (검수 통과)" value={todo} href="/app/board" tone="teal" />
            <Row label="예약된 발행" value={reserved.length} href="/app/board" tone="amber" />
            <Row label="기획 중" value={stageCount("기획중") + stageCount("기획완료")} href="/app/plans" tone="muted" />
          </div>
        </Card>
      </div>

      {/* 기획 현황 (미니 칸반) */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-medium">기획 현황</div>
          <Link href="/app/board" className="text-xs text-coral">콘텐츠 관리 →</Link>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {KANBAN_COLUMNS.map((col) => (
            <div key={col} className="rounded-xl bg-paper-2/50 p-3 text-center">
              <div className="font-display text-2xl" style={{ color: STAGE_TONE[col] }}>{stageCount(col)}</div>
              <div className="text-[11px] text-muted mt-1">{col}</div>
            </div>
          ))}
        </div>
      </Card>

      {cards.length === 0 && (
        <Card className="p-6 text-center">
          <p className="text-ink-soft">아직 만든 콘텐츠가 없어요. 첫 기획부터 시작해 볼까요?</p>
          <Link href="/app/plans" className="inline-block mt-3"><Button>AI 기획 리스트로 →</Button></Link>
        </Card>
      )}
    </div>
  );
}

function Row({ label, value, href, tone }: { label: string; value: number; href: string; tone: "teal" | "amber" | "muted" }) {
  const color = { teal: "text-teal", amber: "text-amber", muted: "text-muted" }[tone];
  return (
    <Link href={href} className="flex items-center justify-between py-1.5 px-2 -mx-2 rounded-lg hover:bg-paper-2/60">
      <span className="text-ink-soft">{label}</span>
      <span className={`font-medium ${color}`}>{value}</span>
    </Link>
  );
}
