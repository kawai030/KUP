import { getCurrentUser } from "@/lib/auth";
import { MarketingNav, MarketingFooter } from "@/components/Marketing";

export default async function TermsPage() {
  const user = await getCurrentUser();
  const start = user ? (user.survey ? "/app/plans" : "/onboarding") : "/signup";
  return (
    <div className="min-h-screen">
      <MarketingNav start={start} />
      <section className="max-w-3xl mx-auto px-5 sm:px-8 py-14 prose-sm">
        <h1 className="font-display text-3xl mb-6">서비스 이용약관</h1>
        <div className="space-y-4 text-sm text-ink-soft leading-relaxed">
          <p>제1조 (목적) 본 약관은 KUP(이하 "회사")가 제공하는 AI 인스타그램 운영 도구 서비스의 이용 조건과 절차, 권리·의무를 규정합니다.</p>
          <p>제2조 (콘텐츠의 주도권) 서비스가 생성하는 모든 산출물은 편집 가능한 초안이며, 최종 검수·승인·발행의 권한과 책임은 이용자에게 있습니다. 회사는 무인 자동 발행을 기본으로 제공하지 않습니다.</p>
          <p>제3조 (AI 생성물 표기) 회사는 AI가 생성한 콘텐츠에 ‘AI 생성물’ 표기를 부착하며, 이용자가 편집을 거친 경우 표기는 해제될 수 있습니다.</p>
          <p>제4조 (금지 행위) 이용자는 공식 API 정책에 반하는 자동팔로우, 콜드 DM, 가짜 인게이지먼트 등을 목적으로 서비스를 이용할 수 없습니다.</p>
          <p>제5조 (베타 운영) 본 서비스는 테스터 한정 베타(개발 모드)로 운영되며, 기능·정책은 사전 고지 후 변경될 수 있습니다.</p>
          <p className="text-muted">* 본 약관은 베타용 요약본으로, 정식 출시 시 법무 검토를 거친 전문으로 대체됩니다.</p>
        </div>
      </section>
      <MarketingFooter />
    </div>
  );
}
