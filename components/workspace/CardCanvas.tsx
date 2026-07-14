import type { CardPage } from "@/lib/workspace/types";

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

// 카드 테마 프리셋(제품 콘텐츠) — 프로젝트 웜 팔레트 유지. key는 기존 유지 → 기존 카드 호환.
// 카드 테마 — 토스 디자인 시스템(TDS) 팔레트. key는 유지(기존 카드 호환), 값만 교체.
export const THEMES: CardTheme[] = [
  { key: "cream", name: "화이트", bg: "#ffffff", fg: "#191f28", sub: "#8b95a1", accent: "#3182f6", chip: "#191f28", chipFg: "#ffffff" },
  { key: "ink", name: "잉크", bg: "#191f28", fg: "#f9fafb", sub: "#8b95a1", accent: "#4593fc", chip: "#3182f6", chipFg: "#ffffff" },
  { key: "coral", name: "토스블루", bg: "#3182f6", fg: "#ffffff", sub: "#c9e2ff", accent: "#ffffff", chip: "#ffffff", chipFg: "#1b64da" },
  { key: "teal", name: "라이트그레이", bg: "#f2f4f6", fg: "#191f28", sub: "#6b7684", accent: "#3182f6", chip: "#191f28", chipFg: "#f2f4f6" },
  { key: "sand", name: "스카이", bg: "#e8f3ff", fg: "#191f28", sub: "#4e5968", accent: "#1b64da", chip: "#1b64da", chipFg: "#ffffff" },
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
  if (photoStyle === "bg" && photoDataUrl) {
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
