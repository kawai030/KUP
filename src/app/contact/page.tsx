import { getCurrentUser } from "@/lib/auth";
import { Button, Card } from "@/components/ui";
import { MarketingNav, MarketingFooter } from "@/components/Marketing";

const FAQ = [
  ["계정 / 로그인", "로그인이 안 되거나 인증 메일이 오지 않을 때"],
  ["회원가입", "이메일·구글 가입, 닉네임/약관 관련 문의"],
  ["서비스 이용", "기획·제작·검수·발행, 인스타 연동, 결제 관련 오류"],
];

export default async function ContactPage() {
  const user = await getCurrentUser();
  const start = user ? (user.survey ? "/app/plans" : "/onboarding") : "/signup";
  return (
    <div className="min-h-screen">
      <MarketingNav start={start} />
      <section className="max-w-3xl mx-auto px-5 sm:px-8 py-14">
        <h1 className="font-display text-4xl sm:text-5xl">문의하기</h1>
        <p className="text-ink-soft mt-3">
          오류·이용 문의는 아래 폼으로 접수해 주세요. 데이터를 모아 더 빠르게 개선하고 통계로
          분석하기 위해 구글 폼으로 받고 있어요.
        </p>
        <Card className="p-6 mt-8">
          <div className="space-y-3">
            {FAQ.map(([t, d]) => (
              <div key={t} className="flex items-start gap-3">
                <span className="text-coral mt-0.5">•</span>
                <div>
                  <div className="font-medium">{t}</div>
                  <div className="text-sm text-ink-soft">{d}</div>
                </div>
              </div>
            ))}
          </div>
          <a href="https://forms.gle/" target="_blank" rel="noreferrer" className="inline-block mt-5">
            <Button>구글 폼으로 오류·문의 접수</Button>
          </a>
          <p className="text-xs text-muted mt-3">* 연결 링크는 운영용 구글 폼으로 교체 예정이에요.</p>
        </Card>
      </section>
      <MarketingFooter />
    </div>
  );
}
