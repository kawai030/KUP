import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KUP — AI 인스타 운영 도구",
  description:
    "인스타를 갓 시작한 1인 인플루언서를 위한 AI 코파일럿. 기획·제작·발행·관리까지 한곳에서. 빨리 만들고(가속) 한곳에서 통합하고 다음 액션으로 운영. 검수·발행 주도권은 항상 나에게.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;1,9..144,500&display=swap"
          rel="stylesheet"
        />
        <link
          rel="stylesheet"
          as="style"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
