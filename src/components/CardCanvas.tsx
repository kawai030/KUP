import type { CardPage } from "@/lib/types";

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

export const THEMES: CardTheme[] = [
  { key: "cream", name: "크림", bg: "#f6f3ec", fg: "#1b1a17", sub: "#6f6a5e", accent: "#ef5a35", chip: "#1b1a17", chipFg: "#f6f3ec" },
  { key: "ink", name: "잉크", bg: "#1b1a17", fg: "#f6f3ec", sub: "#b6b1a4", accent: "#ef8a35", chip: "#ef5a35", chipFg: "#ffffff" },
  { key: "coral", name: "코랄", bg: "#ef5a35", fg: "#fff7f3", sub: "#ffd9cb", accent: "#1b1a17", chip: "#1b1a17", chipFg: "#fff7f3" },
  { key: "teal", name: "딥그린", bg: "#1f6f63", fg: "#f2f8f5", sub: "#bcd9d0", accent: "#f3c14b", chip: "#f3c14b", chipFg: "#143f38" },
  { key: "sand", name: "샌드", bg: "#e9ddc7", fg: "#3a2f1d", sub: "#8a7a5c", accent: "#b23a6b", chip: "#3a2f1d", chipFg: "#e9ddc7" },
];

export function getTheme(key: string): CardTheme {
  return THEMES.find((t) => t.key === key) ?? THEMES[0];
}

// hex(#rgb/#rrggbb) → rgba 문자열 (인포그래픽 틴트용, 3자리도 허용)
function tint(hex: string, a: number): string {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex ?? "");
  if (!m) return `rgba(120,120,120,${a})`;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

export function CardCanvas({
  page,
  index,
  total,
  themeKey,
  niche,
  handle,
  brandColor,
  photo = false,
  photoDataUrl,
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
}) {
  const t = getTheme(themeKey);
  const accent = brandColor || t.accent;
  const isFirst = index === 0;
  const hasPhoto = Boolean(photoDataUrl);
  const showVisual = hasPhoto || photo; // 사진첨부형이거나 사진이 올라간 카드 → 비주얼 영역

  // 사진이 없을 때: 대시 박스 대신 인포그래픽 비주얼(브랜드 컬러 기반)
  const Infographic = (
    <div
      style={{
        flex: 1,
        borderRadius: 32,
        background: `linear-gradient(135deg, ${tint(accent, 0.16)}, ${tint(accent, 0.04)})`,
        border: `2px solid ${tint(accent, 0.22)}`,
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
      <div style={{ position: "absolute", top: -60, right: -60, width: 240, height: 240, borderRadius: 999, background: tint(accent, 0.14) }} />
      <div style={{ position: "absolute", bottom: -50, left: -50, width: 180, height: 180, borderRadius: 999, background: tint(accent, 0.1) }} />
      {/* 미니 바차트 느낌의 인포그래픽 */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 20, height: 200, position: "relative" }}>
        {[0.42, 0.66, 0.52, 1, 0.78].map((h, i) => (
          <div key={i} style={{ width: 50, height: Math.round(200 * h), borderRadius: 14, background: i === 3 ? accent : tint(accent, 0.5) }} />
        ))}
      </div>
      <div style={{ fontSize: 36, fontWeight: 600, color: t.sub, textAlign: "center", wordBreak: "keep-all", position: "relative" }}>
        {page.photoNote || "사진을 올리면 여기에 표시돼요 · 비우면 인포그래픽"}
      </div>
    </div>
  );

  return (
    <div
      style={{
        width: 1080,
        height: 1080,
        background: t.bg,
        color: t.fg,
        position: "relative",
        padding: 84,
        display: "flex",
        flexDirection: "column",
        gap: 36,
        fontFamily: 'ui-sans-serif, system-ui, "Apple SD Gothic Neo", "Pretendard", "Malgun Gothic", sans-serif',
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

      {/* 텍스트: 비주얼이 있으면 아래에, 없으면 가운데 크게 */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: showVisual ? 18 : 28,
          ...(showVisual ? {} : { flex: 1, justifyContent: "center" }),
        }}
      >
        <div style={{ fontFamily: '"Fraunces", Georgia, serif', fontSize: showVisual ? (isFirst ? 60 : 52) : isFirst ? 92 : 64, lineHeight: 1.14, fontWeight: 600, color: t.fg, wordBreak: "keep-all" }}>
          {page.headline}
        </div>
        {page.body && (
          <div style={{ fontSize: showVisual ? 34 : 40, lineHeight: 1.5, color: t.sub, whiteSpace: "pre-wrap", wordBreak: "keep-all" }}>{page.body}</div>
        )}
      </div>

      {/* 아이디 — 우측 하단, 브랜드 컬러 */}
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
        <div style={{ fontSize: 30, fontWeight: 700, color: accent, letterSpacing: -0.5 }}>@{handle || "myaccount"}</div>
      </div>
    </div>
  );
}
