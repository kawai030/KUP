"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, formatDate } from "@/lib/workspace/client";
import { Badge, Button, Card, EmptyState, SectionTitle } from "@/components/workspace/ui";
import { Icon } from "@/components/ui/icon";
import { KANBAN_COLUMNS, kanbanColumnOf, type CardNews, type CardStatus, type PublishJob } from "@/lib/workspace/types";

// TDS 상태 톤 — 진행=KUP 핑크, 완료=green, 예약=amber, 대기=grey
const COLUMN_TONE: Record<CardStatus, string> = {
  기획중: "#8b95a1",
  기획완료: "#e52364",
  제작중: "#e52364",
  제작완료: "#0aa06e",
  예약업로드: "#c47b00",
  업로드완료: "#0aa06e",
};

// 칸반 카드용 짧은 날짜 — 연도 생략(스캔 뷰라 M/D 로 충분)
function shortDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
function shortDateTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function BoardPage() {
  const router = useRouter();
  const [cards, setCards] = useState<CardNews[]>([]);
  const [jobs, setJobs] = useState<PublishJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"칸반" | "리스트">("칸반");
  const [menuOpen, setMenuOpen] = useState<string | null>(null); // 케밥 메뉴 열린 카드 id

  async function load() {
    const [cd, sc] = await Promise.all([
      api<{ cards: CardNews[] }>("/api/cards"),
      api<{ jobs: PublishJob[] }>("/api/schedule"),
    ]);
    setCards(cd.cards);
    setJobs(sc.jobs);
    setLoading(false);
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 25000); // 예약 도래 반영
    return () => clearInterval(t);
  }, []);

  async function handleDelete(card: CardNews) {
    setMenuOpen(null);
    if (!window.confirm(`'${card.title}' 콘텐츠를 삭제할까요?\n관련 예약·발행 기록도 함께 삭제되며 되돌릴 수 없어요.`)) return;
    await api(`/api/cards/${card.id}`, { method: "DELETE" });
    await load();
  }

  if (loading) return <div className="py-20 text-center text-muted">불러오는 중…</div>;

  // 게이트 상태(기획완료/제작완료)는 각 '중' 열에 접어서 집계·표시
  const byColumn = (col: CardStatus) => cards.filter((c) => kanbanColumnOf(c.status) === col);

  // 카드별 예약 시각 / 발행 시각 (가장 최근값) — 발행 job 에서 매핑
  const scheduledByCard = new Map<string, number>();
  const publishedByCard = new Map<string, number>();
  for (const j of jobs) {
    if (j.status === "예약") scheduledByCard.set(j.cardId, Math.max(scheduledByCard.get(j.cardId) ?? 0, j.scheduledAt));
    if (j.status === "발행완료" && j.publishedAt) publishedByCard.set(j.cardId, Math.max(publishedByCard.get(j.cardId) ?? 0, j.publishedAt));
  }
  // 열별 하단 날짜 텍스트 — 기획/제작=수정일 M/D, 예약=예약시각 M/D HH:mm, 완료=발행일 M/D 발행
  function footDate(card: CardNews, col: CardStatus): string {
    if (col === "예약업로드") {
      const at = scheduledByCard.get(card.id);
      return at ? shortDateTime(at) : shortDate(card.updatedAt);
    }
    if (col === "업로드완료") {
      const at = publishedByCard.get(card.id) ?? card.updatedAt;
      return `${shortDate(at)} 발행`;
    }
    return shortDate(card.updatedAt);
  }

  return (
    <div className="space-y-5">
      <SectionTitle
        eyebrow="워크스페이스"
        title="콘텐츠 관리"
        desc="기획부터 업로드까지, 한눈에 흐름을 관리해요."
        action={
          <div className="flex gap-1 bg-paper-2/60 p-1 rounded-xl">
            {(["칸반", "리스트"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} className={`px-3 py-1 rounded-lg text-sm ${view === v ? "bg-card shadow-sm text-ink" : "text-ink-soft"}`}>
                {v}
              </button>
            ))}
          </div>
        }
      />

      {cards.length === 0 ? (
        <Card>
          <EmptyState
            title="콘텐츠가 없어요"
            desc="AI 콘텐츠 생성에서 첫 기획을 추가해 보세요."
            action={
              <Link href="/app/plans">
                <Button>
                  AI 콘텐츠 생성으로
                  <Icon name="arrowRight" size={16} />
                </Button>
              </Link>
            }
          />
        </Card>
      ) : view === "칸반" ? (
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-3" style={{ height: 640 }}>
            {KANBAN_COLUMNS.map((col) => {
              const items = byColumn(col);
              return (
                <div key={col} className="flex-1 min-w-[220px] flex flex-col bg-paper-2/40 rounded-2xl border border-line">
                  <div className="px-3.5 py-3 flex items-center justify-between sticky top-0">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLUMN_TONE[col] }} />
                      <span className="text-sm font-medium">{col}</span>
                    </div>
                    <span className="text-xs text-muted">{items.length}</span>
                  </div>
                  <div className="px-2.5 pb-2.5 space-y-2 overflow-y-auto flex-1">
                    {items.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => router.push(`/app/create/${c.id}`)}
                        className={`relative rounded-xl bg-card border border-line p-3 hover:-translate-y-0.5 transition cursor-pointer ${menuOpen === c.id ? "z-30" : ""}`}
                      >
                        {/* 케밥(⋮) 메뉴 */}
                        <div className="absolute top-2 right-2">
                          <KebabMenu
                            open={menuOpen === c.id}
                            onToggle={(e) => {
                              e.stopPropagation();
                              setMenuOpen((cur) => (cur === c.id ? null : c.id));
                            }}
                            onClose={() => setMenuOpen(null)}
                            onEdit={(e) => {
                              e.stopPropagation();
                              router.push(`/app/create/${c.id}`);
                            }}
                            onDelete={(e) => {
                              e.stopPropagation();
                              handleDelete(c);
                            }}
                          />
                        </div>

                        {/* 배지(윗줄) + 제목(아랫줄, 전체 폭) — 제목은 2줄 말줄임 + 호버 툴팁 */}
                        <div className="pr-6">
                          <Badge tone={c.format === "릴스" ? "rose" : "muted"}>{c.format === "릴스" ? "릴스" : "게시물"}</Badge>
                        </div>
                        <p title={c.title} className="text-sm font-medium text-ink line-clamp-2 leading-snug mt-1.5">{c.title}</p>

                        {/* 하단: 날짜(좌) ↔ 장수(우) */}
                        <div className="flex items-center justify-between mt-3 text-[11px] text-muted">
                          <span>{footDate(c, col)}</span>
                          <span>{c.pageCount}{c.format === "릴스" ? "컷" : "장"}</span>
                        </div>
                      </div>
                    ))}
                    {items.length === 0 && <div className="text-xs text-muted text-center py-6">비어 있음</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted border-b border-line bg-paper-2/40">
                  <th className="py-3 px-4 font-medium">타이틀</th>
                  <th className="py-3 px-3 font-medium">상태</th>
                  <th className="py-3 px-3 font-medium">형식</th>
                  <th className="py-3 px-3 font-medium">장 수</th>
                  <th className="py-3 px-3 font-medium">수정일</th>
                </tr>
              </thead>
              <tbody>
                {cards.map((c) => (
                  <tr key={c.id} className="border-b border-line/60 hover:bg-paper-2/30 cursor-pointer" onClick={() => router.push(`/app/create/${c.id}`)}>
                    <td className="py-3 px-4 font-medium text-ink">{c.title}</td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ background: COLUMN_TONE[c.status] }} />
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-ink-soft">{c.format === "릴스" ? "릴스" : "게시물"}</td>
                    <td className="py-3 px-3 text-ink-soft">{c.pageCount}장</td>
                    <td className="py-3 px-3 text-muted">{formatDate(c.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// 카드 우상단 케밥(⋮) — 편집 열기 / 삭제
function KebabMenu({
  open,
  onToggle,
  onClose,
  onEdit,
  onDelete,
}: {
  open: boolean;
  onToggle: (e: React.MouseEvent) => void;
  onClose: () => void;
  onEdit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, onClose]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={onToggle}
        aria-label="카드 관리 메뉴"
        className="w-6 h-6 grid place-items-center rounded-md text-muted hover:bg-paper-2 hover:text-ink transition leading-none"
      >
        ⋮
      </button>
      {open && (
        <div className="absolute right-0 top-7 z-20 w-32 rounded-xl border border-line bg-card shadow-lg py-1 text-sm">
          <button onClick={onEdit} className="w-full text-left px-3 py-2 hover:bg-paper-2 text-ink">
            편집 열기
          </button>
          <button onClick={onDelete} className="w-full text-left px-3 py-2 hover:bg-rose-soft text-rose">
            삭제
          </button>
        </div>
      )}
    </div>
  );
}
