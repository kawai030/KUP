import Link from "next/link";

/** 홍보 사이트 공통 푸터 — 홈(kup-hero)과 동일한 핑크 톤. */
export function Footer() {
  return (
    <footer>
      <div className="foot">
        <Link href="/" className="logo" style={{ fontSize: 18 }}>
          <span className="dot" />
          KUP
        </Link>
        <nav className="foot-links">
          <Link href="/features">주요 기능</Link>
          <Link href="/pricing">요금제</Link>
          <Link href="/contact">문의하기</Link>
          <Link href="/privacy">개인정보처리방침</Link>
          <Link href="/terms">이용약관</Link>
        </nav>
        <div>© 2026 KUP · AI 인스타 카드뉴스</div>
      </div>
    </footer>
  );
}
