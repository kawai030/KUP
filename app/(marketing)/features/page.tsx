import { AuthButton } from "../_components/auth-modal";

/**
 * 주요 기능 — 기능 4개 상세(교차 레이아웃).
 *
 * ▶ 영상 넣는 법 (Vimeo): 각 항목의 video 에 링크만 붙여넣으면 자동 임베드됩니다.
 *     · 공개 영상   → video: "https://vimeo.com/123456789"
 *     · 미공개 영상 → video: "https://vimeo.com/123456789/abc123def"   (해시까지 그대로)
 *     · player 링크·iframe 코드·숫자 ID 도 그대로 인식합니다.
 *     · video 를 "" 로 두면 지금처럼 핑크 플레이스홀더(아이콘+라벨)가 나옵니다.
 *   → 링크만 여기 붙여 넣으면 끝. 다른 건 안 건드려도 됩니다.
 */
const FEATURES = [
  { tag: "01 · 계정 연동", h: "여러 인스타 계정을 한 곳에서", ic: "🔗", lbl: "계정 연동·전환 화면", video: "", p: "운영 중인 계정이 여러 개여도 따로 로그인할 필요 없어요. KUP 안에서 계정을 전환하며 기획·제작·발행을 관리해요. 연동은 인스타 공식 OAuth로, 비밀번호는 보관하지 않아요." },
  { tag: "02 · AI 기획·제작", h: "주제만 정하면 카드뉴스 초안까지", ic: "✦", lbl: "AI 카드뉴스 제작 데모", video: "", p: "주제와 톤을 입력하면 AI가 구성과 문구를 제안하고, 템플릿과 브랜드 컬러를 반영한 카드뉴스 초안을 만들어요. 모든 결과물엔 ‘AI 생성물’이 표기되고, 편집을 거치면 해제됩니다." },
  { tag: "03 · 검수·예약 발행", h: "올리기 전, 내가 최종 확인", ic: "✓", lbl: "검수·승인·예약 발행 화면", video: "", p: "발행 전 출처와 민감 표현을 점검하고, 사용자 승인을 받아요. 승인하면 원하는 시간에 맞춰 예약 발행됩니다. 사람이 마지막을 확인하는 휴먼 인 더 루프 방식이에요." },
  { tag: "04 · 성과·성장 플랜", h: "인사이트를 보고, 다음을 제안받아요", ic: "↗", lbl: "콘텐츠 성과·인사이트 대시보드", video: "", p: "도달·저장·공유·팔로워 유입 같은 인스타 인사이트를 한눈에 모아 보고, 성과를 바탕으로 다음 콘텐츠 방향을 제안해요. 업로드 꾸준함은 기여 그래프로 시각화돼요." },
];

/**
 * Vimeo 링크 → player 임베드 URL 로 변환. 공유링크·미공개해시·iframe코드·숫자ID 모두 인식.
 * 비었거나 인식 불가면 null(→ 플레이스홀더). title·byline·portrait 는 숨겨 깔끔하게.
 */
function vimeoEmbed(input: string): string | null {
  const s = (input || "").trim();
  if (!s) return null;
  const idMatch = s.match(/(?:player\.vimeo\.com\/video\/|vimeo\.com\/(?:video\/)?)(\d+)/);
  const id = idMatch?.[1] ?? (/^\d+$/.test(s) ? s : null);
  if (!id) return null;
  const hashMatch = s.match(/[?&]h=(\w+)/) ?? s.match(/vimeo\.com\/\d+\/(\w+)/);
  const hash = hashMatch?.[1];
  const params = new URLSearchParams();
  if (hash) params.set("h", hash);
  params.set("title", "0");
  params.set("byline", "0");
  params.set("portrait", "0");
  return `https://player.vimeo.com/video/${id}?${params.toString()}`;
}

export default function FeaturesPage() {
  return (
    <section className="section">
      <div className="page-head">
        <span className="kicker">주요 기능</span>
        <h1>기획부터 성장까지, 한 흐름으로</h1>
        <p className="lead">반복되는 일은 AI가 맡고, 중요한 결정은 항상 내가 합니다.</p>
      </div>

      {FEATURES.map((f, i) => {
        const videoSrc = vimeoEmbed(f.video);
        return (
          <div key={f.tag} className={`feature-row${i % 2 === 1 ? " reverse" : ""}`}>
            <div className="feature-copy">
              <div className="feature-tag">{f.tag}</div>
              <h3>{f.h}</h3>
              <p>{f.p}</p>
            </div>
            {videoSrc ? (
              <div className="feature-ph has-video">
                <iframe
                  src={videoSrc}
                  title={f.lbl}
                  loading="lazy"
                  allow="autoplay; fullscreen; picture-in-picture; clipboard-write"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="feature-ph">
                <span className="feature-ic" aria-hidden="true">{f.ic}</span>
                <span className="feature-lbl">{f.lbl}</span>
              </div>
            )}
          </div>
        );
      })}

      <div className="cta-band">
        <h2>지금, 첫 카드부터 시작해요</h2>
        <AuthButton className="btn btn-primary btn-lg">무료로 시작하기</AuthButton>
      </div>
    </section>
  );
}
