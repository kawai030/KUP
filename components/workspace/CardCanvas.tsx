import { Icon } from "@/components/ui/icon";
import type { CardPage, CardTemplate } from "@/lib/workspace/types";

// 카드뉴스 1장을 1080×1080 정사각형으로 렌더. 미리보기/PNG 내보내기 공용.
// 부모가 transform: scale 로 축소해 보여준다.

export interface CardTheme {
  key: string;
  name: string;
  bg: string;
  fg: string;
  sub: string;
  accent: string;
  chip: string;
  chipFg: string;
}

// 카드 테마 — KUP 디자인 시스템 팔레트. key는 유지(기존 카드 호환), 값만 교체.
export const THEMES: CardTheme[] = [
  { key: "cream", name: "화이트", bg: "#ffffff", fg: "#191f28", sub: "#8b95a1", accent: "#e52364", chip: "#191f28", chipFg: "#ffffff" },
  { key: "ink", name: "잉크", bg: "#191f28", fg: "#f9fafb", sub: "#8b95a1", accent: "#e9497e", chip: "#e52364", chipFg: "#ffffff" },
  { key: "coral", name: "KUP 핑크", bg: "#e52364", fg: "#ffffff", sub: "#fad1df", accent: "#ffffff", chip: "#ffffff", chipFg: "#920736" },
  { key: "teal", name: "라이트그레이", bg: "#f2f4f6", fg: "#191f28", sub: "#6b7684", accent: "#e52364", chip: "#191f28", chipFg: "#f2f4f6" },
  { key: "sand", name: "라이트핑크", bg: "#fef6f9", fg: "#191f28", sub: "#4e5968", accent: "#920736", chip: "#920736", chipFg: "#ffffff" },
];

export function getTheme(key: string): CardTheme {
  return THEMES.find((t) => t.key === key) ?? THEMES[0]!;
}

// 카드 본문/제목 공통 폰트 — 고딕체(산세리프)
const GOTHIC = '"Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", ui-sans-serif, system-ui, sans-serif';

// hex(#rgb/#rrggbb) → rgba 문자열 (인포그래픽 틴트용, 3자리도 허용)
function tint(hex: string, a: number): string {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex ?? "");
  if (!m) return `rgba(120,120,120,${a})`;
  let h = m[1]!;
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

