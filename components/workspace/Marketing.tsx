import Link from "next/link";
import { Button, Logo } from "@/components/workspace/ui";

export function MarketingNav({ start }: { start: string }) {
  return (
    <header className="sticky top-0 z-30 bg-paper/90 backdrop-blur border-b border-line">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Logo size="md" />
          <nav className="hidden sm:flex items-center gap-5 text-sm text-ink-soft">
            <Link href="/features" className="hover:text-ink">
              주요 기능
            </Link>
            <Link href="/pricing" className="hover:text-ink">
              요금제
            </Link>
            <Link href="/contact" className="hover:text-ink">
              문의하기
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/login">
            <Button variant="ghost" size="sm">
              로그인
            </Button>
          </Link>
          <Link href={start}>
            <Button size="sm">시작하기</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-line bg-paper-2/40">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-10">
        <div className="flex flex-wrap justify-between gap-6">
          <div>
            <Logo size="md" />
            <p className="text-sm text-muted mt-3 max-w-xs">
              인스타를 갓 시작한 1인 인플루언서를 위한 AI 운영 코파일럿. 시간은 줄이고, 발행은 내가.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-10 gap-y-2 text-sm">
            <Link href="/features" className="text-ink-soft hover:text-ink">주요 기능</Link>
            <Link href="/pricing" className="text-ink-soft hover:text-ink">요금제</Link>
            <Link href="/contact" className="text-ink-soft hover:text-ink">문의하기</Link>
            <Link href="/terms" className="text-ink-soft hover:text-ink">서비스 이용약관</Link>
            <Link href="/privacy" className="text-ink-soft hover:text-ink">개인정보 처리방침</Link>
            <Link href="/contact" className="text-ink-soft hover:text-ink">고객센터</Link>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-line text-xs text-muted flex flex-wrap justify-between gap-2">
          <span>유한사람들 · 사업자등록번호 000-00-00000 · 대표 KUP</span>
          <span>© 2026 KUP · 테스터 베타(개발 모드)</span>
        </div>
      </div>
    </footer>
  );
}
