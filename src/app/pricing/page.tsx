import { getCurrentUser } from "@/lib/auth";
import { MarketingNav, MarketingFooter } from "@/components/Marketing";
import { PricingPlans } from "@/components/PricingPlans";

export default async function PricingPage() {
  const user = await getCurrentUser();
  const start = user ? (user.survey ? "/app/plans" : "/onboarding") : "/signup";
  return (
    <div className="min-h-screen">
      <MarketingNav start={start} />
      <section className="max-w-5xl mx-auto px-5 sm:px-8 py-14">
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl sm:text-5xl">요금제</h1>
          <p className="text-ink-soft mt-3">베타 기간에는 전 기능을 무료로 이용할 수 있어요.</p>
        </div>
        <PricingPlans mode="marketing" startHref={start} />
        <p className="text-center text-xs text-muted mt-8">
          가격은 베타 종료 후 적용 예정인 참고 금액이에요. DM 리드마그넷 한도: 베이직 100건 / 프로
          1,000건 / 프리미엄 무제한.
        </p>
      </section>
      <MarketingFooter />
    </div>
  );
}