export function CardCanvas({
  page,
  index,
  themeKey,
  handle,
  photo = false,
  photoDataUrl,
  photoStyle = "top",
  ratio = "1:1",
}: {
  page: CardPage;
  index: number;
  total: number;
  themeKey: string;
  niche: string;
  handle: string;
  brandColor?: string;
  photo?: boolean;
  photoDataUrl?: string;
  photoStyle?: "top" | "bg";
  ratio?: "1:1" | "3:4";
}) {
  const t = getTheme(themeKey);
  const isFirst = index === 0;
  const hasPhoto = Boolean(photoDataUrl);
  const showVisual = hasPhoto || photo; // 사진첨부형이거나 사진이 올라간 카드 → 비주얼 영역
  const W = 1080;
  const H = ratio === "3:4" ? 1440 : 1080; // 세로 3:4 또는 정사각

  // 모드 2: 사진을 배경 풀블리드로 깔고 DIM 블랙 → 텍스트는 위에, 사진은 은은하게
  // ⚠️ 템플릿이 지정된 장은 템플릿 레이아웃이 우선한다 — 그렇지 않으면 '템플릿을 골랐는데 안 바뀐다'가 된다.
  // legacy(템플릿 없는) 장은 장별 mediaLayout 이 우선, 없으면 카드 photoStyle 을 따른다 → '미디어 배치' 토글이 legacy 에도 먹힌다.
  const legacyBg = (page.mediaLayout ?? photoStyle) === "bg";
  if (legacyBg && photoDataUrl && !page.template) {
    return (
      <div
        style={{
          width: W,
          height: H,
          position: "relative",
          overflow: "hidden",
          background: "#111",
          fontFamily: GOTHIC,
          boxSizing: "border-box",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photoDataUrl} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        {/* DIM: 위는 살짝, 아래로 갈수록 진하게(텍스트 가독성) */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.30) 0%, rgba(0,0,0,0.40) 45%, rgba(0,0,0,0.78) 100%)" }} />
        <div style={{ position: "absolute", inset: 0, padding: 72, display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 26 }}>
          <div style={{ fontFamily: GOTHIC, fontSize: isFirst ? 88 : 68, lineHeight: 1.18, fontWeight: 800, color: "#ffffff", wordBreak: "keep-all", whiteSpace: "pre-wrap", textShadow: "0 2px 24px rgba(0,0,0,0.45)" }}>
            {page.headline}
          </div>
          {page.body && (
            <div style={{ fontSize: 40, lineHeight: 1.5, color: "rgba(255,255,255,0.92)", whiteSpace: "pre-wrap", wordBreak: "keep-all", textShadow: "0 2px 18px rgba(0,0,0,0.45)" }}>{page.body}</div>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
            <div style={{ fontSize: 30, fontWeight: 700, color: "rgba(255,255,255,0.92)", letterSpacing: -0.5, textShadow: "0 2px 14px rgba(0,0,0,0.5)" }}>@{handle || "myaccount"}</div>
          </div>
        </div>
      </div>
    );
  }

  // 사진이 없을 때: 대시 박스 대신 인포그래픽 비주얼(테마 톤 기반, 브랜드 컬러 미사용)
  const Infographic = (
    <div
      style={{
        flex: 1,
        borderRadius: 32,
        background: `linear-gradient(135deg, ${tint(t.sub, 0.16)}, ${tint(t.sub, 0.05)})`,
        border: `2px solid ${tint(t.sub, 0.22)}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 40,
        padding: 64,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", top: -60, right: -60, width: 240, height: 240, borderRadius: 999, background: tint(t.sub, 0.12) }} />
      <div style={{ position: "absolute", bottom: -50, left: -50, width: 180, height: 180, borderRadius: 999, background: tint(t.sub, 0.08) }} />
      {/* 미니 바차트 느낌의 인포그래픽 */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 20, height: 200, position: "relative" }}>
        {[0.42, 0.66, 0.52, 1, 0.78].map((h, i) => (
          <div key={i} style={{ width: 50, height: Math.round(200 * h), borderRadius: 14, background: i === 3 ? t.fg : tint(t.sub, 0.45) }} />
        ))}
      </div>
      <div style={{ fontSize: 36, fontWeight: 600, color: t.sub, textAlign: "center", wordBreak: "keep-all", position: "relative" }}>
        {page.photoNote || "사진을 올리면 여기에 표시돼요 · 비우면 인포그래픽"}
      </div>
    </div>
  );

  // ── 템플릿 렌더 (지정된 경우) ───────────────────────────────────────────
  // 레퍼런스 문법: [미디어 영역] + [태그 뱃지 · 큰 제목 · 본문]. 텍스트 영역만 템플릿별로 달라진다.
  if (page.template) {
    return (
      <TemplateCanvas
        page={page}
        t={t}
        W={W}
        H={H}
        handle={handle}
        photoDataUrl={photoDataUrl}
        photoStyle={photoStyle}
      />
    );
  }

  return (
    <div
      style={{
        width: W,
        height: H,
        background: t.bg,
        color: t.fg,
        position: "relative",
        padding: "18px 18px 32px 18px", // 사진(비주얼)은 near-full-bleed 유지(18px)
        display: "flex",
        flexDirection: "column",
        gap: 32, // 사진↔텍스트 세로 여백 ≥32px
        fontFamily: GOTHIC,
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      {/* 비주얼(사진/인포그래픽) — 크게 */}
      {showVisual &&
        (photoDataUrl ? (
          <div style={{ flex: 1, borderRadius: 32, overflow: "hidden", display: "flex" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoDataUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </div>
        ) : (
          Infographic
        ))}

      {/* 텍스트: 비주얼이 있으면 아래에, 없으면 가운데 크게.
          글씨 좌우 여백 72px(외곽18 + 내부54) — 배경사진 모드(padding 72)와 동일 */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: showVisual ? 18 : 28,
          paddingLeft: 54,
          paddingRight: 54,
          ...(showVisual ? {} : { flex: 1, justifyContent: "center" }),
        }}
      >
        <div style={{ fontFamily: GOTHIC, fontSize: showVisual ? (isFirst ? 60 : 52) : isFirst ? 92 : 64, lineHeight: 1.2, fontWeight: 800, color: t.fg, wordBreak: "keep-all", whiteSpace: "pre-wrap" }}>
          {page.headline}
        </div>
        {page.body && (
          <div style={{ fontSize: showVisual ? 34 : 40, lineHeight: 1.5, color: t.sub, whiteSpace: "pre-wrap", wordBreak: "keep-all" }}>{page.body}</div>
        )}
      </div>

      {/* 아이디 — 우측 하단 (테마 기본색, 글씨 여백 72px = 텍스트와 동일) */}
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", paddingRight: 54 }}>
        <div style={{ fontSize: 30, fontWeight: 700, color: t.fg, letterSpacing: -0.5 }}>@{handle || "myaccount"}</div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
//  템플릿 캔버스 — 6종 (표지·리스트·비교·인용·통계·CTA)
//  공통 문법(레퍼런스): 상단 미디어 영역 + 하단 [번호 뱃지 · 큰 제목 · 본문]
//  · mediaType 'video' 는 여기선 '영상 자리'로 그리고, 발행 시 ffmpeg 로 실제 MP4 합성.
// ══════════════════════════════════════════════════════════════════════════

export const TEMPLATE_LABELS: Record<CardTemplate, { name: string; desc: string }> = {
  cover: { name: "표지형", desc: "큰 제목 + 여백 · 후킹용(1장)" },
  list: { name: "리스트형", desc: "번호 매긴 항목 나열" },
  compare: { name: "비교형", desc: "Before / After 대비" },
  quote: { name: "인용형", desc: "큰 따옴표 · 한 문장 강조" },
  stat: { name: "강조형", desc: "큰 숫자 강조" },
  cta: { name: "CTA형", desc: "마무리 · 저장/댓글 유도" },
};

function TemplateCanvas({
  page, t: theme, W, H, handle, photoDataUrl, photoStyle = "top",
}: {
  page: CardPage; t: CardTheme; W: number; H: number;
  handle: string; photoDataUrl?: string; photoStyle?: "top" | "bg";
}) {
  const tpl = page.template ?? "cover";
  const media = page.mediaType ?? (photoDataUrl ? "photo" : "none");
  const PAD = 72;                       // 텍스트 좌우 여백
  const hasMedia = media !== "none";

  // 미디어 배치: 장별 mediaLayout 이 우선, 없으면 카드 전체 설정(photoStyle) 을 따른다(기존 카드 호환).
  //  split = 반반(위 미디어 / 아래 글)  ·  bg = 미디어 풀블리드 + DIM 위에 글
  const layout = page.mediaLayout ?? (photoStyle === "bg" ? "bg" : "split");
  const bgMode = hasMedia && layout === "bg";

  // 배경 모드에선 사진 위(DIM)에 글이 얹히므로 테마 색 대신 흰 글씨 팔레트로 통일한다(가독성).
  // accent 도 바꿔야 한다 — 안 바꾸면 어두운 테마(sand=#920736 등)의 accent 글자가 DIM 위에서 안 보인다.
  // accent=흰색 + chipFg=잉크 → 태그칩·인용부호·통계숫자는 흰색, CTA 알약/리스트 번호는 '흰 배경+어두운 글씨'로 항상 읽힌다.
  const t: CardTheme = bgMode
    ? { ...theme, bg: "#111111", fg: "#ffffff", sub: "#e5e8eb", accent: "#ffffff", chip: "#ffffff", chipFg: "#191f28" }
    : theme;

  // 표지형은 미디어를 크게, 나머지는 절반 정도 — 레퍼런스와 동일한 비중
  const mediaH = !hasMedia ? 0 : tpl === "cover" ? Math.round(H * 0.52) : Math.round(H * 0.42);

  // ── 미디어 영역 (사진 / 영상 자리) — split 모드 전용 ──
  const Media = !hasMedia || bgMode ? null : (
    <div style={{ height: mediaH, position: "relative", overflow: "hidden", background: tint(t.sub, 0.12), display: "flex", flexShrink: 0 }}>
      {photoDataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoDataUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      ) : (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20 }}>
          <div style={{ color: t.sub, display: "flex" }}>
            <Icon name={media === "video" ? "video" : "image"} size={72} />
          </div>
          <div style={{ fontSize: 30, fontWeight: 600, color: t.sub }}>
            {media === "video" ? "영상이 들어갈 자리" : "사진이 들어갈 자리"}
          </div>
        </div>
      )}
      {/* 영상 장 표식 — 실제 발행 시 재생되는 장 */}
      {media === "video" && photoDataUrl && (
        <div style={{ position: "absolute", right: 28, bottom: 28, width: 76, height: 76, borderRadius: 999, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ color: "#fff", display: "flex", marginLeft: 4 }}><Icon name="play" size={32} /></div>
        </div>
      )}
    </div>
  );

  // ── 태그 뱃지 — 전 템플릿 공통. 제목 위에 붙는다.
  // 자동 번호는 넣지 않는다: 사용자가 태그에 "1"을 넣으면 번호 뱃지가 되고, "AI"를 넣으면 AI 뱃지가 된다.
  // 비어 있으면 아예 렌더하지 않는다(뱃지 없는 장).
  const tagText = page.tag?.trim() ?? "";
  const numeric = /^\d{1,2}$/.test(tagText); // 숫자 태그는 정사각 뱃지, 그 외는 알약 칩
  // 화이트(cream)·블랙(ink) 테마에선 태그를 핑크(accent) 대신 글자색(fg)으로 → 타이틀·태그 모노톤 통일.
  const tagColor = t.key === "cream" || t.key === "ink" ? t.fg : t.accent;
  const Tag = tagText ? (
    <div
      style={{
        alignSelf: "flex-start",
        background: tint(tagColor, 0.14),
        color: tagColor,
        borderRadius: numeric ? 12 : 999,
        padding: numeric ? "0" : "12px 26px",
        ...(numeric ? { width: 56, height: 56, display: "flex", alignItems: "center", justifyContent: "center" } : {}),
        fontSize: numeric ? 32 : 28,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {tagText}
    </div>
  ) : null;

  const Headline = (size: number) => (
    <div style={{ fontSize: size, lineHeight: 1.2, fontWeight: 800, color: t.fg, wordBreak: "keep-all", whiteSpace: "pre-wrap", letterSpacing: -1 }}>
      {page.headline}
    </div>
  );
  // 미디어가 있으면 글 넣을 공간이 좁다 → 크게. 텍스트 전용 카드는 원래 크기가 더 낫다(과대 방지).
  const fs = (withMedia: number, textOnly: number) => (hasMedia ? withMedia : textOnly);
  const Body = (size = fs(41, 34)) =>
    page.body ? (
      <div style={{ fontSize: size, lineHeight: 1.55, color: t.sub, whiteSpace: "pre-wrap", wordBreak: "keep-all" }}>{page.body}</div>
    ) : null;

  // ── 템플릿별 텍스트 영역 ──
  let content: React.ReactNode;
  switch (tpl) {
    case "list": {
      // 본문은 그냥 본문(번호 없음). 번호는 '항목(items)'에만 붙는다.
      const items = page.items?.filter((s) => s.trim()) ?? [];
      content = (
        <>
          {Tag}
          {Headline(fs(70, 76))}
          {Body()}
          {items.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 6 }}>
              {items.slice(0, 5).map((it, i) => (
                <div key={i} style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
                  <div style={{ width: 46, height: 46, borderRadius: 999, background: t.accent, color: t.chipFg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 700, flexShrink: 0, marginTop: 4 }}>{i + 1}</div>
                  <div style={{ fontSize: fs(41, 34), lineHeight: 1.45, color: t.fg, wordBreak: "keep-all" }}>{it}</div>
                </div>
              ))}
            </div>
          )}
        </>
      );
      break;
    }
    case "compare": {
      const c = page.compare ?? { leftLabel: "BEFORE", left: "", rightLabel: "AFTER", right: "" };
      const Col = (label: string, text: string, accent: boolean) => (
        <div style={{ flex: 1, background: accent ? tint(t.accent, 0.14) : tint(t.sub, 0.1), borderRadius: 24, padding: 32, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: fs(28, 24), fontWeight: 800, letterSpacing: 1, color: accent ? t.accent : t.sub }}>{label}</div>
          <div style={{ fontSize: fs(38, 32), lineHeight: 1.45, color: t.fg, wordBreak: "keep-all" }}>{text}</div>
        </div>
      );
      content = (
        <>
          {Tag}
          {Headline(fs(65, 68))}
          <div style={{ display: "flex", gap: 20, marginTop: 8 }}>
            {Col(c.leftLabel, c.left, false)}
            {Col(c.rightLabel, c.right, true)}
          </div>
        </>
      );
      break;
    }
    case "quote":
      content = (
        <>
          {Tag}
          <div style={{ fontSize: fs(130, 110), lineHeight: 0.9, fontWeight: 800, color: t.accent }}>&ldquo;</div>
          <div style={{ fontSize: fs(67, 72), lineHeight: 1.35, fontWeight: 700, color: t.fg, wordBreak: "keep-all", whiteSpace: "pre-wrap" }}>
            {page.headline}
          </div>
          {page.body && <div style={{ fontSize: fs(36, 30), color: t.sub, marginTop: 6 }}>— {page.body}</div>}
        </>
      );
      break;
    case "stat": {
      // 강조형: 큰 숫자(value) + 헤드라인 + 본문(공통 body). 단위·캡션 필드는 없앰(숫자에 %까지 함께 적음).
      const s = page.stat ?? { value: "" };
      content = (
        <>
          {Tag}
          <div style={{ fontSize: fs(180, 180), lineHeight: 1, fontWeight: 800, color: t.accent, letterSpacing: -4 }}>{s.value}</div>
          {Headline(fs(55, 56))}
          {Body(fs(36, 34))}
        </>
      );
      break;
    }
    case "cta":
      content = (
        <>
          {Tag}
          {Headline(fs(72, 80))}
          {Body()}
          <div style={{ marginTop: 10, alignSelf: "flex-start", background: t.accent, color: t.chipFg, borderRadius: 999, padding: "24px 50px", fontSize: fs(41, 34), fontWeight: 700 }}>
            {page.ctaLabel || "저장하고 다시 보기 🔖"}
          </div>
        </>
      );
      break;
    case "cover":
    default:
      content = (
        <>
          {Tag}
          {Headline(fs(82, 92))}
          {Body(fs(41, 40))}
        </>
      );
  }

  const Handle = (
    <div style={{ display: "flex", justifyContent: "flex-end", padding: `0 ${PAD}px 44px` }}>
      <div style={{ fontSize: 28, fontWeight: 700, color: t.sub }}>@{handle || "myaccount"}</div>
    </div>
  );

  // ── 배경 모드: 미디어를 카드 전체에 깔고 DIM 위에 템플릿 텍스트를 얹는다 ──
  if (bgMode) {
    return (
      <div style={{ width: W, height: H, background: t.bg, color: t.fg, fontFamily: GOTHIC, position: "relative", overflow: "hidden", boxSizing: "border-box" }}>
        {photoDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoDataUrl} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, background: "#2b2f36" }}>
            <div style={{ color: "#9aa3ad", display: "flex" }}>
              <Icon name={media === "video" ? "video" : "image"} size={96} />
            </div>
            <div style={{ fontSize: 32, fontWeight: 600, color: "#9aa3ad" }}>
              {media === "video" ? "영상이 배경으로 깔려요" : "사진이 배경으로 깔려요"}
            </div>
          </div>
        )}
        {/* DIM — 아래로 갈수록 진하게(글씨 가독성) */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.30) 0%, rgba(0,0,0,0.42) 45%, rgba(0,0,0,0.80) 100%)" }} />
        {media === "video" && photoDataUrl && (
          <div style={{ position: "absolute", right: 44, top: 44, width: 76, height: 76, borderRadius: 999, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ color: "#fff", display: "flex", marginLeft: 4 }}><Icon name="play" size={32} /></div>
          </div>
        )}
        {/* 내용은 아래 정렬(marginTop:auto). 단, 내용이 카드보다 크면 auto 가 0이 되어 위(태그·제목)부터 채우고
            넘치는 아래쪽만 잘린다 → 가장 중요한 헤드라인이 살아남는다(flex-end 는 반대로 위를 자른다). */}
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 20, padding: `0 ${PAD}px 28px` }}>{content}</div>
          {Handle}
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: W, height: H, background: t.bg, color: t.fg, fontFamily: GOTHIC, display: "flex", flexDirection: "column", overflow: "hidden", boxSizing: "border-box" }}>
      {Media}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 20, padding: `${hasMedia ? 56 : 0}px ${PAD}px 0` }}>
        {content}
      </div>
      {Handle}
    </div>
  );
}
