"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, formatDate } from "@/lib/client";
import { Badge, Button, Card, Field, inputClass } from "@/components/ui";
import { Generating } from "@/components/Generating";
import { CardCanvas, THEMES, getTheme } from "@/components/CardCanvas";
import { activeIgHandle, findIgAccount, type CardNews, type CardPage, type IgAccount, type PublicUser, type ReviewFlag } from "@/lib/types";

type Tab = "편집" | "검수" | "발행";

export default function EditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [card, setCard] = useState<CardNews | null>(null);
  const [user, setUser] = useState<PublicUser | null>(null);
  const [publicBase, setPublicBase] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("편집");
  const [activePage, setActivePage] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [producing, setProducing] = useState(false);
  const [hashtagsText, setHashtagsText] = useState("");

  const [draft, setDraft] = useState<{ title: string; pages: CardPage[]; caption: string; cta: string; theme: string; brandColor: string } | null>(null);

  const load = useCallback(async () => {
    const [{ card }, me] = await Promise.all([
      api<{ card: CardNews }>(`/api/cards/${id}`),
      api<{ user: PublicUser; publicBaseUrl: string | null }>("/api/auth/me"),
    ]);
    setCard(card);
    setUser(me.user);
    setPublicBase(me.publicBaseUrl);
    setDraft({ title: card.title, pages: card.pages.map((p) => ({ ...p })), caption: card.caption, cta: card.cta, theme: card.theme, brandColor: card.brandColor });
    setHashtagsText(card.hashtags.join(" "));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function produce() {
    setProducing(true);
    try {
      await api(`/api/cards/${id}/generate`, { method: "POST" });
      await load();
      setProducing(false);
    } catch {
      setProducing(false);
    }
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      const { card } = await api<{ card: CardNews }>(`/api/cards/${id}`, {
        method: "PATCH",
        body: {
          title: draft.title,
          pages: draft.pages,
          caption: draft.caption,
          cta: draft.cta,
          theme: draft.theme,
          brandColor: draft.brandColor,
          hashtags: hashtagsText.split(/[\s,]+/).map((h) => h.replace(/^#/, "")).filter(Boolean).map((h) => `#${h}`),
        },
      });
      setCard(card);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }

  function patchDraft(p: Partial<NonNullable<typeof draft>>) {
    setDraft((d) => (d ? { ...d, ...p } : d));
    setDirty(true);
  }
  function patchPage(i: number, p: Partial<CardPage>) {
    setDraft((d) => (d ? { ...d, pages: d.pages.map((pg, idx) => (idx === i ? { ...pg, ...p } : pg)) } : d));
    setDirty(true);
  }

  if (!card || !draft || !user) return <div className="py-20 text-center text-muted">불러오는 중…</div>;

  if (producing)
    return (
      <Card className="p-6">
        <Generating title="카드뉴스 본문을 쓰는 중…" messages={["주제를 풀어내는 중", "내 톤을 반영하는 중", "페이지 구성·후킹을 잡는 중", "캡션·해시태그를 고르는 중"]} />
      </Card>
    );

  const niche = user.survey?.niche ?? "";
  const handle = activeIgHandle(user) ?? user.name;
  const activeAccount = findIgAccount(user);
  const isReels = card.format === "릴스";
  const isPlan = (card.status === "기획중" || card.status === "기획완료") && !isReels;
  const photo = card.format === "사진첨부형 카드뉴스";

  return (
    <div>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-5">
        <div>
          <button onClick={() => router.push("/app/board")} className="text-sm text-muted hover:text-ink">
            ← 콘텐츠 관리
          </button>
          <h1 className="font-display text-2xl mt-1">{draft.title || "제목 없음"}</h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <StatusBadge status={card.status} />
            <Badge tone={isReels ? "rose" : photo ? "amber" : "muted"}>{isReels ? "릴스" : photo ? "사진첨부형" : "카드뉴스"}</Badge>
            {!isPlan && (card.aiEdited ? <Badge tone="teal">사용자 편집됨</Badge> : <Badge tone="muted">{card.aiLabel}</Badge>)}
            <Badge tone="muted">{card.generatedBy === "ai" ? "Claude" : card.generatedBy === "template" ? "템플릿" : "기획"}</Badge>
          </div>
        </div>
        {!isPlan && (
          <div className="flex items-center gap-2">
            {dirty && <span className="text-xs text-amber">저장 안 됨</span>}
            <Button variant="outline" size="sm" onClick={save} disabled={saving || !dirty}>
              {saving ? "저장 중…" : "변경 저장"}
            </Button>
          </div>
        )}
      </div>

      {/* 릴스: 대본 + 영상 업로드 + 발행 (단일 화면) */}
      {isReels ? (
        <ReelsEditor
          card={card}
          draft={draft}
          hashtagsText={hashtagsText}
          setHashtagsText={(v) => { setHashtagsText(v); setDirty(true); }}
          patchDraft={patchDraft}
          patchPage={patchPage}
          dirty={dirty}
          saving={saving}
          save={save}
          onChange={setCard}
          reload={load}
          account={activeAccount}
          publicBase={publicBase}
        />
      ) : isPlan ? (
        <div className="grid lg:grid-cols-[1fr_400px] gap-6 items-start">
          <Card className="p-6">
            <Badge tone="coral">기획 단계</Badge>
            <h2 className="font-display text-xl mt-3">아직 본문이 없어요</h2>
            <p className="text-sm text-ink-soft mt-1">아래 아웃라인을 바탕으로 본문·캡션·해시태그를 한 번에 생성해요.</p>
            <div className="mt-4 space-y-1.5">
              {card.pages.map((p) => (
                <div key={p.index} className="text-sm">
                  <span className="text-ink font-medium">{p.index + 1}. {p.headline}</span>
                  {p.body && <span className="text-muted"> — {p.body}</span>}
                </div>
              ))}
            </div>
            <Button className="mt-5" onClick={produce}>제작하러가기 →</Button>
          </Card>
          <div className="lg:sticky lg:top-20">
            <Preview pages={draft.pages} theme={draft.theme} brandColor={draft.brandColor} photo={photo} niche={niche} handle={handle} active={activePage} setActive={setActivePage} />
          </div>
        </div>
      ) : (
        <>
          <div className="flex gap-1 mb-5 bg-paper-2/60 p-1 rounded-xl w-fit">
            {(["편집", "검수", "발행"] as Tab[]).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${tab === t ? "bg-card shadow-sm text-ink" : "text-ink-soft"}`}>
                {t}
                {t === "검수" && card.reviewFlags.some((f) => !f.resolved) && <span className="ml-1.5 inline-block w-2 h-2 rounded-full bg-coral align-middle" />}
              </button>
            ))}
          </div>

          <div className="grid lg:grid-cols-[1fr_400px] gap-6 items-start">
            <div className="min-w-0 order-2 lg:order-1">
              {tab === "편집" && (
                <EditTab draft={draft} photo={photo} hashtagsText={hashtagsText} setHashtagsText={(v) => { setHashtagsText(v); setDirty(true); }} patchDraft={patchDraft} patchPage={patchPage} activePage={activePage} setActivePage={setActivePage} />
              )}
              {tab === "검수" && <ReviewTab card={card} dirty={dirty} onChange={setCard} onSaveNeeded={save} />}
              {tab === "발행" && <PublishTab card={card} draft={draft} photo={photo} niche={niche} handle={handle} account={activeAccount} publicBase={publicBase} reload={load} />}
            </div>
            <div className="order-1 lg:order-2 lg:sticky lg:top-20">
              <Preview pages={draft.pages} theme={draft.theme} brandColor={draft.brandColor} photo={photo} niche={niche} handle={handle} active={activePage} setActive={setActivePage} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: CardNews["status"] }) {
  const tone =
    status === "업로드완료" || status === "제작완료" ? "teal"
    : status === "예약업로드" || status === "기획완료" ? "amber"
    : "muted";
  return <Badge tone={tone as "teal" | "amber" | "muted"}>{status}</Badge>;
}

function EditTab({ draft, photo, hashtagsText, setHashtagsText, patchDraft, patchPage, activePage, setActivePage }: {
  draft: { title: string; pages: CardPage[]; caption: string; cta: string; theme: string; brandColor: string };
  photo: boolean;
  hashtagsText: string;
  setHashtagsText: (v: string) => void;
  patchDraft: (p: Partial<{ title: string; caption: string; cta: string; theme: string; brandColor: string }>) => void;
  patchPage: (i: number, p: Partial<CardPage>) => void;
  activePage: number;
  setActivePage: (i: number) => void;
}) {
  const pg = draft.pages[activePage];
  return (
    <div className="space-y-5">
      <Card className="p-5 space-y-4">
        <Field label="제목 (저장용)">
          <input className={inputClass} value={draft.title} onChange={(e) => patchDraft({ title: e.target.value })} />
        </Field>
        <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
          <Field label="테마">
            <div className="flex flex-wrap gap-2">
              {THEMES.map((t) => (
                <button key={t.key} onClick={() => patchDraft({ theme: t.key })} className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm ${draft.theme === t.key ? "border-ink" : "border-line"}`}>
                  <span className="w-4 h-4 rounded-full border border-line" style={{ background: getTheme(t.key).bg }} />
                  {t.name}
                </button>
              ))}
            </div>
          </Field>
          <Field label="브랜드 컬러">
            <input type="color" value={draft.brandColor} onChange={(e) => patchDraft({ brandColor: e.target.value })} className="w-12 h-10 rounded-lg border border-line p-1 cursor-pointer" />
          </Field>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex gap-1.5 flex-wrap mb-4">
          {draft.pages.map((_, i) => (
            <button key={i} onClick={() => setActivePage(i)} className={`w-9 h-9 rounded-lg text-sm font-medium ${activePage === i ? "bg-ink text-paper" : "bg-paper-2 text-ink-soft"}`}>
              {i + 1}
            </button>
          ))}
        </div>
        {pg && (
          <div className="space-y-3">
            <Field label={`${activePage + 1}장 헤드라인`}>
              <textarea className={inputClass} rows={2} value={pg.headline} onChange={(e) => patchPage(activePage, { headline: e.target.value })} />
            </Field>
            <Field label="본문">
              <textarea className={inputClass} rows={3} value={pg.body} onChange={(e) => patchPage(activePage, { body: e.target.value })} />
            </Field>
            {photo && (
              <Field label="사진 설명" hint="이 장에 넣을 사진">
                <input className={inputClass} value={pg.photoNote ?? ""} onChange={(e) => patchPage(activePage, { photoNote: e.target.value })} placeholder="예: 신메뉴 클로즈업" />
              </Field>
            )}
            {pg.note && <p className="text-xs text-muted">💡 {pg.note}</p>}
          </div>
        )}
      </Card>

      <Card className="p-5 space-y-4">
        <Field label="캡션">
          <textarea className={inputClass} rows={4} value={draft.caption} onChange={(e) => patchDraft({ caption: e.target.value })} />
        </Field>
        <Field label="해시태그" hint="공백/쉼표로 구분">
          <textarea className={inputClass} rows={2} value={hashtagsText} onChange={(e) => setHashtagsText(e.target.value)} />
        </Field>
        <Field label="CTA">
          <input className={inputClass} value={draft.cta} onChange={(e) => patchDraft({ cta: e.target.value })} />
        </Field>
      </Card>
    </div>
  );
}

function ReviewTab({ card, dirty, onChange, onSaveNeeded }: { card: CardNews; dirty: boolean; onChange: (c: CardNews) => void; onSaveNeeded: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const unresolved = card.reviewFlags.filter((f) => !f.resolved);
  const allResolved = unresolved.length === 0;

  async function runReview() {
    setBusy(true);
    if (dirty) await onSaveNeeded();
    const { card: c } = await api<{ card: CardNews }>(`/api/cards/${card.id}/review`, { method: "POST" });
    onChange(c);
    setBusy(false);
  }
  async function toggleFlag(flag: ReviewFlag) {
    const { card: c } = await api<{ card: CardNews }>(`/api/cards/${card.id}/review`, { method: "PATCH", body: { flagId: flag.id, resolved: !flag.resolved } });
    onChange(c);
  }
  async function pass() {
    setBusy(true);
    try {
      const { card: c } = await api<{ card: CardNews }>(`/api/cards/${card.id}/review`, { method: "PATCH", body: { action: "pass" } });
      onChange(c);
    } finally {
      setBusy(false);
    }
  }

  const passed = card.status === "제작완료" || card.status === "예약업로드" || card.status === "업로드완료";

  return (
    <div className="space-y-5">
      <Card className="p-5 bg-amber-soft/50 border-amber-soft">
        <div className="flex items-start gap-3">
          <span className="text-xl">🛡</span>
          <div>
            <div className="font-medium">검수 = 필수 게이트 (휴먼인더루프)</div>
            <p className="text-sm text-ink-soft mt-1">
              발행 전 검수를 반드시 거쳐요. ‘AI 생성물’ 표기 · 출처 확인 · 민감 표현(권유·강요) · 표기 누락을
              확인/수정해야 발행 버튼이 켜집니다. 플래그 중심으로 1~2분이면 충분해요.
            </p>
          </div>
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <div className="text-sm">
          자동 점검: <span className="font-medium">{card.reviewFlags.length === 0 ? "플래그 없음 ✓" : `${unresolved.length}건 확인 필요`}</span>
        </div>
        <Button variant="outline" size="sm" onClick={runReview} disabled={busy}>
          {busy ? "점검 중…" : "검수 다시 실행"}
        </Button>
      </div>

      <div className="space-y-3">
        {card.reviewFlags.map((f) => (
          <Card key={f.id} className={`p-4 ${f.resolved ? "opacity-60" : ""}`}>
            <div className="flex items-start gap-3">
              <input type="checkbox" checked={f.resolved} onChange={() => toggleFlag(f)} className="mt-1 w-4 h-4 accent-[#1f6f63]" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Badge tone={f.severity === "high" ? "rose" : f.severity === "medium" ? "amber" : "muted"}>{f.type}</Badge>
                  {f.excerpt && <span className="text-xs text-muted">“{f.excerpt}”</span>}
                </div>
                <p className="text-sm text-ink-soft mt-1.5">{f.message}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="font-medium">검수 통과 · 사용자 승인</div>
            <p className="text-sm text-ink-soft">{allResolved ? "모든 항목을 확인했어요. 통과하면 발행 단계로 넘어가요." : "미해결 항목을 모두 체크해야 통과할 수 있어요."}</p>
          </div>
          {passed ? <Badge tone="teal">✓ 통과됨</Badge> : <Button onClick={pass} disabled={!allResolved || busy}>승인하고 통과 →</Button>}
        </div>
      </Card>

      {card.approvalLog.length > 0 && (
        <Card className="p-5">
          <div className="text-sm font-medium mb-2">승인 로그</div>
          <ul className="space-y-1 text-sm text-ink-soft">
            {card.approvalLog.map((l, i) => (
              <li key={i} className="flex justify-between">
                <span>{l.action}</span>
                <span className="text-muted">{l.actor} · {formatDate(l.at)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function PublishTab({ card, draft, photo, niche, handle, account, publicBase, reload }: {
  card: CardNews;
  draft: { pages: CardPage[]; theme: string; brandColor: string };
  photo: boolean;
  niche: string;
  handle: string;
  account?: IgAccount;
  publicBase: string | null;
  reload: () => Promise<void>;
}) {
  const exportRef = useRef<HTMLDivElement>(null);
  const [exportIdx, setExportIdx] = useState<number | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [stage, setStage] = useState("");
  const [scheduleAt, setScheduleAt] = useState("");
  const [msg, setMsg] = useState("");

  const ready = card.status === "제작완료";
  const done = card.status === "업로드완료";
  const reserved = card.status === "예약업로드";
  const live = account?.mode === "정식";
  const liveReady = live && Boolean(publicBase);

  async function renderPage(idx: number, kind: "png" | "jpeg"): Promise<string> {
    const lib = await import("html-to-image");
    setExportIdx(idx);
    await new Promise((r) => setTimeout(r, 140)); // 렌더 대기
    if (!exportRef.current) throw new Error("no node");
    return kind === "jpeg"
      ? lib.toJpeg(exportRef.current, { width: 1080, height: 1080, pixelRatio: 1, skipFonts: true, quality: 0.92 })
      : lib.toPng(exportRef.current, { width: 1080, height: 1080, pixelRatio: 1, skipFonts: true });
  }

  async function downloadAll() {
    setDownloading(true);
    try {
      for (let i = 0; i < draft.pages.length; i++) {
        const url = await renderPage(i, "png");
        const a = document.createElement("a");
        a.href = url;
        a.download = `${card.title || "card"}_${i + 1}.png`;
        a.click();
        await new Promise((r) => setTimeout(r, 120));
      }
      setMsg("이미지 PNG를 모두 내려받았어요.");
    } catch {
      setMsg("이미지 생성 중 문제가 생겼어요. 다시 시도해 주세요.");
    } finally {
      setExportIdx(null);
      setDownloading(false);
    }
  }

  // 실제 발행 전: 모든 페이지를 JPEG로 렌더 → 서버 업로드(인스타가 가져갈 공개 이미지)
  async function uploadImages() {
    setStage("이미지 렌더링…");
    const images: string[] = [];
    for (let i = 0; i < draft.pages.length; i++) {
      images.push(await renderPage(i, "jpeg"));
    }
    setExportIdx(null);
    setStage("이미지 업로드…");
    await api(`/api/cards/${card.id}/images`, { method: "PUT", body: { images } });
  }

  async function publish(immediate: boolean) {
    setPublishing(true);
    setMsg("");
    try {
      if (live) await uploadImages(); // 정식 계정이면 이미지 먼저 업로드
      setStage(immediate ? (live ? "인스타 발행 중…" : "발행 중…") : "예약 등록…");
      const body = immediate ? {} : { scheduledAt: scheduleAt ? new Date(scheduleAt).getTime() : 0 };
      await api(`/api/cards/${card.id}/publish`, { method: "POST", body });
      await reload();
      setMsg(immediate ? (live ? "인스타그램에 발행했어요! 🎉" : "발행했어요! (테스터 베타 시뮬레이션)") : "예약 발행을 등록했어요.");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setStage("");
      setPublishing(false);
    }
  }

  return (
    <div className="space-y-5">
      <div style={{ position: "fixed", left: -99999, top: 0 }} aria-hidden>
        <div ref={exportRef}>
          {exportIdx !== null && draft.pages[exportIdx] && (
            <CardCanvas page={draft.pages[exportIdx]} index={exportIdx} total={draft.pages.length} themeKey={draft.theme} brandColor={draft.brandColor} photo={photo} niche={niche} handle={handle} />
          )}
        </div>
      </div>

      {/* 발행 대상 계정 상태 */}
      <Card className="p-4 flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm">
          발행 대상: {handle ? <b>@{handle}</b> : "미연동"}{" "}
          {live ? <Badge tone="teal">정식 연동</Badge> : <Badge tone="amber">테스터 시뮬레이션</Badge>}
        </div>
        {live && !publicBase && <span className="text-xs text-coral">PUBLIC_BASE_URL 미설정 — 실제 발행 불가</span>}
      </Card>

      {!ready && !done && !reserved && (
        <Card className="p-5 bg-amber-soft/40 border-amber-soft">
          <p className="text-sm text-ink-soft">🔒 아직 발행할 수 없어요. <b>검수 탭에서 게이트를 통과(사용자 승인)</b>해야 발행 버튼이 켜집니다.</p>
        </Card>
      )}

      <Card className="p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="font-medium">이미지로 생성</div>
            <p className="text-sm text-ink-soft">카드 {draft.pages.length}장을 1080×1080 PNG로 내보내요.</p>
          </div>
          <Button variant="outline" onClick={downloadAll} disabled={downloading || publishing}>
            {downloading ? "생성 중…" : "PNG 전체 다운로드"}
          </Button>
        </div>
      </Card>

      <Card className="p-5">
        <div className="text-sm font-medium mb-2">캡션 · 해시태그</div>
        <pre className="preserve-lines text-sm bg-paper-2/60 rounded-xl p-3 text-ink-soft max-h-40 overflow-auto">{card.caption}{"\n\n"}{card.hashtags.join(" ")}</pre>
        <Button variant="ghost" size="sm" className="mt-2" onClick={() => { navigator.clipboard?.writeText(`${card.caption}\n\n${card.hashtags.join(" ")}`); setMsg("캡션을 복사했어요."); }}>
          캡션 복사
        </Button>
      </Card>

      {done ? (
        <Card className="p-6 bg-teal-soft/50 border-teal-soft text-center">
          <div className="font-display text-xl text-teal">업로드 완료 ✓</div>
          <p className="text-sm text-ink-soft mt-1">발행을 누른 건 당신이에요. 다음 100명으로!</p>
        </Card>
      ) : (
        <Card className="p-5 space-y-4">
          <div className="font-medium">발행 — 내가 누르는 발행</div>
          <p className="text-sm text-ink-soft">
            {reserved
              ? "예약이 걸려 있어요. 예약 시각이 되면 발행됩니다(콘텐츠 관리에서 취소 가능)."
              : live
              ? "‘지금 발행’을 누르면 카드 이미지를 만들어 인스타그램에 실제로 업로드해요(캐러셀)."
              : "지금 발행하거나 시간을 정해 예약하세요. 정식 연동 전에는 모의 발행으로 흐름을 검증해요."}
          </p>
          <div className="grid sm:grid-cols-2 gap-3 items-end">
            <Button onClick={() => publish(true)} disabled={!ready || publishing || (live && !publicBase)}>
              {publishing ? stage || "발행 중…" : live ? "지금 인스타 발행" : "지금 발행"}
            </Button>
            <div className="flex gap-2 items-end">
              <Field label="예약 시각">
                <input type="datetime-local" className={inputClass} value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} />
              </Field>
              <Button variant="outline" onClick={() => publish(false)} disabled={!ready || publishing || !scheduleAt || (live && !publicBase)}>예약</Button>
            </div>
          </div>
          {live && (
            <p className="text-xs text-muted">실제 발행은 카드 이미지를 공개 주소로 서빙해 인스타가 가져갑니다. 발행에 10~30초 걸릴 수 있어요.</p>
          )}
        </Card>
      )}

      {msg && <p className="text-sm text-teal">{msg}</p>}
    </div>
  );
}

function Preview({ pages, theme, brandColor, photo, niche, handle, active, setActive }: {
  pages: CardPage[];
  theme: string;
  brandColor: string;
  photo: boolean;
  niche: string;
  handle: string;
  active: number;
  setActive: (i: number) => void;
}) {
  const SCALE = 0.342;
  const idx = Math.min(active, pages.length - 1);
  const page = pages[idx];
  return (
    <Card className="p-4">
      <div className="text-xs text-muted mb-2 flex items-center justify-between">
        <span>미리보기</span>
        <span>{idx + 1} / {pages.length}</span>
      </div>
      <div className="mx-auto rounded-xl overflow-hidden border border-line" style={{ width: 1080 * SCALE, height: 1080 * SCALE }}>
        <div style={{ transform: `scale(${SCALE})`, transformOrigin: "top left", width: 1080, height: 1080 }}>
          {page && <CardCanvas page={page} index={idx} total={pages.length} themeKey={theme} brandColor={brandColor} photo={photo} niche={niche} handle={handle} />}
        </div>
      </div>
      <div className="flex justify-center gap-1.5 mt-3 flex-wrap">
        {pages.map((_, i) => (
          <button key={i} onClick={() => setActive(i)} className={`w-2.5 h-2.5 rounded-full ${i === idx ? "bg-coral" : "bg-paper-2"}`} />
        ))}
      </div>
    </Card>
  );
}

// ── 릴스 에디터 (대본 + 영상 업로드 + 검수 + 발행, 단일 화면) ────────────────────
function ReelsEditor({
  card, draft, hashtagsText, setHashtagsText, patchDraft, patchPage, dirty, saving, save, onChange, reload, account, publicBase,
}: {
  card: CardNews;
  draft: { title: string; pages: CardPage[]; caption: string; cta: string };
  hashtagsText: string;
  setHashtagsText: (v: string) => void;
  patchDraft: (p: Partial<{ title: string; caption: string; cta: string }>) => void;
  patchPage: (i: number, p: Partial<CardPage>) => void;
  dirty: boolean;
  saving: boolean;
  save: () => Promise<void>;
  onChange: (c: CardNews) => void;
  reload: () => Promise<void>;
  account?: IgAccount;
  publicBase: string | null;
}) {
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const live = account?.mode === "정식";
  const unresolved = card.reviewFlags.filter((f) => !f.resolved);
  const allResolved = unresolved.length === 0;
  const hasVideo = !!card.hasVideo;
  const done = card.status === "업로드완료";
  const reserved = card.status === "예약업로드";
  const canPublishNow = allResolved && hasVideo && !(live && !publicBase);

  async function runReview() {
    setBusy(true);
    if (dirty) await save();
    const { card: c } = await api<{ card: CardNews }>(`/api/cards/${card.id}/review`, { method: "POST" });
    onChange(c);
    setBusy(false);
  }
  async function toggleFlag(f: ReviewFlag) {
    const { card: c } = await api<{ card: CardNews }>(`/api/cards/${card.id}/review`, { method: "PATCH", body: { flagId: f.id, resolved: !f.resolved } });
    onChange(c);
  }
  async function uploadVideo(file: File) {
    setUploading(true);
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("video", file);
      const res = await fetch(`/api/cards/${card.id}/video`, { method: "PUT", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || "업로드 실패");
      await reload();
      setMsg(`영상 업로드 완료 (${file.name})`);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setUploading(false);
    }
  }
  async function publish(immediate: boolean) {
    setPublishing(true);
    setMsg("");
    try {
      if (dirty) await save();
      const body = immediate ? {} : { scheduledAt: scheduleAt ? new Date(scheduleAt).getTime() : 0 };
      await api(`/api/cards/${card.id}/publish`, { method: "POST", body });
      await reload();
      setMsg(immediate ? (live ? "릴스를 인스타에 발행했어요! 🎉" : "발행했어요! (테스터 시뮬레이션)") : "예약 발행을 등록했어요.");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
      {/* 좌: 대본 + 캡션 */}
      <div className="space-y-5 min-w-0">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="font-medium">릴스 대본</div>
            <Button variant="outline" size="sm" onClick={save} disabled={saving || !dirty}>
              {saving ? "저장 중…" : dirty ? "변경 저장" : "저장됨"}
            </Button>
          </div>
          <Field label="제목">
            <input className={inputClass} value={draft.title} onChange={(e) => patchDraft({ title: e.target.value })} />
          </Field>
          <div className="mt-4 space-y-4">
            {draft.pages.map((p, i) => (
              <div key={i} className="rounded-xl border border-line p-3">
                <input
                  className="w-full bg-transparent text-sm font-medium text-coral focus:outline-none mb-2"
                  value={p.headline}
                  onChange={(e) => patchPage(i, { headline: e.target.value })}
                  placeholder={`구간 ${i + 1} (예: 후킹 0~3초)`}
                />
                <textarea
                  className={inputClass}
                  rows={2}
                  value={p.body}
                  onChange={(e) => patchPage(i, { body: e.target.value })}
                  placeholder="대사 / 화면 자막"
                />
                {p.note && <p className="text-xs text-muted mt-1.5">🎬 {p.note}</p>}
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          <Field label="캡션">
            <textarea className={inputClass} rows={4} value={draft.caption} onChange={(e) => patchDraft({ caption: e.target.value })} />
          </Field>
          <Field label="해시태그" hint="공백/쉼표로 구분">
            <textarea className={inputClass} rows={2} value={hashtagsText} onChange={(e) => setHashtagsText(e.target.value)} />
          </Field>
          <Field label="CTA">
            <input className={inputClass} value={draft.cta} onChange={(e) => patchDraft({ cta: e.target.value })} />
          </Field>
        </Card>
      </div>

      {/* 우: 영상 업로드 + 검수 + 발행 */}
      <div className="space-y-4 lg:sticky lg:top-20">
        <Card className="p-5">
          <div className="font-medium mb-1">영상 업로드</div>
          <p className="text-xs text-muted mb-3">Edits·캡컷 등에서 편집한 세로 영상(MP4)을 올려주세요.</p>
          {hasVideo ? (
            <div>
              <video src={`/api/render-video/${card.id}`} controls className="w-full rounded-xl bg-ink/5 aspect-[9/16] object-contain" />
              <div className="text-xs text-teal mt-2">업로드됨 ✓</div>
            </div>
          ) : (
            <div className="aspect-[9/16] rounded-xl border-2 border-dashed border-line grid place-items-center text-muted text-sm">
              세로 영상 9:16
            </div>
          )}
          <label className="mt-3 block">
            <input type="file" accept="video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadVideo(f); }} />
            <span className={`inline-flex w-full justify-center items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium cursor-pointer ${uploading ? "bg-paper-2 text-muted" : "bg-ink text-paper hover:bg-black"}`}>
              {uploading ? "업로드 중…" : hasVideo ? "영상 교체" : "영상 선택"}
            </span>
          </label>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="font-medium text-sm">검수 {allResolved ? "✓" : `· ${unresolved.length}건`}</div>
            <button onClick={runReview} disabled={busy} className="text-xs text-muted hover:text-ink">다시 검수</button>
          </div>
          {card.reviewFlags.length === 0 ? (
            <p className="text-xs text-muted">감지된 항목이 없어요.</p>
          ) : (
            <div className="space-y-2">
              {card.reviewFlags.map((f) => (
                <label key={f.id} className={`flex items-start gap-2 text-xs ${f.resolved ? "opacity-60" : ""}`}>
                  <input type="checkbox" checked={f.resolved} onChange={() => toggleFlag(f)} className="mt-0.5 w-3.5 h-3.5 accent-[#1f6f63]" />
                  <span className="text-ink-soft"><b>{f.type}</b> {f.message}</span>
                </label>
              ))}
            </div>
          )}
        </Card>

        {done ? (
          <Card className="p-5 bg-teal-soft/50 border-teal-soft text-center">
            <div className="font-display text-lg text-teal">업로드 완료 ✓</div>
          </Card>
        ) : (
          <Card className="p-5 space-y-3">
            <div className="font-medium text-sm">발행 — 내가 누르는 발행</div>
            <p className="text-xs text-ink-soft">
              발행 대상: {account?.handle ? <b>@{account.handle}</b> : "미연동"}{" "}
              {live ? <Badge tone="teal">정식</Badge> : <Badge tone="amber">테스터</Badge>}
            </p>
            {live && !publicBase && <p className="text-xs text-coral">PUBLIC_BASE_URL 미설정 — 실제 발행 불가</p>}
            {!hasVideo && <p className="text-xs text-amber">영상을 먼저 업로드하세요.</p>}
            {!allResolved && <p className="text-xs text-amber">검수 항목을 모두 확인하세요.</p>}
            {reserved && <p className="text-xs text-ink-soft">예약됨 — 콘텐츠 관리에서 취소 가능.</p>}
            <Button className="w-full" onClick={() => publish(true)} disabled={!canPublishNow || publishing}>
              {publishing ? "발행 중…" : live ? "지금 인스타 발행" : "지금 발행"}
            </Button>
            <div className="flex gap-2 items-end">
              <Field label="예약 시각">
                <input type="datetime-local" className={inputClass} value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} />
              </Field>
              <Button variant="outline" onClick={() => publish(false)} disabled={!canPublishNow || publishing || !scheduleAt}>예약</Button>
            </div>
          </Card>
        )}
        {msg && <p className="text-sm text-teal">{msg}</p>}
      </div>
    </div>
  );
}
