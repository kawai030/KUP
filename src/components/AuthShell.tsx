import { Logo } from "@/components/ui";

export function AuthShell({
  title,
  sub,
  children,
}: {
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-ink text-paper p-12">
        <Logo size="md" />
        <div>
          <p className="font-display text-4xl leading-tight">
            시간은 AI가 줄이고,
            <br />
            <span className="text-coral">발행은 내가.</span>
          </p>
          <p className="text-paper/70 mt-4 max-w-sm">
            설문→전략→카드뉴스 초안→검수→편집·발행→성과까지. 100명씩 1,000명으로.
          </p>
        </div>
        <p className="text-paper/50 text-sm">테스터 베타(개발 모드)</p>
      </div>
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8">
            <Logo size="md" />
          </div>
          <h1 className="font-display text-3xl">{title}</h1>
          <p className="text-ink-soft mt-2 mb-7">{sub}</p>
          {children}
        </div>
      </div>
    </div>
  );
}
