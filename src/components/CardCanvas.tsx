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

export function CardCanvas({
  page,
  index,
  total,
  themeKey,
  niche,
  handle,
  brandColor,
  photo = false,
}: {
  page: CardPage;
  index: number;
  total: number;
  themeKey: string;
  niche: string;
  handle: string;
  brandColor?: string;
  photo?: boolean;
}) {
  const t = getTheme(themeKey);
  const accent = brandColor || t.accent;
  const isFirst = index === 0;
  const isLast = index === total - 1;

  const Header = (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div style={{ fontSize: 30, fontWeight: 700, color: t.fg, letterSpacing: -0.5 }}>@{handle || "myaccount"}</div>
      <div style={{ fontSize: 26, fontWeight: 600, background: t.chip, color: t.chipFg, borderRadius: 999, padding: "10px 22px" }}>
        {index + 1} / {total}
      </div>
    </div>
  );

  const Dots = (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div style={{ display: "flex", gap: 10 }}>
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            style={{ width: i === index ? 36 : 12, height: 12, borderRadius: 999, background: i === index ? accent : t.sub, opacity: i === index ? 1 : 0.4 }}
          />
        ))}
      </div>
      <div style={{ fontSize: 28, fontWeight: 600, color: t.sub }}>{isLast ? "저장 · 공유 🔖" : "넘기기 →"}</div>
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
        fontFamily: 'ui-sans-serif, system-ui, "Apple SD Gothic Neo", "Pretendard", "Malgun Gothic", sans-serif',
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      {Header}

      {photo ? (
        // 사진첨부형: 사진 프레임(설명) + 그 위에 짧은 카피
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 28, justifyContent: "center" }}>
          <div
            style={{
              borderRadius: 28,
              border: `4px dashed ${t.sub}`,
              background: "rgba(0,0,0,0.04)",
              minHeight: 360,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 40,
              textAlign: "center",
            }}
          >
            <div style={{ color: t.sub, fontSize: 34 }}>📷 {page.photoNote || "여기에 사진을 넣어요"}</div>
          </div>
          <div style={{ fontFamily: '"Fraunces", Georgia, serif', fontSize: isFirst ? 64 : 52, lineHeight: 1.15, fontWeight: 600, wordBreak: "keep-all" }}>
            {page.headline}
          </div>
          {page.body && <div style={{ fontSize: 36, lineHeight: 1.5, color: t.sub, whiteSpace: "pre-wrap", wordBreak: "keep-all" }}>{page.body}</div>}
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 32 }}>
          {isFirst && <div style={{ fontSize: 30, fontWeight: 700, color: accent, letterSpacing: 1 }}>{niche || "오늘의 주제"} ✦</div>}
          <div style={{ fontFamily: '"Fraunces", Georgia, serif', fontSize: isFirst ? 92 : 64, lineHeight: 1.12, fontWeight: 600, color: t.fg, wordBreak: "keep-all" }}>
            {page.headline}
          </div>
          {page.body && <div style={{ fontSize: 40, lineHeight: 1.5, color: t.sub, whiteSpace: "pre-wrap", wordBreak: "keep-all" }}>{page.body}</div>}
        </div>
      )}

      {Dots}
    </div>
  );
}
