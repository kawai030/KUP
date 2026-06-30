import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { Badge, Button, Card } from "@/components/ui";
import { MarketingNav, MarketingFooter } from "@/components/Marketing";

const FEATURES = [
  { t: "여러 인스타 계정 연동", d: "한 워크스페이스에서 여러 계정을 연결하고 전환하며 운영해요. (공식 OAuth · 비밀번호 미보관)" },
  { t: "AI 기획 및 제작", d: "설문으로 받은 컨셉·톤에 맞춰 카드뉴스 기획부터 본문·캡션·해시태그·CTA까지 한 번에." },
  { t: "검수·편집 및 예약 발행", d: "‘AI 생성물’ 표기 + 검수 게이트(민감표현·표기누락·출처). 편집·승인 후 내가 누르는 발행/예약." },
  { t: "성과 확인 → 성장 플랜", d: "인스타 인사이트, 팔로워 100단위 챌린지, 업로드 기여 그래프로 꾸준함을 이어가요." },
];

const STATS = [
  ["2~3시간 → 수 분", "카드뉴스 제작 시간"],
  ["1,000명", "수익화 첫 목표(나노 인플루언서)"],
  ["주 2회+", "꾸준한 발행 루틴"],
];

export default async function Home() {
  const user = await getCurrentUser();
  const start = user ? (user.survey ? "/app/plans" : "/onboarding") : "/signup";

  return (
    <div className="min-h-screen">
      <MarketingNav start={start} />

      {/* hero */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8 pt-14 pb-16">
        <div className="float-in">
          <Badge tone="coral">인스타를 갓 시작한 1인 인플루언서를 위한 AI 코파일럿</Badge>
          <h1 className="font-display text-4xl sm:text-6xl leading-[1.08] mt-5 max-w-3xl">
            만드는 시간은 줄이고,
            <br />
            <span className="text-coral">발행 버튼은 내가</span> 누른다.
          </h1>
          <p className="text-lg text-ink-soft mt-5 max-w-xl">
            기획·제작·발행·관리까지 한곳에서. 더 빨리 만들고(가속), 한곳에서 통합하고(통합), 다음
            액션으로 잇는(운영) 코파일럿. 검수와 발행의 주도권은 항상 나에게.
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-8">
            <Link href={start}>
              <Button size="lg">{user ? "워크스페이스 열기" : "무료로 시작하기"}</Button>
            </Link>
            <Link href="/features">
              <Button variant="outline" size="lg">
                주요 기능 보기
              </Button>
            </Link>
          </div>
          <div className="flex flex-wrap gap-6 mt-10">
            {STATS.map(([n, l]) => (
              <div key={l}>
                <div className="font-display text-2xl text-ink">{n}</div>
                <div className="text-sm text-muted">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 주요 기능 설명 */}
      <section className="bg-paper-2/60 border-y border-line">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-16">
          <div className="text-xs font-semibold tracking-wide text-coral uppercase mb-1">주요 기능</div>
          <h2 className="font-display text-3xl sm:text-4xl mb-8">기획부터 성장까지, 한 흐름으로</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {FEATURES.map((f, i) => (
              <Card key={f.t} className="p-6 flex gap-4">
                <div className="font-display text-3xl text-line">{String(i + 1).padStart(2, "0")}</div>
                <div>
                  <h3 className="font-semibold text-lg">{f.t}</h3>
                  <p className="text-sm text-ink-soft mt-1 leading-relaxed">{f.d}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* 코파일럿 원칙 */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8 py-16">
        <div className="grid md:grid-cols-3 gap-4">
          {[
            ["가속", "툴 전환 없이 더 빨리", "인스타 검색 → 캔바 → 캡컷으로 갈아타지 않아요. 주제 하나로 초안이 한 번에."],
            ["통합", "한곳에서 기획·제작·발행", "흩어진 도구 대신, 한 사람의 계정을 이어서 함께 관리하는 워크스페이스."],
            ["운영", "다음 액션으로 연결", "성과를 보는 데서 끝나지 않아요. ‘다음에 뭘 바꿀지’까지 이어줘요."],
          ].map(([tag, t, d]) => (
            <Card key={t} className="p-6">
              <Badge tone="teal">{tag}</Badge>
              <h3 className="font-display text-xl mt-3">{t}</h3>
              <p className="text-sm text-ink-soft mt-2">{d}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* 신뢰/주도권 */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8 pb-16">
        <Card className="p-8 bg-ink text-paper border-ink">
          <div className="text-xs font-semibold tracking-wide text-coral uppercase mb-3">믿고 쓰는 이유</div>
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3">
            {[
              "모든 산출물은 편집 가능한 초안 — 최종 결정·발행은 나",
              "발행 전 반드시 거치는 검수 필수 게이트 + 승인 로그",
              "‘AI 생성물’ 표기, 편집을 거치면 자동 해제",
              "공식 API만 · 자동팔로우/콜드 DM/가짜 인게이지먼트 없음",
            ].map((p) => (
              <div key={p} className="flex gap-3 items-start">
                <span className="text-coral mt-0.5">✓</span>
                <span className="text-paper/90">{p}</span>
              </div>
            ))}
          </div>
        </Card>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8 pb-24 text-center">
        <h2 className="font-display text-3xl sm:text-4xl">다음 100명, 오늘 시작해요</h2>
        <p className="text-ink-soft mt-3">설문 한 번이면 이번 주 전략과 첫 카드뉴스 기획까지.</p>
        <Link href={start} className="inline-block mt-6">
          <Button size="lg">{user ? "워크스페이스 열기" : "무료로 시작하기"}</Button>
        </Link>
      </section>

      <MarketingFooter />
    </div>
  );
}
