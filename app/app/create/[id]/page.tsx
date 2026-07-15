"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, formatDate } from "@/lib/workspace/client";
import { Badge, Button, Card, Field, inputClass } from "@/components/workspace/ui";
import { Modal } from "@/components/workspace/WorkspaceShell";
import { Generating } from "@/components/workspace/Generating";
import { CardCanvas, THEMES, getTheme, TEMPLATE_LABELS } from "@/components/workspace/CardCanvas";
import { Icon } from "@/components/ui/icon";
import { activeIgHandle, findIgAccount, type CardNews, type CardPage, type CardTemplate, type IgAccount, type PublicUser, type ReviewFlag, type SensitiveDomain } from "@/lib/workspace/types";
import { decideVerdict, verdictGate, VERDICT_META, isChecklist, LEGAL_BASIS_NOTE } from "@/lib/workspace/verdict";

const STEPS = ["편집", "검수", "업로드"] as const;
type Step = 0 | 1 | 2;

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}

// 파일 드롭 존 — 드래그앤드롭 + (선택) 클릭 업로드. kind로 형식 검증(image/video).
function DropZone({
  accept,
  kind,
  onFile,
  onReject,
  clickable = true,
  className = "",
  activeClassName = "border-coral bg-coral-soft/50",
  children,
}: {
  accept: string;
  kind: "image" | "video";
  onFile: (file: File) => void;
  onReject?: (file: File) => void;
  clickable?: boolean;
  className?: string;
  activeClassName?: string;
  children: ReactNode;
}) {
  const [over, setOver] = useState(false);
  const take = (f?: File | null) => {
    if (!f) return;
    if (f.type.startsWith(`${kind}/`)) onFile(f);
    else onReject?.(f); // 형식 불일치 → 안내 콜백
  };
  const onDragOver = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    if (!over) setOver(true);
  };
  const onDragLeave = (e: DragEvent<HTMLElement>) => {
    // 자식 위로 이동 시 깜빡임 방지 — 실제로 요소를 벗어날 때만 해제
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setOver(false);
  };
  const onDrop = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    setOver(false);
    take(e.dataTransfer.files?.[0]);
  };
  const cls = `${className} ${over ? activeClassName : ""} transition`;
  if (clickable) {
    return (
      <label className={cls} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
        <input type="file" accept={accept} className="hidden" onChange={(e) => { take(e.target.files?.[0]); e.target.value = ""; }} />
        {children}
      </label>
    );
  }
  return (
    <div className={cls} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      {children}
    </div>
  );
}

