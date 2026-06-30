"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Badge, Button, Card, EmptyState, Field, inputClass, SectionTitle } from "@/components/ui";
import { Generating } from "@/components/Generating";
import { Modal } from "@/components/WorkspaceShell";
import type { CardFormat, CardNews, ContentObjective, Strategy, TopicSource } from "@/lib/types";

const OBJECTIVES: ContentObjective[] = ["조회", "저장", "공유", "방문", "문의", "팔로우", "댓글"];
const PLAN_STATUSES = ["기획중", "기획완료"];

export default function PlansPage() {
  const router = useRouter();
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [cards, setCards] = useState<CardNews[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [working, setWorking] = useState<string>("");
  const [regen, setRegen] = useState(false);

  // 기획 추가 폼
  const [form, setForm] = useState({
    topicSource: "직접입력" as TopicSource,
    topicTitle: "",
    format: "카드뉴스" as CardFormat,
    objective: "저장" as ContentObjective,
    pageCount: 5,
    keyMessage: "",
  });

  async function load() {
    const [{ strategy }, { cards }] = await Promise.all([
      api<{ strategy: Strategy | null }>("/api/strategy"),
      api<{ cards: CardNews[] }>("/api/cards"),
    ]);
    setStrategy(strategy);
    setCards(cards);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  const plans = cards.filter((c) => PLAN_STATUSES.includes(c.status));

  function openAdd(prefill?: Partial<typeof form>) {
    setForm((f) => ({ ...f, topicTitle: "", keyMessage: "", topicSource: "직접입력", ...prefill }));
    setAdding(true);
  }

  async function createPlan() {
    if (!form.topicTitle.trim()) return;
    setAdding(false);
    const reels = form.format === "릴스";
    setWorking(reels ? "릴스 대본을 쓰는 중…" : "기획 아웃라인을 잡는 중…");
    try {
      const { card } = await api<{ card: CardNews }>("/api/cards", { method: "POST", body: form });
      setCards((c) => [card, ...c]);
      // 릴스는 기획 단계에서 대본까지 완성 → 바로 업로드 화면(에디터)으로
      if (reels) router.push(`/app/create/${card.id}`);
    } finally {
      setWorking("");
    }
  }

  // 카드뉴스: 본문 생성 후 에디터로 / 릴스: 생성 없이 바로 업로드 화면
  async function produce(card: CardNews) {
    if (card.format === "릴스") {
      router.push(`/app/create/${card.id}`);
      return;
    }
    setWorking("카드뉴스 본문을 쓰는 중…");
    try {
      await api(`/api/cards/${card.id}/generate`, { method: "POST" });
      router.push(`/app/create/${card.id}`);
    } catch {
      setWorking("");
    }
  }

  async function regenerate() {
    setRegen(true);
    try {
      const { strategy } = await api<{ strategy: Strategy }>("/api/strategy", { method: "POST" });
      setStrategy(strategy);
    } finally {
      setRegen(false);
    }
  }

  async function remove(id: string) {
    await api(`/api/cards/${id}`, { method: "DELETE" });
    setCards((c) => c.filter((x) => x.id !== id));
  }

  if (loading) return <div className="py-20 text-center text-muted">불러오는 중…</div>;
  if (working)
    return (
      <Card className="p-6">
        <Generating title={working} messages={["주제를 풀어내는 중", "내 톤·금지 표현을 반영하는 중", "페이지 구성을 잡는 중", "캡션·해시태그를 고르는 중"]} />
      </Card>
    );

  return (
    <div className="space-y-6">
      <SectionTitle
        eyebrow="워크스페이스"
        title="AI 기획 리스트"
        desc="전략에서 받은 주제로, 또는 내가 기획한 주제로 카드뉴스를 만들어요."
        action={<Button size="sm" onClick={() => openAdd()}>+ 기획 추가</Button>}
      />

      {/* 전략 요약 */}
      {strategy && (
        <Card className="p-5 bg-ink text-paper border-ink">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge tone="coral">{strategy.stage}</Badge>
            <span className="text-sm text-paper/90">{strategy.diagnosis}</span>
            <button onClick={regenerate} disabled={regen} className="ml-auto text-xs text-paper/60 hover:text-paper">
              {regen ? "생성 중…" : "전략 다시 생성"}
            </button>
          </div>
          <p className="text-sm text-coral mt-3 font-medium">이번 주 목표 · 주 {strategy.recommendedCount}회</p>
          <p className="text-sm text-paper/90">{strategy.weeklyGoal}</p>
          <div className="mt-4 grid sm:grid-cols-2 gap-2">
            {strategy.topics.map((t, i) => (
              <button
                key={i}
                onClick={() => openAdd({ topicSource: "추천", topicTitle: t.title, objective: mapGoal(t.goal) })}
                className="text-left rounded-xl bg-paper/10 hover:bg-paper/20 px-3.5 py-2.5 transition"
              >
                <div className="text-sm text-paper font-medium leading-snug">{t.title}</div>
                <div className="text-xs text-paper/60 mt-0.5">목적 {t.goal} · {t.hookDirection}</div>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* 기획 리스트 테이블 */}
      {plans.length === 0 ? (
        <Card>
          <EmptyState
            title="기획이 비어 있어요"
            desc="추천 주제를 누르거나 ‘기획 추가’로 내 주제를 넣어 첫 기획을 만들어 보세요."
            action={<Button onClick={() => openAdd()}>기획 추가</Button>}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted border-b border-line bg-paper-2/40">
                  <th className="py-3 px-4 font-medium w-10">No.</th>
                  <th className="py-3 px-3 font-medium">형식</th>
                  <th className="py-3 px-3 font-medium w-14">장 수</th>
                  <th className="py-3 px-3 font-medium">타이틀(주제)</th>
                  <th className="py-3 px-3 font-medium">서브타이틀 · 본문</th>
                  <th className="py-3 px-4 font-medium w-32"></th>
                </tr>
              </thead>
              <tbody>
                {plans.map((c, i) => (
                  <tr key={c.id} className="border-b border-line/60 align-top">
                    <td className="py-3 px-4 text-muted">{i + 1}</td>
                    <td className="py-3 px-3">
                      <Badge tone={c.format === "릴스" ? "rose" : c.format === "사진첨부형 카드뉴스" ? "amber" : "muted"}>
                        {c.format === "사진첨부형 카드뉴스" ? "사진첨부형" : c.format}
                      </Badge>
                    </td>
                    <td className="py-3 px-3">{c.pageCount}장</td>
                    <td className="py-3 px-3">
                      <div className="font-medium text-ink">{c.title}</div>
                      <div className="mt-1 flex items-center gap-1.5">
                        <Badge tone={c.status === "기획완료" ? "teal" : "muted"}>{c.status}</Badge>
                        <span className="text-xs text-muted">{c.topicSource}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-ink-soft">
                      <div className="space-y-0.5 max-w-md">
                        {c.pages.slice(0, 3).map((p) => (
                          <div key={p.index} className="truncate">
                            <span className="text-ink">{p.index + 1}. {p.headline}</span>
                            {p.body && <span className="text-muted"> — {p.body}</span>}
                          </div>
                        ))}
                        {c.pages.length > 3 && <div className="text-xs text-muted">+ {c.pages.length - 3}장</div>}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-1.5">
                        <Button size="sm" onClick={() => produce(c)}>
                          {c.format === "릴스" ? "업로드하기 →" : "제작하러가기 →"}
                        </Button>
                        <button onClick={() => remove(c.id)} className="text-xs text-muted hover:text-coral">
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* 기획 추가 모달 */}
      {adding && (
        <Modal onClose={() => setAdding(false)}>
          <h3 className="font-display text-xl mb-4">기획 추가</h3>
          <div className="space-y-3">
            <Field label="주제 / 타이틀">
              <input className={inputClass} value={form.topicTitle} onChange={(e) => setForm((f) => ({ ...f, topicTitle: e.target.value }))} placeholder="예: 이번 주 신메뉴 출시 알림" />
            </Field>
            <Field label="형식">
              <div className="grid grid-cols-3 gap-2">
                {(["카드뉴스", "사진첨부형 카드뉴스", "릴스"] as CardFormat[]).map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => setForm((f) => ({ ...f, format: fmt }))}
                    className={`rounded-xl border px-2 py-2 text-sm ${form.format === fmt ? "border-ink bg-paper-2/50" : "border-line text-ink-soft"}`}
                  >
                    {fmt === "사진첨부형 카드뉴스" ? "사진첨부형" : fmt}
                  </button>
                ))}
              </div>
              {form.format === "릴스" && (
                <p className="text-xs text-muted mt-1.5">릴스는 대본·캡션만 만들고, 영상은 직접 업로드해요(제작 단계 없음).</p>
              )}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="목적">
                <select className={inputClass} value={form.objective} onChange={(e) => setForm((f) => ({ ...f, objective: e.target.value as ContentObjective }))}>
                  {OBJECTIVES.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </Field>
              <Field label={form.format === "릴스" ? "장면 수" : "페이지 수"} hint={`${form.pageCount}${form.format === "릴스" ? "장면" : "장"}`}>
                <input type="range" min={3} max={form.format === "릴스" ? 6 : 8} value={form.pageCount} onChange={(e) => setForm((f) => ({ ...f, pageCount: Number(e.target.value) }))} className="w-full accent-[#ef5a35]" />
              </Field>
            </div>
            <Field label="핵심 메시지" hint="선택">
              <textarea className={inputClass} rows={2} value={form.keyMessage} onChange={(e) => setForm((f) => ({ ...f, keyMessage: e.target.value }))} placeholder="꼭 들어갈 한 줄/포인트" />
            </Field>
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <Button variant="ghost" onClick={() => setAdding(false)}>취소</Button>
            <Button onClick={createPlan} disabled={!form.topicTitle.trim()}>기획 생성</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function mapGoal(goal: string): ContentObjective {
  const set: ContentObjective[] = ["조회", "저장", "공유", "방문", "문의", "팔로우", "댓글"];
  return (set.find((g) => g === goal) as ContentObjective) || "저장";
}
