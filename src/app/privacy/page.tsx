import { getCurrentUser } from "@/lib/auth";
import { MarketingNav, MarketingFooter } from "@/components/Marketing";

export default async function PrivacyPage() {
  const user = await getCurrentUser();
  const start = user ? (user.survey ? "/app/plans" : "/onboarding") : "/signup";
  return (
    <div className="min-h-screen">
      <MarketingNav start={start} />
      <section className="max-w-3xl mx-auto px-5 sm:px-8 py-14">
        <h1 className="font-display text-3xl mb-6">개인정보 처리방침</h1>
        <div className="space-y-4 text-sm text-ink-soft leading-relaxed">
          <p>1. 수집 항목 — 이메일, 닉네임, 비밀번호(해시 저장), 온보딩 설문 응답, 생성·발행한 콘텐츠 및 성과 입력값.</p>
          <p>2. Meta 연동 — 인스타그램 계정 연동 시 공식 OAuth를 사용하며, 비밀번호는 저장하지 않습니다. 접근 토큰은 발행·인사이트 목적에 한해 사용됩니다.</p>
          <p>3. 이용 목적 — 서비스 제공, 콘텐츠 생성·검수·발행, 성과 분석, 고객 지원, (동의 시) 이벤트·광고성 정보 제공.</p>
          <p>4. 보관·파기 — 회원 탈퇴 또는 데이터 삭제 요청 시 관련 데이터를 지체 없이 파기합니다. 마이페이지에서 기간(1일/7일/30일) 또는 전체 삭제를 직접 실행할 수 있습니다.</p>
          <p>5. AI 저작권 안내 — 생성형 AI 산출물 활용 시 관련 법령·가이드를 준수하세요. (문화체육관광부 안내 참고)</p>
          <p className="text-muted">* 본 방침은 베타용 요약본으로, 정식 출시 시 전문으로 대체됩니다.</p>
        </div>
      </section>
      <MarketingFooter />
    </div>
  );
}
