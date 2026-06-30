import { getCurrentUser } from "@/lib/auth";
import { Card } from "@/components/ui";
import { MarketingNav, MarketingFooter } from "@/components/Marketing";

const DETAIL = [
  {
    t: "여러 인스타 계정 연동 가능",
    d: "하나의 워크스페이스에서 여러 인스타 계정을 연결하고 좌측 사이드바에서 즉시 전환해요. 공식 OAuth로 연결하며 비밀번호는 저장하지 않습니다. (베타: 테스터 계정 수락)",
    points: ["계정별 콘텐츠·성과 분리 관리", "회원당 다중 계정 연동", "안심 연동 안내"],
  },
  {
    t: "AI 기획 및 제작",
    d: "온보딩 설문으로 받은 계정 컨셉·톤·금지표현을 바탕으로, 주제에 맞는 카드뉴스를 기획(아웃라인)하고 제작(본문·캡션·해시태그·CTA)까지 한 번에 만들어요.",
    points: ["AI 기획 리스트(백로그)", "사진첨부형 카드뉴스 지원", "템플릿 + 브랜드 컬러"],
  },
  {
    t: "검수 / 편집 및 예약 발행",
    d: "생성물은 항상 편집 가능한 초안입니다. ‘AI 생성물’ 표기와 검수 게이트(민감표현·표기누락·출처확인)를 반드시 통과해야 발행할 수 있고, 편집을 거치면 AI 라벨이 해제돼요.",
    points: ["검수 필수 게이트 + 승인 로그", "휴먼인더루프(업로드 전 승인/거절)", "지금 발행 또는 예약 발행"],
  },
  {
    t: "콘텐츠 성과 확인 → 성장 플랜",
    d: "계정·게시물 단위 인스타 인사이트, DM 리드마그넷 카운트, 팔로워 100단위 챌린지, 업로드 기여 그래프(Contributions)로 꾸준함을 시각화하고 다음 액션을 받아요.",
    points: ["인사이트 새로고침·업데이트 표기", "업로드 기여 그래프", "팔로워 달성 챌린지"],
  },
];

export default async function FeaturesPage() {
  const user = await getCurrentUser();
  const start = user ? (user.survey ? "/app/plans" : "/onboarding") : "/signup";
  return (
    <div className="min-h-screen">
      <MarketingNav start={start} />
      <section className="max-w-5xl mx-auto px-5 sm:px-8 py-14">
        <h1 className="font-display text-4xl sm:text-5xl">주요 기능</h1>
        <p className="text-ink-soft mt-3 max-w-2xl">
          더 빨리 만들고, 한곳에서 통합하고, 다음 액션으로 잇는 코파일럿. 검수와 발행의 주도권은 항상
          사용자에게 있습니다.
        </p>
        <div className="mt-10 space-y-4">
          {DETAIL.map((f, i) => (
            <Card key={f.t} className="p-7">
              <div className="flex items-start gap-5">
                <div className="font-display text-4xl text-line">{String(i + 1).padStart(2, "0")}</div>
                <div>
                  <h2 className="font-display text-2xl">{f.t}</h2>
                  <p className="text-ink-soft mt-2">{f.d}</p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {f.points.map((p) => (
                      <span key={p} className="text-xs px-2.5 py-1 rounded-full bg-paper-2 text-ink-soft">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>
      <MarketingFooter />
    </div>
  );
}
