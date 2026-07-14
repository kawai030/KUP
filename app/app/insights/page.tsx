"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/workspace/client";
import { Badge, Button, Card, SectionTitle } from "@/components/workspace/ui";
import { type CardNews, type DmRule, type MetricEntry, type PublicUser, type PublishJob } from "@/lib/workspace/types";
import { followerChallenge, resolveFollowerCount } from "@/lib/workspace/followers";

function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function InsightsPage() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [metrics, setMetrics] = useState<MetricEntry[]>([]);
  const [jobs, setJobs] = useState<PublishJob[]>([]);
  const [cards, setCards] = useState<CardNews[]>([]);
  const [dm, setDm] = useState<DmRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

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

  // 인스타에서 인사이트 자동수집(정식 연동 계정 한정)
  async function sync() {
    setSyncMsg(null);
    setSyncing(true);
    try {
      const r = await api<{ synced: number; followers: number }>("/api/metrics/sync", { method: "POST" });
      await load(); // 갱신된 지표 + 계정 팔로워 반영
      setSyncMsg({ tone: "ok", text: `인스타에서 ${r.synced}개 게시물 지표를 가져왔어요 (팔로워 ${r.followers.toLocaleString()}명).` });
    } catch (e) {
      setSyncMsg({ tone: "err", text: (e as Error).message });
    } finally {
      setSyncing(false);
    }
  }

  const activeAccount = user ? user.igAccounts.find((a) => a.id === user.activeIgAccountId) ?? user.igAccounts[0] : undefined;

  // 게시물별 최신 스냅샷(누적) — 인스타 지표는 누적치라 일자별로 더하지 않고 가장 최근 값만 사용.
  // 묶는 키: cardId(우리 발행-카드 매핑) → mediaId → id. 제목은 연결된 카드에서, 없으면 폴백.
  const postRows = useMemo(() => {
    const latest = new Map<string, MetricEntry>();
    for (const m of metrics) {
      const key = m.cardId ?? m.mediaId ?? m.id;
      const prev = latest.get(key);
      if (!prev || m.date > prev.date || (m.date === prev.date && m.createdAt > prev.createdAt)) latest.set(key, m);
    }
    return Array.from(latest.entries())
      .map(([key, m]) => ({
        key,
        title: m.cardId ? cards.find((c) => c.id === m.cardId)?.title ?? "게시물" : "인스타 게시물",
        m,
      }))
      .sort((a, b) => b.m.views - a.m.views);
  }, [metrics, cards]);

  // 계정 단위 기여 팔로우 합 — 게시물별 최신 스냅샷 기준(중복합산 방지)
  const followsTotal = postRows.reduce((s, r) => s + r.m.follows, 0);
  const dmSent = dm.reduce((s, r) => s + r.sentCount, 0);
  const latest = metrics[0];
  const nextActions = computeNextActions(latest);

  if (loading || !user) return <div className="py-20 text-center text-muted">불러오는 중…</div>;

  const followers = resolveFollowerCount(user, metrics);
  const { nextTarget } = followerChallenge(followers);

  return (
    <div className="space-y-7">
      <SectionTitle
        eyebrow="워크스페이스"
        title="콘텐츠 성과"
        action={
          activeAccount?.mode === "정식" ? (
            <Button size="sm" onClick={sync} disabled={syncing}>
              {syncing ? "가져오는 중…" : "↧ 인스타에서 가져오기"}
            </Button>
          ) : undefined
        }
      />

      {syncMsg && (
        <Card className={`p-3 text-sm ${syncMsg.tone === "ok" ? "bg-teal-soft/40 border-teal-soft text-ink" : "bg-coral/10 border-coral/30 text-coral"}`}>
          {syncMsg.text}
        </Card>
      )}

      {activeAccount && activeAccount.mode !== "정식" && (
        <Card className="p-3 text-sm bg-paper-2/50 text-ink-soft">
          현재 계정은 <b>테스터(시뮬)</b>라 자동 수집이 안 돼요. 정식 연동 계정이면 ‘인스타에서 가져오기’로 실제 지표를 불러옵니다. 그 전엔 아래에서 직접 입력하세요.
        </Card>
      )}

      {/* 계정 단위 인사이트 */}
      <div className="grid sm:grid-cols-4 gap-3">
        <Stat label="총 팔로워" value={followers.toLocaleString()} tone="ink" />
        {followers >= 100 ? (
          <Stat label="유입 / 이탈" value={`+${followsTotal} / -${Math.max(0, Math.round(followsTotal * 0.2))}`} tone="teal" />
        ) : (
          <Stat label="유입 / 이탈" value="🔒" tone="muted" tip={<>Meta 정책상 팔로워 <b className="font-semibold text-ink">100명</b> 이상부터 유입·이탈 데이터를 볼 수 있어요.</>} />
        )}
        <Stat label="DM 리드마그넷" value={`${dmSent}건`} tone="amber" />
        <Stat label="발행 콘텐츠" value={`${cards.filter((c) => c.status === "업로드완료").length}건`} tone="ink" />
      </div>

      {/* 게시물 단위 인사이트 — 게시물별 누적(최신 스냅샷) 표 */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium">게시물 지표</span>
          <InfoTip text="각 게시물의 발행 이후 누적 지표예요. 여러 번 수집돼도 가장 최근 스냅샷(누적값)을 기준으로 보여줍니다." />
        </div>
        {postRows.length === 0 ? (
          <div className="rounded-xl border border-line bg-paper-2/30 px-4 py-8 text-center text-sm text-ink-soft">
            아직 수집된 게시물 지표가 없어요.{activeAccount?.mode === "정식" ? " 상단 ‘인스타에서 가져오기’로 지표를 불러오세요." : ""}
          </div>
        ) : (
          <div className="rounded-xl border border-line overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm whitespace-nowrap">
                <thead>
                  <tr className="text-muted bg-paper-2/50 border-b border-line">
                    <th className="py-3 px-4 font-medium text-left">게시물</th>
                    {["조회", "도달", "저장", "공유", "좋아요", "댓글", "프로필 방문", "기여 팔로우"].map((h) => (
                      <th key={h} className="py-3 px-3 font-medium text-right">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {postRows.map((r) => (
                    <tr key={r.key} className="border-b border-line/60 last:border-0">
                      <td className="py-3 px-4 font-medium text-ink max-w-[220px] truncate" title={r.title}>{r.title}</td>
                      <td className="py-3 px-3 text-right text-ink-soft">{r.m.views.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right text-ink-soft">{r.m.reach.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right text-ink-soft">{r.m.saves.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right text-ink-soft">{r.m.shares.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right text-ink-soft">{r.m.likes.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right text-ink-soft">{r.m.comments.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right text-ink-soft">{r.m.profileVisits.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right text-teal">{r.m.follows > 0 ? `+${r.m.follows}` : r.m.follows}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>

      {/* 팔로워 달성 챌린지 */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-xs font-semibold tracking-wide text-coral uppercase">팔로워 달성 챌린지</div>
            <div className="font-display text-2xl mt-1">{followers.toLocaleString()}명 · 다음 목표 {nextTarget}명</div>
          </div>
          <Badge tone="muted">100단위 로드맵</Badge>
        </div>

        {/* 100단위 세그먼트 바 — 달성=코랄 / 현재 칸=강조 / 이후=회색 */}
        <div className="flex gap-1">
          {Array.from({ length: 10 }, (_, i) => {
            const lo = i * 100;
            const hi = (i + 1) * 100;
            const fill = followers >= hi ? 100 : followers <= lo ? 0 : ((followers - lo) / 100) * 100;
            const current = followers >= lo && followers < hi;
            return (
              <div key={i} className={`relative flex-1 h-3 rounded-full overflow-hidden ${current ? "bg-card ring-1 ring-inset ring-coral/60" : "bg-paper-2"}`}>
                <div className="absolute inset-y-0 left-0 bg-coral rounded-full transition-all" style={{ width: `${fill}%` }} />
              </div>
            );
          })}
        </div>
        <div className="flex gap-1 mt-1.5">
          {Array.from({ length: 10 }, (_, i) => {
            const hi = (i + 1) * 100;
            const done = followers >= hi;
            const current = followers >= i * 100 && followers < hi;
            return (
              <div key={i} className={`flex-1 text-center text-[10px] ${current ? "text-coral font-semibold" : done ? "text-ink-soft" : "text-muted"}`}>{hi}</div>
            );
          })}
        </div>

        <p className="text-sm text-ink-soft mt-4">
          {followers >= 1000 ? (
            "1,000명 달성! 다음 여정도 함께해요 🎉"
          ) : (
            <>다음 목표 <span className="font-semibold text-ink">{nextTarget}명</span>까지 <span className="font-semibold text-coral">{(nextTarget - followers).toLocaleString()}명</span> 남았어요 🎯</>
          )}
        </p>
      </Card>

      {/* 업로드 릴레이 — Contributions Graph */}
      <Card className="p-6">
        <div className="text-sm font-medium mb-1">업로드 릴레이</div>
        <p className="text-xs text-muted mb-4">매일의 발행 확정 건수를 칸으로 쌓아 꾸준함을 시각화해요. (1칸 = 하루)</p>
        <ContributionsGraph jobs={jobs} />
      </Card>

      {/* 다음 액션 */}
      <Card className="p-6">
        <SectionTitle title="다음에 바꿀 점" desc="수집된 성과를 바탕으로." />
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
          <p className="text-sm text-ink-soft">아직 수집된 성과가 없어요. 상단 ‘인스타에서 가져오기’로 지표를 불러오면 ‘다음에 바꿀 점’을 추천해 드려요.</p>
        )}
      </Card>

      {cards.length === 0 && (
        <Card className="p-5 text-center text-sm text-ink-soft">
          아직 만든 콘텐츠가 없어요. <Link href="/app/plans" className="text-coral">AI 콘텐츠 생성</Link>에서 시작하세요.
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, tone, tip }: { label: string; value: string; tone: "ink" | "teal" | "amber" | "muted"; tip?: React.ReactNode }) {
  const color = { ink: "text-ink", teal: "text-teal", amber: "text-amber", muted: "text-muted" }[tone];
  return (
    <Card className="p-4">
      <div className="text-xs text-muted flex items-center gap-1">{label}{tip && <InfoTip text={tip} />}</div>
      <div className={`font-display text-2xl mt-1 ${color}`}>{value}</div>
    </Card>
  );
}

// ⓘ 호버 툴팁 — 흰색 박스(깔끔한 부가 설명용). 아이콘 오른쪽 기준으로 왼쪽으로 펼쳐짐.
function InfoTip({ text }: { text: React.ReactNode }) {
  return (
    <span className="group relative inline-flex align-middle">
      <span className="cursor-help w-4 h-4 inline-flex items-center justify-center rounded-full border border-line text-[10px] text-muted leading-none">i</span>
      <span className="pointer-events-none absolute right-0 bottom-full mb-2 hidden group-hover:block w-max max-w-[240px] whitespace-normal text-left rounded-xl border border-line bg-card text-ink-soft text-xs font-normal leading-relaxed px-3 py-2 shadow-lg z-30">
        {text}
      </span>
    </span>
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
  const WEEKS = 53; // 약 1년 — 카드 폭을 채우는 밀도
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - ((today.getDay() + 6) % 7) - (WEEKS - 1) * 7); // 월요일 정렬
  // TDS Toss Blue 시퀀셜 스케일 (연하늘 → Toss Blue)
  const levels = ["#f2f4f6", "#c9e2ff", "#90c2ff", "#4593fc", "#3182f6"];
  const cellColor = (n: number) => levels[n >= 4 ? 4 : n];

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
  // 월이 바뀌는 주에만 월 라벨 표시(GitHub 방식)
  const monthLabel = (col: { date: Date; n: number }[], ci: number) => {
    const d0 = col[0]?.date;
    const prev = cols[ci - 1]?.[0]?.date;
    if (!d0 || ci === 0 || !prev) return "";
    return d0.getMonth() !== prev.getMonth() ? `${d0.getMonth() + 1}월` : "";
  };
  const weekdays = ["월", "", "수", "", "금", "", ""]; // 홀수 행만 표기(GitHub Mon/Wed/Fri)

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[720px]">
        {/* 월 라벨 */}
        <div className="flex gap-[3px] mb-1.5 text-[10px] text-muted">
          <div className="w-6 shrink-0" />
          {cols.map((col, ci) => (
            <div key={ci} className="flex-1 min-w-0 whitespace-nowrap">{monthLabel(col, ci)}</div>
          ))}
        </div>
        {/* 요일 라벨 + 그리드 */}
        <div className="flex gap-[3px]">
          <div className="w-6 shrink-0 flex flex-col gap-[3px] text-[10px] text-muted">
            {weekdays.map((d, i) => (
              <div key={i} className="flex-1 flex items-center leading-none">{d}</div>
            ))}
          </div>
          {cols.map((col, ci) => (
            <div key={ci} className="flex-1 flex flex-col gap-[3px]">
              {col.map((c, di) => (
                <div
                  key={di}
                  title={c.n >= 0 ? `${dayKey(c.date.getTime())} · 발행 ${c.n}건` : ""}
                  className="w-full aspect-square rounded-[3px] ring-1 ring-inset ring-black/[0.04]"
                  style={{ background: c.n < 0 ? "transparent" : cellColor(c.n) }}
                />
              ))}
            </div>
          ))}
        </div>
        {/* 캡션 + 범례 */}
        <div className="flex items-center justify-between mt-3 text-xs text-muted">
          <span>지난 1년 · 총 발행 {total}건</span>
          <span className="flex items-center gap-1">
            적음
            {levels.map((l) => <span key={l} className="w-3 h-3 rounded-sm inline-block ring-1 ring-inset ring-black/[0.04]" style={{ background: l }} />)}
            많음
          </span>
        </div>
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
