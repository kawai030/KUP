import type { Metadata } from "next";
import "./globals.css";
import "./wireframe.css"; // 와이어프레임 디자인 시스템(비주얼 SoT, 1차 초안)

export const metadata: Metadata = {
  title: "Kup",
  description: "갓 시작한 1인 인플루언서를 위한 인스타 카드뉴스 AI",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <head>
        {/* 토스 디자인 시스템(TDS) 서체 — Toss Product Sans는 비공개 → Pretendard로 대체(docs/design/DESIGN-toss.md).
            한글·라틴 모두 Pretendard 한 벌로 통일. */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
