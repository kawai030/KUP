import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/workspace/auth";
import { Gnb } from "./_components/gnb";
import { Footer } from "./_components/footer";
import { AuthModalProvider } from "./_components/auth-modal";
import "./marketing.css";

/**
 * 홍보 사이트 레이아웃 — 홈(kup-hero)의 핑크 디자인과 통일(.kup-site 스코프, 전역 wireframe.css 충돌 방지).
 * GNB + 본문 + 푸터. 로그인 상태를 읽어 GNB/CTA를 분기(로그인 시 "워크스페이스로"·"로그아웃").
 * Supabase 불가 시에도 홍보페이지는 떠야 하므로 try/catch (로그아웃으로 간주).
 */
export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  let loggedIn = false;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    loggedIn = !!user;
  } catch {
    loggedIn = false;
  }
  // Supabase 세션이 없어도 워크스페이스(파일DB) 세션이 있으면 로그인으로 인식(게스트 포함)
  if (!loggedIn) {
    try {
      loggedIn = !!(await getCurrentUser());
    } catch {
      /* noop */
    }
  }

  return (
    <AuthModalProvider loggedIn={loggedIn}>
      {/* 랜딩 디스플레이 서체(홈과 동일). 한글 Pretendard는 wireframe.css에서 로드. */}
      <div className="kup-site">
        <Gnb loggedIn={loggedIn} />
        <main>{children}</main>
        <Footer />
      </div>
    </AuthModalProvider>
  );
}
