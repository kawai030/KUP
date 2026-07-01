"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, formatDate } from "@/lib/client";
import { Badge, Button, Card, EmptyState, SectionTitle } from "@/components/ui";
import { getTheme } from "@/components/CardCanvas";
import { KANBAN_COLUMNS, type CardNews, type CardStatus } from "@/lib/types";

const COLUMN_TONE: Record<CardStatus, string> = {
  기획중: "#86868b",
  기획완료: "#0066cc",
  제작중: "#0066cc",
  제작완료: "#1f6f63",
  예약업로드: "#b06b00",
  업로드완료: "#1f6f63",
};

export default function BoardPage() {
  const router = useRouter();
  const [cards, setCards] = useState<CardNews[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"칸반" | "리스트">("칸반");

  async function load() {
    const { cards } = await api<{ cards: CardNews[] }>("/api/cards");
    setCards(cards);
    setLoading(false);
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 25000); // 예약 도래 반영
    return () => clearInterval(t);
  }, []);

  if (loading) return <div className="py-20 text-center text-muted">불러오는 중…</div>;

  const byStatus = (s: CardStatus) => cards.filter((c) => c.status === s);

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
          <EmptyState title="콘텐츠가 없어요" desc="AI 기획 리스트에서 첫 기획을 추가해 보세요." action={<Link href="/app/plans"><Button>AI 기획 리스트로 →</Button></Link>} />
        </Card>
      ) : view === "칸반" ? (
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-3 min-w-max" style={{ height: 640 }}>
            {KANBAN_COLUMNS.map((col) => {
              const items = byStatus(col);
              return (
                <div key={col} className="w-64 shrink-0 flex flex-col bg-paper-2/40 rounded-2xl border border-line">
                  <div className="px-3.5 py-3 flex items-center justify-between sticky top-0">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLUMN_TONE[col] }} />
                      <span className="text-sm font-medium">{col}</span>
                    </div>
                    <span className="text-xs text-muted">{items.length}</span>
                  </div>
                  <div className="px-2.5 pb-2.5 space-y-2 overflow-y-auto flex-1">
                    {items.map((c) => {
                      const t = getTheme(c.theme);
                      return (
                        <button key={c.id} onClick={() => router.push(`/app/create/${c.id}`)} className="w-full text-left">
                          <div className="rounded-xl bg-card border border-line p-3 hover:-translate-y-0.5 transition">
                            <div className="h-14 rounded-lg mb-2 flex items-end p-2" style={{ background: t.bg }}>
                              <span className="text-xs font-medium line-clamp-2 leading-tight" style={{ color: t.fg }}>
                                {c.title}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 flex-wrap">
                              <Badge tone={c.format === "릴스" ? "rose" : "muted"}>{c.format === "릴스" ? "릴스" : "게시물"}</Badge>
                              <span className="text-xs text-muted">{c.pageCount}{c.format === "릴스" ? "컷" : "장"}</span>
                            </div>
                            <div className="text-[11px] text-muted mt-1">{formatDate(c.updatedAt)}</div>
                          </div>
                        </button>
                      );
                    })}
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