export default function EditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [card, setCard] = useState<CardNews | null>(null);
  const [user, setUser] = useState<PublicUser | null>(null);
  const [publicBase, setPublicBase] = useState<string | null>(null);
  const [step, setStep] = useState<Step>(0);
  const [activePage, setActivePage] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [producing, setProducing] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [stepMsg, setStepMsg] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [hashtagsText, setHashtagsText] = useState("");
  const [photos, setPhotos] = useState<Record<number, string>>({});

  const [draft, setDraft] = useState<{ title: string; pages: CardPage[]; caption: string; cta: string; theme: string; brandColor: string; photoStyle: "top" | "bg"; ratio: "1:1" | "3:4" } | null>(null);
  const [consent, setConsent] = useState(false); // 🔴 경고 판정 시 책임 동의

  const loadPhotos = useCallback(async (cardId: string) => {
    try {
      const { pages } = await api<{ pages: number[] }>(`/api/cards/${cardId}/photos`);
      const entries = await Promise.all(
        pages.map(async (p) => {
          const res = await fetch(`/api/cards/${cardId}/photo/${p}`);
          if (!res.ok) return null;
          return [p, await blobToDataUrl(await res.blob())] as [number, string];
        })
      );
      setPhotos(Object.fromEntries(entries.filter(Boolean) as [number, string][]));
    } catch {
      /* noop */
    }
  }, []);

  const load = useCallback(async () => {
    const [{ card }, me] = await Promise.all([
      api<{ card: CardNews }>(`/api/cards/${id}`),
      api<{ user: PublicUser; publicBaseUrl: string | null }>("/api/auth/me"),
    ]);
    setCard(card);
    setUser(me.user);
    setPublicBase(me.publicBaseUrl);
    setDraft({ title: card.title, pages: card.pages.map((p) => ({ ...p })), caption: card.caption, cta: card.cta, theme: card.theme, brandColor: card.brandColor, photoStyle: card.photoStyle ?? "top", ratio: card.ratio ?? "1:1" });
    setHashtagsText(card.hashtags.join(" "));
    if (card.format !== "릴스") loadPhotos(id); // 카드뉴스·사진첨부형 모두 첨부 사진 지원
  }, [id, loadPhotos]);

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

  const save = useCallback(async () => {
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
          photoStyle: draft.photoStyle,
          ratio: draft.ratio,
          hashtags: hashtagsText.split(/[\s,]+/).map((h) => h.replace(/^#/, "")).filter(Boolean).map((h) => `#${h}`),
        },
      });
      setCard(card);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }, [draft, hashtagsText, id]);

  // 실시간 자동 저장 (디바운스)
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => void save(), 900);
    return () => clearTimeout(t);
  }, [dirty, save]);

  function patchDraft(p: Partial<NonNullable<typeof draft>>) {
    setDraft((d) => (d ? { ...d, ...p } : d));
    setDirty(true);
  }
  function patchPage(i: number, p: Partial<CardPage>) {
    setDraft((d) => (d ? { ...d, pages: d.pages.map((pg, idx) => (idx === i ? { ...pg, ...p } : pg)) } : d));
    setDirty(true);
  }

  async function uploadPhoto(page: number, file: File) {
    const url = await blobToDataUrl(file);
    setPhotos((p) => ({ ...p, [page]: url })); // 즉시 미리보기
    const fd = new FormData();
    fd.append("photo", file);
    await fetch(`/api/cards/${id}/photo/${page}`, { method: "PUT", body: fd });
  }
  async function removePhoto(page: number) {
    await api(`/api/cards/${id}/photo/${page}`, { method: "DELETE" });
    setPhotos((p) => {
      const n = { ...p };
      delete n[page];
      return n;
    });
  }

  // 스텝 '확인' — 편집→검수(검수 실행), 검수→업로드(승인 통과)
  async function confirmStep() {
    setStepMsg("");
    if (!card) return;
    if (step === 0) {
      setAdvancing(true);
      try {
        if (dirty) await save();
        const { card: c } = await api<{ card: CardNews }>(`/api/cards/${id}/review`, { method: "POST" });
        setCard(c);
        setStep(1);
      } finally {
        setAdvancing(false);
      }
    } else if (step === 1) {
      const gate = verdictGate(decideVerdict(card.reviewFlags), consent);
      if (!gate.ok) {
        setStepMsg(gate.reason ?? "검수 게이트를 통과하지 못했어요.");
        return;
      }
      setAdvancing(true);
      try {
        const { card: c } = await api<{ card: CardNews }>(`/api/cards/${id}/review`, { method: "PATCH", body: { action: "pass", consent } });
        setCard(c);
        setStep(2);
      } catch (e) {
        setStepMsg((e as Error).message);
      } finally {
        setAdvancing(false);
      }
    }
  }

  if (!card || !draft || !user) return <div className="py-20 text-center text-muted">불러오는 중…</div>;

  if (producing)
    return (
      <Card className="p-6">
        <Generating title="카드뉴스 본문을 쓰는 중…" messages={["주제를 풀어내는 중", "내 톤을 반영하는 중", "페이지 구성·후킹을 잡는 중", "캡션·해시태그를 고르는 중"]} />
      </Card>
    );

  const niche = user.survey?.niche ?? "";
  const reviewVerdict = decideVerdict(card.reviewFlags);
  const handle = activeIgHandle(user) ?? user.name;
  const activeAccount = findIgAccount(user);
  const isReels = card.format === "릴스";
  const isPlan = (card.status === "기획중" || card.status === "기획완료") && !isReels;
  const photo = card.format === "사진첨부형 카드뉴스";
  const stepperUI = !isPlan && !isReels;

  return (
    <div>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-5">
        <div className="flex-1 min-w-0">
          <button onClick={() => router.push("/app/board")} className="text-sm text-muted hover:text-ink transition">
            ← 콘텐츠 관리
          </button>
          {editingTitle ? (
            <textarea
              autoFocus
              rows={1}
              className="font-display text-2xl mt-1 w-full bg-transparent border-b border-line focus:border-ink outline-none resize-none overflow-hidden leading-snug block"
              value={draft.title}
              ref={(el) => { if (el) { el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; } }}
              onChange={(e) => patchDraft({ title: e.target.value })}
              onInput={(e) => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; }}
              onBlur={() => setEditingTitle(false)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); setEditingTitle(false); } }}
            />
          ) : (
            <div className="flex items-start gap-2 mt-1">
              <h1 className="font-display text-2xl min-w-0">
                {(() => { const tt = draft.title || "제목 없음"; return tt.length > 50 ? `${tt.slice(0, 50)}…` : tt; })()}
              </h1>
              <button onClick={() => setEditingTitle(true)} className="text-muted hover:text-ink shrink-0 mt-1.5" title="제목 수정" aria-label="제목 수정">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
              </button>
            </div>
          )}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <StatusBadge status={card.status} />
            <Badge tone={isReels ? "rose" : "muted"}>{isReels ? "릴스" : "게시물"}</Badge>
            {!isPlan && (card.aiEdited ? <Badge tone="teal">사용자 편집됨</Badge> : <Badge tone="muted">{card.aiLabel}</Badge>)}
            <Badge tone="muted">{card.generatedBy === "ai" ? "Claude" : card.generatedBy === "template" ? "템플릿" : "기획"}</Badge>
          </div>
        </div>
        {stepperUI && (
          <span className="text-xs text-muted">{saving ? "저장 중…" : dirty ? "수정 중…" : "자동 저장됨 ✓"}</span>
        )}
      </div>

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
            <Preview pages={draft.pages} theme={draft.theme} brandColor={draft.brandColor} photo={photo} photoStyle={draft.photoStyle} ratio={draft.ratio} photos={photos} niche={niche} handle={handle} active={activePage} />
          </div>
        </div>
      ) : (
        <>
          {/* 스텝: 1 편집 · 2 검수 · 3 업로드 (크게) */}
          <div className="flex items-center gap-2 sm:gap-3 mb-6">
            {STEPS.map((label, i) => {
              const cur = i === step;
              const reachable = i <= step;
              return (
                <div key={label} className="flex items-center gap-2 sm:gap-3">
                  <button
                    onClick={() => reachable && setStep(i as Step)}
                    disabled={!reachable}
                    className={`flex items-center gap-2.5 px-5 py-3 rounded-full text-base font-semibold transition ${cur ? "bg-ink text-paper shadow-sm" : reachable ? "bg-paper-2 text-ink hover:bg-paper-2/80" : "text-muted"}`}
                  >
                    <span className={`w-7 h-7 rounded-full grid place-items-center text-sm font-bold ${cur ? "bg-paper text-ink" : "bg-card border border-line"}`}>{i + 1}</span>
                    {label}
                  </button>
                  {i < 2 && <span className="w-8 sm:w-12 h-0.5 bg-line rounded-full" />}
                </div>
              );
            })}
          </div>

          {/* 테마 — 위에 전체폭 카드 (제목은 상단 헤딩에서 ✎로 수정) */}
          {step === 0 && (
            <Card className="p-5 mb-4">
              <Field label="테마">
                <div className="flex flex-wrap gap-2">
                  {THEMES.map((tm) => (
                    <button key={tm.key} onClick={() => patchDraft({ theme: tm.key })} className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm transition ${draft.theme === tm.key ? "border-coral" : "border-line hover:border-ink/30"}`}>
                      <span className="w-4 h-4 rounded-full border border-line" style={{ background: getTheme(tm.key).bg }} />
                      {tm.name}
                    </button>
                  ))}
                </div>
              </Field>
            </Card>
          )}

          {/* 왼쪽: 페이지 네비 + 미리보기 + 비율을 하나의 카드로 · 오른쪽: 텍스트/사진 편집 */}
          <div className="grid lg:grid-cols-[380px_1fr] gap-6 items-start">
            <div className="order-1">
              {step === 0 ? (
                <Card className="p-4">
                  {/* 페이지 네비 */}
                  <div className="text-xs text-muted mb-2">페이지 ({draft.pages.length}장) · 편집/미리보기 함께 이동</div>
                  <div className="flex gap-1.5 flex-wrap">
                    {draft.pages.map((_, i) => (
                      <button key={i} onClick={() => setActivePage(i)} className={`w-10 h-10 rounded-lg text-sm font-medium transition ${activePage === i ? "bg-ink text-paper" : "bg-paper-2 text-ink-soft hover:text-ink"}`}>
                        {i + 1}
                      </button>
                    ))}
                  </div>
                  {/* 미리보기 */}
                  <div className="border-t border-line mt-4 pt-4">
                    <Preview bare pages={draft.pages} theme={draft.theme} brandColor={draft.brandColor} photo={photo} photoStyle={draft.photoStyle} ratio={draft.ratio} photos={photos} niche={niche} handle={handle} active={activePage} />
                  </div>
                  {/* 비율 */}
                  <div className="border-t border-line mt-4 pt-4 flex items-center gap-3">
                    <span className="text-xs text-muted shrink-0">비율</span>
                    <div className="flex gap-2">
                      {([
                        ["1:1", "정사각", "1:1"],
                        ["3:4", "세로형", "3:4"],
                      ] as const).map(([val, label, sub]) => (
                        <button key={val} type="button" onClick={() => patchDraft({ ratio: val })} className={`px-3 py-1.5 rounded-full border text-sm transition ${draft.ratio === val ? "border-ink bg-paper-2/60" : "border-line hover:border-ink/30"}`}>
                          {label} <span className="text-muted">{sub}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </Card>
              ) : (
                <Preview pages={draft.pages} theme={draft.theme} brandColor={draft.brandColor} photo={photo} photoStyle={draft.photoStyle} ratio={draft.ratio} photos={photos} niche={niche} handle={handle} active={activePage} />
              )}
            </div>
            <div className="min-w-0 order-2">
              {step === 0 && (
                <EditLeft draft={draft} photo={photo} photos={photos} activePage={activePage} hashtagsText={hashtagsText} setHashtagsText={(v) => { setHashtagsText(v); setDirty(true); }} patchDraft={patchDraft} patchPage={patchPage} uploadPhoto={uploadPhoto} removePhoto={removePhoto} />
              )}
              {step === 1 && <ReviewTab card={card} dirty={dirty} onChange={setCard} onSaveNeeded={save} domain={user.survey?.sensitiveDomain} consent={consent} setConsent={setConsent} />}
              {step === 2 && <PublishTab card={card} draft={draft} photo={photo} photoStyle={draft.photoStyle} ratio={draft.ratio} photos={photos} niche={niche} handle={handle} account={activeAccount} publicBase={publicBase} reload={load} />}
            </div>
          </div>

          {/* 하단 확인 버튼 */}
          {step < 2 && (
            <div className="mt-6 flex items-center justify-end gap-3 flex-wrap">
              {stepMsg && <span className="text-sm text-coral mr-auto">{stepMsg}</span>}
              {step > 0 && <Button variant="ghost" onClick={() => setStep((step - 1) as Step)}>← 이전</Button>}
              <Button onClick={confirmStep} disabled={advancing || (step === 1 && reviewVerdict === "black")}>
                {advancing
                  ? "처리 중…"
                  : step === 0
                    ? "확인 — 검수로 →"
                    : reviewVerdict === "black"
                      ? "차단 — 발행 불가"
                      : reviewVerdict === "red"
                        ? "동의하고 업로드로 →"
                        : "확인 — 승인하고 업로드로 →"}
              </Button>
            </div>
          )}
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

// 우측: 1장 내용(헤드라인·본문·사진 업로드·사진 배치·사진 설명) + 캡션/해시태그/CTA
function EditLeft({ draft, photo, photos, activePage, hashtagsText, setHashtagsText, patchDraft, patchPage, uploadPhoto, removePhoto }: {
  draft: { title: string; pages: CardPage[]; caption: string; cta: string; theme: string; brandColor: string; photoStyle: "top" | "bg" };
  photo: boolean;
  photos: Record<number, string>;
  activePage: number;
  hashtagsText: string;
  setHashtagsText: (v: string) => void;
  patchDraft: (p: Partial<{ title: string; caption: string; cta: string; theme: string; brandColor: string; photoStyle: "top" | "bg" }>) => void;
  patchPage: (i: number, p: Partial<CardPage>) => void;
  uploadPhoto: (page: number, file: File) => Promise<void>;
  removePhoto: (page: number) => Promise<void>;
}) {
  const pg = draft.pages[activePage];
  const [uploadWarn, setUploadWarn] = useState("");
  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="text-sm font-medium mb-3">{activePage + 1}장 내용</div>
        {pg && (
          <div className="space-y-3">
            {/* 태그는 카드에서 제목 위에 붙으므로, 편집도 헤드라인 위에서 한다 */}
            <TagField pg={pg} activePage={activePage} patchPage={patchPage} />
            <Field label="헤드라인" hint="엔터로 줄바꿈하면 카드에도 그대로 적용돼요">
              <textarea className={inputClass} rows={2} value={pg.headline} onChange={(e) => patchPage(activePage, { headline: e.target.value })} />
            </Field>
            <Field label="본문">
              <textarea className={inputClass} rows={3} value={pg.body} onChange={(e) => patchPage(activePage, { body: e.target.value })} />
            </Field>

            {/* ── 장별 템플릿 (레이아웃) ── */}
            <Field label="템플릿" hint="이 장의 레이아웃">
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(TEMPLATE_LABELS) as CardTemplate[]).map((key) => {
                  const on = (pg.template ?? "cover") === key;
                  const meta = TEMPLATE_LABELS[key];
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => patchPage(activePage, { template: key })}
                      className={`text-left px-3 py-2 rounded-xl border text-sm transition ${on ? "border-ink bg-paper-2/60" : "border-line hover:border-ink/30"}`}
                    >
                      <div className="font-medium">{meta.name}</div>
                      <div className="text-[11px] text-muted mt-0.5 leading-tight">{meta.desc}</div>
                    </button>
                  );
                })}
              </div>
            </Field>

            {/* ── 장별 미디어 타입 — 영상 장은 캐러셀에서 VIDEO 로 발행된다 ── */}
            <Field label="미디어" hint="이 장에 들어갈 것">
              <div className="flex gap-2">
                {([
                  ["none", "없음", "텍스트만"],
                  ["photo", "사진", "IMAGE 로 발행"],
                  ["video", "영상", "VIDEO 로 발행"],
                ] as const).map(([val, label, desc]) => {
                  const cur = pg.mediaType ?? (photos[activePage] ? "photo" : "none");
                  const on = cur === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => patchPage(activePage, { mediaType: val })}
                      className={`flex-1 text-left px-3 py-2 rounded-xl border text-sm transition ${on ? "border-ink bg-paper-2/60" : "border-line hover:border-ink/30"}`}
                    >
                      <div className="font-medium">{label}</div>
                      <div className="text-[11px] text-muted mt-0.5">{desc}</div>
                    </button>
                  );
                })}
              </div>
            </Field>

            {/* ── 템플릿별 전용 입력 필드 ── */}
            <TemplateExtraFields pg={pg} activePage={activePage} patchPage={patchPage} />

            {(pg.mediaType ?? "none") === "video" && (
              <p className="text-xs text-amber flex items-start gap-1.5">
                <Icon name="info" size={15} className="shrink-0 mt-0.5" />
                <span>영상 장은 <b>카드 프레임 + 영상 합성(MP4)</b>이 필요해 발행 워커 가동 후 지원됩니다. 지금은 미리보기에 &lsquo;영상 자리&rsquo;로만 표시돼요.</span>
              </p>
            )}

            <Field label="사진 업로드" hint={photo ? "이 장의 메인 사진 (정사각/세로 권장)" : "이 장에 넣을 사진 (선택)"}>
              {photos[activePage] ? (
                <div className="flex items-center gap-3">
                  <DropZone accept="image/*" kind="image" onFile={(f) => { setUploadWarn(""); uploadPhoto(activePage, f); }} onReject={() => setUploadWarn("이미지 파일만 올릴 수 있어요")} clickable={false} className="rounded-lg" activeClassName="ring-2 ring-coral ring-offset-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photos[activePage]} alt="" className="w-20 h-20 rounded-lg object-cover border border-line block" />
                  </DropZone>
                  <label className="cursor-pointer text-sm text-coral hover:underline">
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(activePage, f); e.target.value = ""; }} />
                    교체
                  </label>
                  <button type="button" onClick={() => removePhoto(activePage)} className="text-sm text-muted hover:text-ink">삭제</button>
                </div>
              ) : (
                <DropZone accept="image/*" kind="image" onFile={(f) => { setUploadWarn(""); uploadPhoto(activePage, f); }} onReject={() => setUploadWarn("이미지 파일만 올릴 수 있어요")} className="flex items-center justify-center h-24 rounded-xl border-2 border-dashed border-line cursor-pointer text-sm text-muted text-center hover:border-ink/30">
                  + 사진을 끌어다 놓거나 클릭해 업로드
                </DropZone>
              )}
              {uploadWarn && <p className="mt-1 text-xs text-coral">{uploadWarn}</p>}
            </Field>
            {/* ── 장별 미디어 배치 — 반반(위 미디어/아래 글) vs 배경(꽉 채우고 DIM 위에 글) ── */}
            {(pg.mediaType ?? (photos[activePage] ? "photo" : "none")) !== "none" && (
              <Field label="미디어 배치" hint="이 장에만 적용돼요">
                <div className="flex gap-2">
                  {([
                    ["split", "반반", "위 미디어 · 아래 글"],
                    ["bg", "배경", "꽉 차게 · DIM 위에 글"],
                  ] as const).map(([val, label, desc]) => {
                    const cur = pg.mediaLayout ?? (draft.photoStyle === "bg" ? "bg" : "split");
                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() => patchPage(activePage, { mediaLayout: val })}
                        className={`flex-1 text-left px-3 py-2 rounded-xl border text-sm transition ${cur === val ? "border-ink bg-paper-2/60" : "border-line hover:border-ink/30"}`}
                      >
                        <div className="font-medium">{label}</div>
                        <div className="text-xs text-muted mt-0.5">{desc}</div>
                      </button>
                    );
                  })}
                </div>
              </Field>
            )}
            {photo && (
              <Field label="사진 설명(메모)" hint="선택 — 사진이 없을 때 안내 문구로 표시돼요">
                <input className={inputClass} value={pg.photoNote ?? ""} onChange={(e) => patchPage(activePage, { photoNote: e.target.value })} placeholder="예: 신메뉴 클로즈업" />
              </Field>
            )}
            {pg.note && (
              <p className="text-xs text-muted flex items-start gap-1.5">
                <Icon name="bulb" size={15} className="shrink-0 mt-0.5" />
                <span>{pg.note}</span>
              </p>
            )}
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

function ReviewTab({ card, dirty, onChange, onSaveNeeded, domain, consent, setConsent }: {
  card: CardNews;
  dirty: boolean;
  onChange: (c: CardNews) => void;
  onSaveNeeded: () => Promise<void>;
  domain?: SensitiveDomain;
  consent: boolean;
  setConsent: (v: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [showLegal, setShowLegal] = useState(false);
  const [showIso, setShowIso] = useState(false);

  const verdict = decideVerdict(card.reviewFlags);
  const meta = VERDICT_META[verdict];
  const issues = card.reviewFlags.filter((f) => !isChecklist(f));
  const checklist = card.reviewFlags.filter(isChecklist);
  const mustPass = issues.filter((f) => f.mustPass);
  const failCount = mustPass.filter((f) => f.level === "fail").length;
  const warnCount = mustPass.filter((f) => f.level === "warn").length;
  const passed = card.status === "제작완료" || card.status === "예약업로드" || card.status === "업로드완료";

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

  return (
    <div className="space-y-5">
      {/* 신호등 판정 헤더 */}
      <div className="border rounded-2xl p-5" style={{ background: meta.soft, borderColor: meta.color }}>
        <div className="flex items-start gap-3">
          <span className="text-2xl leading-none mt-0.5">{meta.emoji}</span>
          <div>
            <div className="font-semibold text-lg" style={{ color: meta.color }}>{meta.label}</div>
            <p className="text-sm text-ink-soft mt-1 max-w-xl">{meta.desc}</p>
            {domain && domain !== "없음" && (
              <div className="mt-2"><Badge tone="muted">검수 기준 · {domain}</Badge></div>
            )}
          </div>
        </div>
      </div>

      {/* 필수통과 2축 요약 */}
      <div className="grid grid-cols-2 gap-3">
        {(["규제 안전성", "사실 정확성"] as const).map((ax) => {
          const hit = mustPass.filter((f) => f.axis === ax);
          const fail = hit.some((f) => f.level === "fail");
          const warn = hit.some((f) => f.level === "warn");
          return (
            <Card key={ax} className="p-3 flex items-center justify-between gap-2">
              <span className="text-sm font-medium">🔒 {ax}</span>
              <Badge tone={fail ? "rose" : warn ? "amber" : "teal"}>{fail ? "차단" : warn ? "경고" : "이상 없음"}</Badge>
            </Card>
          );
        })}
      </div>

      {/* 자동 점검 + 재검수 */}
      <div className="flex items-center justify-between">
        <div className="text-sm">
          자동 점검: <span className="font-medium">{issues.length === 0 ? "감지된 항목 없음 ✓" : `${issues.length}건 감지`}</span>
        </div>
        <Button variant="outline" size="sm" onClick={runReview} disabled={busy}>
          {busy ? "점검 중…" : "검수 다시 실행"}
        </Button>
      </div>

      {/* 감지된 항목 */}
      {issues.length > 0 && (
        <div className="space-y-3">
          {issues.map((f) => (
            <Card key={f.id} className="p-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge tone={f.level === "fail" ? "rose" : f.mustPass ? "amber" : "muted"}>{f.axis ?? f.type}</Badge>
                {f.mustPass && <span className="text-xs text-muted">🔒 필수통과</span>}
                {f.excerpt && <span className="text-xs text-muted">“{f.excerpt}”</span>}
              </div>
              <p className="text-sm text-ink-soft mt-1.5">{f.message}</p>
            </Card>
          ))}
        </div>
      )}

      {/* ⚫ 차단 — 발행 불가 + 법적 근거 토글 (박스 바로 아래) */}
      {verdict === "black" && (
        <div className="border rounded-2xl p-5" style={{ background: VERDICT_META.black.soft, borderColor: VERDICT_META.black.color }}>
          <div className="flex items-start gap-3">
            <span className="w-7 h-7 rounded-full grid place-items-center text-white text-sm shrink-0" style={{ background: VERDICT_META.black.color }}>⚫</span>
            <div className="flex-1">
              <div className="font-medium">발행 불가 {failCount}건</div>
              <p className="text-sm text-ink-soft mt-1">법령 위반 소지가 뚜렷한 표현이 있어 이 콘텐츠는 발행할 수 없어요. 위 표현을 수정한 뒤 ‘검수 다시 실행’을 눌러주세요.</p>
              <button type="button" onClick={() => setShowLegal((v) => !v)} className="text-sm underline text-muted hover:text-ink mt-2">
                {showLegal ? "법적 근거 접기" : "법적 근거 보기"}
              </button>
              {showLegal && <p className="text-xs text-ink-soft mt-2 leading-relaxed">{LEGAL_BASIS_NOTE}</p>}
            </div>
          </div>
        </div>
      )}

      {/* 🔴 경고 — 책임 동의 후 발행 */}
      {verdict === "red" && (
        <div className="border rounded-2xl p-5" style={{ background: VERDICT_META.red.soft, borderColor: VERDICT_META.red.color }}>
          <div className="font-medium" style={{ color: VERDICT_META.red.color }}>🔴 경고 {warnCount}건 — 발행은 가능해요</div>
          <p className="text-sm text-ink-soft mt-1">
            규제·사실 관련 회색지대 표현이 있어요. 그래도 발행하려면, <b>우리가 이만큼 안내했음에도 발행하는 만큼 최종 책임은 본인에게 있음</b>에 동의해 주세요.
          </p>
          <label className="flex items-start gap-2 mt-3 text-sm">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[#e52364]" />
            <span>위 경고를 확인했고, 발행에 따른 최종 책임이 본인에게 있음에 동의합니다.</span>
          </label>
          <button type="button" onClick={() => setShowLegal((v) => !v)} className="text-sm underline text-muted hover:text-ink mt-2">
            {showLegal ? "법적 근거 접기" : "법적 근거 보기"}
          </button>
          {showLegal && <p className="text-xs text-ink-soft mt-2 leading-relaxed">{LEGAL_BASIS_NOTE}</p>}
        </div>
      )}

      {/* 확인 항목(체크리스트) */}
      {checklist.length > 0 && (
        <Card className="p-4">
          <div className="text-sm font-medium mb-2">확인 항목</div>
          <div className="space-y-2">
            {checklist.map((f) => (
              <label key={f.id} className={`flex items-start gap-2 text-sm ${f.resolved ? "opacity-60" : ""}`}>
                <input type="checkbox" checked={f.resolved} onChange={() => toggleFlag(f)} className="mt-0.5 w-4 h-4 accent-[#e52364]" />
                <span className="text-ink-soft">{f.message}</span>
              </label>
            ))}
          </div>
        </Card>
      )}

      {/* 승인 상태 */}
      <Card className="p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="font-medium">검수 통과 · 사용자 승인</div>
            <p className="text-sm text-ink-soft">
              {passed
                ? "이미 통과했어요."
                : verdict === "black"
                  ? "차단 항목을 수정해야 승인할 수 있어요."
                  : verdict === "red"
                    ? "책임 동의 체크 후 아래 ‘동의하고 업로드로’ 버튼으로 통과하세요."
                    : "아래 ‘승인하고 업로드로’ 버튼으로 통과하세요."}
            </p>
          </div>
          {passed ? <Badge tone="teal">✓ 통과됨</Badge> : <Badge tone={verdict === "black" ? "rose" : verdict === "red" ? "amber" : "teal"}>{meta.label}</Badge>}
        </div>
      </Card>

      {/* 신뢰 장치 (ISO 원칙) */}
      <div>
        <button type="button" onClick={() => setShowIso((v) => !v)} className="text-xs text-muted hover:text-ink">
          🛡 국제표준 원칙 기반 3단 점검 {showIso ? "▲" : "▼"}
        </button>
        {showIso && (
          <p className="text-xs text-ink-soft leading-relaxed mt-2">
            코드 규칙 → AI 자가점검(사실성·규제·톤·요청준수·완전성·형식·UX 7축) → 사람 승인의 3단 게이트로 검수해요.
            AI 관리·품질·위험 관련 국제표준(ISO/IEC 42001·25059·23894) 원칙을 참고했어요(인증은 아니에요).
          </p>
        )}
      </div>

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

/** 발행 완료 팝업 — 막다른 "업로드 완료" 화면에서 빠져나갈 출구. */
function PublishDoneModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  return (
    <Modal onClose={onClose}>
      <div className="text-center">
        <div className="text-4xl">🎉</div>
        <div className="font-display text-xl mt-2">발행 완료!</div>
        <p className="text-sm text-muted mt-1">발행을 누른 건 당신이에요. 다음 100명으로!</p>
      </div>
      <div className="mt-5 space-y-2">
        <Button className="w-full" onClick={() => router.push("/app/board")}>콘텐츠 관리로 가기</Button>
        <Button variant="ghost" className="w-full" onClick={onClose}>계속 보기</Button>
      </div>
    </Modal>
  );
}

function PublishTab({ card, draft, photo, photoStyle, ratio, photos, niche, handle, account, publicBase, reload }: {
  card: CardNews;
  draft: { pages: CardPage[]; theme: string; brandColor: string };
  photo: boolean;
  photoStyle: "top" | "bg";
  ratio: "1:1" | "3:4";
  photos: Record<number, string>;
  niche: string;
  handle: string;
  account?: IgAccount;
  publicBase: string | null;
  reload: () => Promise<void>;
}) {
  const exportH = ratio === "3:4" ? 1440 : 1080;
  const exportRef = useRef<HTMLDivElement>(null);
  const [exportIdx, setExportIdx] = useState<number | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [stage, setStage] = useState("");
  const [scheduleAt] = useState(""); // 예약 발행 미지원 — 항상 즉시 발행(추후 예약 기능 시 setter 복구)
  const [msg, setMsg] = useState("");
  const [showDone, setShowDone] = useState(false); // 발행 완료 팝업
  const router = useRouter();

  const ready = card.status === "제작완료";
  const done = card.status === "업로드완료";
  const reserved = card.status === "예약업로드";
  const live = account?.mode === "정식";

  async function renderPage(idx: number, kind: "png" | "jpeg"): Promise<string> {
    const lib = await import("html-to-image");
    setExportIdx(idx);
    await new Promise((r) => setTimeout(r, 140)); // 렌더 대기
    if (!exportRef.current) throw new Error("no node");
    return kind === "jpeg"
      ? lib.toJpeg(exportRef.current, { width: 1080, height: exportH, pixelRatio: 1, skipFonts: true, quality: 0.92 })
      : lib.toPng(exportRef.current, { width: 1080, height: exportH, pixelRatio: 1, skipFonts: true });
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
      if (immediate) setShowDone(true); // 즉시 발행 완료 → 나가기 팝업
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
            <CardCanvas page={draft.pages[exportIdx]} index={exportIdx} total={draft.pages.length} themeKey={draft.theme} brandColor={draft.brandColor} photo={photo} photoStyle={photoStyle} ratio={ratio} photoDataUrl={photos[exportIdx]} niche={niche} handle={handle} />
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
        <>
          {showDone && <PublishDoneModal onClose={() => setShowDone(false)} />}
          <Card className="p-6 bg-teal-soft/50 border-teal-soft text-center">
            <div className="font-display text-xl text-teal">업로드 완료 ✓</div>
            <p className="text-sm text-ink-soft mt-1">발행을 누른 건 당신이에요. 다음 100명으로!</p>
            <Button className="mt-4" onClick={() => router.push("/app/board")}>콘텐츠 관리로 가기</Button>
          </Card>
        </>
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
          <div className="grid sm:grid-cols-2 gap-3">
            <Button onClick={() => publish(true)} disabled={!ready || publishing || (live && !publicBase)}>
              {publishing ? stage || "발행 중…" : live ? "지금 인스타 발행" : "지금 발행"}
            </Button>
            <Button variant="outline" disabled title="예약 발행은 곧 지원돼요">
              예약 발행
            </Button>
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

function Preview({ pages, theme, brandColor, photo, photoStyle, ratio, photos, niche, handle, active, bare = false }: {
  pages: CardPage[];
  theme: string;
  brandColor: string;
  photo: boolean;
  photoStyle: "top" | "bg";
  ratio: "1:1" | "3:4";
  photos: Record<number, string>;
  niche: string;
  handle: string;
  active: number;
  bare?: boolean; // true면 Card 래퍼 없이 내용만 (상위 카드에 합쳐 쓸 때)
}) {
  const idx = Math.min(active, pages.length - 1);
  const page = pages[idx];
  const cardW = 1080;
  const cardH = ratio === "3:4" ? 1440 : 1080;
  const DISPLAY_W = 336; // 미리보기 패널(380px·p-4) 안에 들어오는 폭 → 넘침 방지
  const scale = DISPLAY_W / cardW;
  const inner = (
    <>
      <div className="text-xs text-muted mb-2">미리보기 · {ratio === "3:4" ? "세로 3:4" : "정사각 1:1"}</div>
      <div className="mx-auto rounded-xl overflow-hidden border border-line" style={{ width: DISPLAY_W, height: Math.round(cardH * scale) }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: cardW, height: cardH }}>
          {page && <CardCanvas page={page} index={idx} total={pages.length} themeKey={theme} brandColor={brandColor} photo={photo} photoStyle={photoStyle} ratio={ratio} photoDataUrl={photos[idx]} niche={niche} handle={handle} />}
        </div>
      </div>
    </>
  );
  return bare ? inner : <Card className="p-4">{inner}</Card>;
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
  const [scheduleAt] = useState(""); // 예약 발행 미지원 — 항상 즉시 발행(추후 예약 기능 시 setter 복구)
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [showDone, setShowDone] = useState(false); // 발행 완료 팝업
  const router = useRouter();
  const [consent, setConsent] = useState(false);
  const [showLegal, setShowLegal] = useState(false);

  const live = account?.mode === "정식";
  const verdict = decideVerdict(card.reviewFlags);
  const meta = VERDICT_META[verdict];
  const issues = card.reviewFlags.filter((f) => !isChecklist(f));
  const gate = verdictGate(verdict, consent);
  const hasVideo = !!card.hasVideo;
  const done = card.status === "업로드완료";
  const reserved = card.status === "예약업로드";
  const canPublishNow = gate.ok && hasVideo && !(live && !publicBase);

  async function runReview() {
    setBusy(true);
    if (dirty) await save();
    const { card: c } = await api<{ card: CardNews }>(`/api/cards/${card.id}/review`, { method: "POST" });
    onChange(c);
    setBusy(false);
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
      if (immediate) setShowDone(true); // 즉시 발행 완료 → 나가기 팝업
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
              {/* updatedAt 쿼리로 캐시 무효화 → 교체 시 새 영상이 바로 보이게 */}
              <DropZone accept="video/*" kind="video" onFile={uploadVideo} onReject={() => setMsg("영상 파일만 올릴 수 있어요")} clickable={false} className="rounded-xl overflow-hidden" activeClassName="ring-2 ring-coral">
                <video key={card.updatedAt} src={`/api/render-video/${card.id}?v=${card.updatedAt}`} controls className="w-full rounded-xl bg-ink/5 aspect-[9/16] object-contain block" />
              </DropZone>
              <div className="text-xs text-teal mt-2">업로드됨 ✓ · 새 영상을 끌어다 놓으면 교체돼요</div>
            </div>
          ) : (
            <DropZone accept="video/*" kind="video" onFile={uploadVideo} onReject={() => setMsg("영상 파일만 올릴 수 있어요")} className="aspect-[9/16] rounded-xl border-2 border-dashed border-line grid place-items-center text-center text-muted text-sm cursor-pointer hover:border-ink/30">
              <span>세로 영상 9:16<br />끌어다 놓거나 클릭</span>
            </DropZone>
          )}
          <label className="mt-3 block">
            <input type="file" accept="video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadVideo(f); e.target.value = ""; }} />
            <span className={`inline-flex w-full justify-center items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium cursor-pointer active:scale-[0.98] transition ${uploading ? "bg-paper-2 text-muted" : "bg-coral text-white hover:brightness-95"}`}>
              {uploading ? "업로드 중…" : hasVideo ? "영상 교체" : "영상 선택"}
            </span>
          </label>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="font-medium text-sm">검수 <span style={{ color: meta.color }}>· {meta.emoji} {meta.label}</span></div>
            <button onClick={runReview} disabled={busy} className="text-xs text-muted hover:text-ink">다시 검수</button>
          </div>
          {issues.length === 0 ? (
            <p className="text-xs text-muted">감지된 항목이 없어요.</p>
          ) : (
            <div className="space-y-1.5">
              {issues.map((f) => (
                <div key={f.id} className="text-xs text-ink-soft flex items-center gap-1.5 flex-wrap">
                  <Badge tone={f.level === "fail" ? "rose" : f.mustPass ? "amber" : "muted"}>{f.axis ?? f.type}</Badge>
                  <span>{f.message}</span>
                </div>
              ))}
            </div>
          )}
          {verdict === "black" && (
            <div className="mt-3 text-xs rounded-lg p-2.5" style={{ background: VERDICT_META.black.soft }}>
              ⚫ 법령 위반 소지가 뚜렷해 발행할 수 없어요.
              <button type="button" onClick={() => setShowLegal((v) => !v)} className="underline ml-1 text-muted hover:text-ink">{showLegal ? "접기" : "법적 근거"}</button>
              {showLegal && <p className="mt-1 leading-relaxed text-ink-soft">{LEGAL_BASIS_NOTE}</p>}
            </div>
          )}
          {verdict === "red" && (
            <label className="mt-3 flex items-start gap-2 text-xs rounded-lg p-2.5" style={{ background: VERDICT_META.red.soft }}>
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 w-3.5 h-3.5 accent-[#e52364]" />
              <span>🔴 경고 — 회색지대 표현이 있어요. 최종 책임이 본인에게 있음에 동의하고 발행합니다.</span>
            </label>
          )}
        </Card>

        {done ? (
          <>
            {showDone && <PublishDoneModal onClose={() => setShowDone(false)} />}
            <Card className="p-5 bg-teal-soft/50 border-teal-soft text-center">
              <div className="font-display text-lg text-teal">업로드 완료 ✓</div>
              <Button className="mt-3" onClick={() => router.push("/app/board")}>콘텐츠 관리로 가기</Button>
            </Card>
          </>
        ) : (
          <Card className="p-5 space-y-3">
            <div className="font-medium text-sm">발행 — 내가 누르는 발행</div>
            <p className="text-xs text-ink-soft">
              발행 대상: {account?.handle ? <b>@{account.handle}</b> : "미연동"}{" "}
              {live ? <Badge tone="teal">정식</Badge> : <Badge tone="amber">테스터</Badge>}
            </p>
            {live && !publicBase && <p className="text-xs text-coral">PUBLIC_BASE_URL 미설정 — 실제 발행 불가</p>}
            {!hasVideo && <p className="text-xs text-amber">영상을 먼저 업로드하세요.</p>}
            {!gate.ok && <p className="text-xs text-amber">{gate.reason}</p>}
            {reserved && <p className="text-xs text-ink-soft">예약됨 — 콘텐츠 관리에서 취소 가능.</p>}
            <Button className="w-full" onClick={() => publish(true)} disabled={!canPublishNow || publishing}>
              {publishing ? "발행 중…" : live ? "지금 인스타 발행" : "지금 발행"}
            </Button>
            <Button variant="outline" className="w-full" disabled title="예약 발행은 곧 지원돼요">
              예약 발행
            </Button>
          </Card>
        )}
        {msg && <p className="text-sm text-teal">{msg}</p>}
      </div>
    </div>
  );
}

// ── 템플릿별 전용 입력 필드 ────────────────────────────────────────────────
// 중첩 객체(compare/stat)는 patchPage 가 page 단위 얕은 병합이라, 기존 값을 먼저 스프레드해야 한다.
// 태그는 헤드라인·본문처럼 '전 템플릿 공통' 필드다. 자동 번호는 붙지 않는다 —
// "2"를 넣으면 번호 뱃지가, "AI"를 넣으면 AI 뱃지가 제목 위에 생긴다. 비우면 뱃지 없음.
// 카드에서 제목 위에 붙으므로 편집도 헤드라인 위에 둔다.
function TagField({
  pg,
  activePage,
  patchPage,
}: {
  pg: CardPage;
  activePage: number;
  patchPage: (i: number, p: Partial<CardPage>) => void;
}) {
  return (
    <Field label="태그" hint="제목 위 뱃지 · 비우면 표시 안 됨">
      <input
        className={inputClass}
        value={pg.tag ?? ""}
        onChange={(e) => patchPage(activePage, { tag: e.target.value })}
        placeholder="예: 2 · AI · 0-1,000 팔로워"
      />
    </Field>
  );
}

// 템플릿별 전용 입력(항목·비교·통계·CTA). 표지형/인용형은 태그 말고 추가 필드가 없다.
function TemplateExtraFields({
  pg,
  activePage,
  patchPage,
}: {
  pg: CardPage;
  activePage: number;
  patchPage: (i: number, p: Partial<CardPage>) => void;
}) {
  const tpl = pg.template ?? "cover";

  if (tpl === "list") {
    const items = pg.items ?? [];
    const setItems = (next: string[]) => patchPage(activePage, { items: next });
    return (
      <Field label="항목" hint="최대 5개 · 번호는 자동으로 붙어요">
        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={i} className="flex gap-2">
              <span className="w-7 h-9 grid place-items-center text-sm text-muted shrink-0">{i + 1}</span>
              <input
                className={inputClass}
                value={it}
                placeholder="예: 무드등 — 밤 분위기 담당"
                onChange={(e) => setItems(items.map((x, idx) => (idx === i ? e.target.value : x)))}
              />
              <button type="button" onClick={() => setItems(items.filter((_, idx) => idx !== i))} className="text-sm text-muted hover:text-coral px-2 shrink-0">
                삭제
              </button>
            </div>
          ))}
          {items.length < 5 && (
            <button type="button" onClick={() => setItems([...items, ""])} className="text-sm text-coral hover:underline">
              + 항목 추가
            </button>
          )}
        </div>
      </Field>
    );
  }

  if (tpl === "compare") {
    const c = pg.compare ?? { leftLabel: "BEFORE", left: "", rightLabel: "AFTER", right: "" };
    const set = (p: Partial<typeof c>) => patchPage(activePage, { compare: { ...c, ...p } });
    return (
      <Field label="비교 내용" hint="좌/우 대비 (Before → After)">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <input className={inputClass} value={c.leftLabel} onChange={(e) => set({ leftLabel: e.target.value })} placeholder="BEFORE" />
            <textarea className={inputClass} rows={3} value={c.left} onChange={(e) => set({ left: e.target.value })} placeholder="이전 상태" />
          </div>
          <div className="space-y-2">
            <input className={inputClass} value={c.rightLabel} onChange={(e) => set({ rightLabel: e.target.value })} placeholder="AFTER" />
            <textarea className={inputClass} rows={3} value={c.right} onChange={(e) => set({ right: e.target.value })} placeholder="이후 상태" />
          </div>
        </div>
      </Field>
    );
  }

  if (tpl === "stat") {
    const s = pg.stat ?? { value: "" };
    return (
      <Field label="강조 숫자" hint="크게 강조돼요 · 설명은 위 '본문'에 쓰면 숫자 아래에 나와요">
        <input
          className={inputClass}
          value={s.value ?? ""}
          onChange={(e) => patchPage(activePage, { stat: { ...s, value: e.target.value } })}
          placeholder="예: 45% · 3배 · 1위"
        />
      </Field>
    );
  }

  if (tpl === "cta") {
    return (
      <Field label="CTA 문구" hint="알약 버튼처럼 표시돼요">
        <input
          className={inputClass}
          value={pg.ctaLabel ?? ""}
          onChange={(e) => patchPage(activePage, { ctaLabel: e.target.value })}
          placeholder="저장하고 다시 보기 🔖"
        />
      </Field>
    );
  }

  return null; // cover / quote 는 헤드라인·본문만 사용
}
