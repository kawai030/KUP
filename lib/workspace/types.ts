// ─────────────────────────────────────────────────────────────────────────────
// KUP 공용 타입 (v2 — 최종 PRD + IA 반영)
// 입력 2계층: (A) 온보딩 시작 설문 = "사람/계정을 안다", (B) 콘텐츠 입력 = "콘텐츠를 만든다"
// ─────────────────────────────────────────────────────────────────────────────

export type OperationGoal =
  | "취미"
  | "브랜딩"
  | "협찬"
  | "매출"
  | "문의"
  | "포트폴리오";

export type CardFormat = "카드뉴스" | "사진첨부형 카드뉴스" | "릴스";

export type SensitiveDomain =
  | "없음"
  | "금융·투자·부동산"
  | "의료·건강·다이어트"
  | "법률·세무"
  | "기타 규제";

// §4-A 시작 설문 — 1회 입력 후 모든 생성에 상속, 마이페이지에서 수정
export interface SurveyProfile {
  niche: string;
  followers: number; // 미연동·테스터 계정의 팔로워 fallback base(resolveFollowerCount). 설문에선 안 받음.
  goals: OperationGoal[];
  weeklyCapacity: number;
  brandKeywords: string[];
  voiceExample: string;
  forbiddenExpressions: string[];
  captionLength: "짧게" | "보통" | "길게";
  hashtagStyle: string;
  sensitiveDomain: SensitiveDomain;
}

export type OperationStage =
  | "세팅"
  | "누적"
  | "반응 탐색"
  | "성장 실험"
  | "수익화 준비";

export interface StrategyTopic {
  title: string;
  goal: string;
  hookDirection: string;
  why: string;
}

export interface Strategy {
  stage: OperationStage;
  diagnosis: string;
  weeklyGoal: string;
  recommendedCount: number;
  focus: string[];
  topics: StrategyTopic[];
  generatedBy: "ai" | "template";
  createdAt: number;
}

export type ContentObjective = "조회" | "저장" | "공유" | "방문" | "문의" | "팔로우" | "댓글";
export type TopicSource = "추천" | "직접입력";

export interface CardPage {
  index: number;
  headline: string; // 서브 타이틀(각 장 제목)
  body: string; // 본문
  note?: string; // 비주얼/이미지 메모
  photoNote?: string; // 사진첨부형: 들어갈 사진 설명
}

// 카드 수명주기 상태(6). '기획완료'·'제작완료'는 수명주기 게이트다 —
// 기획완료=기획확정(릴스 발행 조건), 제작완료=검수통과(발행 조건)로 발행·검수 로직이 사용한다.
// 칸반에는 별도 열로 노출하지 않고 각 단계의 '중' 열에 접어서 보여준다(kanbanColumnOf).
export type CardStatus =
  | "기획중"
  | "기획완료"
  | "제작중"
  | "제작완료"
  | "예약업로드"
  | "업로드완료";

// IA 0.2.4 칸반 표시 열 = 4. 게이트 상태(기획완료/제작완료)는 자체 열 없이 '중' 열에 접어 표시.
export const KANBAN_COLUMNS: CardStatus[] = [
  "기획중",
  "제작중",
  "예약업로드",
  "업로드완료",
];

// 카드 상태 → 칸반 표시 열. 열이 없는 게이트 상태를 같은 단계의 '중' 열로 접는다.
export function kanbanColumnOf(status: CardStatus): CardStatus {
  if (status === "기획완료") return "기획중";
  if (status === "제작완료") return "제작중";
  return status;
}

// 4단계 판정용 축. "규제 안전성"·"사실 정확성" = 필수통과(mustPass), 나머지는 가중.
// "확인 항목" = 판정 대상이 아닌 순수 체크리스트(출처확인 등).
export type ReviewAxis =
  | "규제 안전성"
  | "사실 정확성"
  | "요청 준수"
  | "표기·형식"
  | "확인 항목";

export interface ReviewFlag {
  id: string;
  type: "민감표현" | "표기누락" | "미검증주장" | "출처확인" | "이미지아티팩트";
  severity: "high" | "medium" | "low";
  message: string;
  excerpt?: string;
  resolved: boolean;
  // ── 4단계 판정 메타 (lib/workspace/verdict.ts 가 소비). 옛 데이터엔 없을 수 있어 옵셔널. ──
  axis?: ReviewAxis;
  mustPass?: boolean; // 필수통과 축(규제·사실) 여부
  level?: "fail" | "warn"; // 명백 위법(fail) vs 회색지대(warn) — 규제·사실 축에서만 의미
}

export interface ApprovalLogEntry {
  at: number;
  actor: string;
  action: string;
}

export interface CardNews {
  id: string;
  userId: string;
  igAccountId?: string; // 발행 대상 인스타 계정
  title: string; // 타이틀(주제)
  format: CardFormat;
  topicSource: TopicSource;
  objective: ContentObjective;
  pageCount: number;
  keyMessage: string;
  pages: CardPage[];
  caption: string;
  hashtags: string[];
  cta: string;
  aiLabel: string; // 'AI 생성 콘텐츠'
  aiEdited: boolean; // 사용자가 편집하면 true → AI 라벨 해제
  status: CardStatus;
  reviewFlags: ReviewFlag[];
  approvalLog: ApprovalLogEntry[];
  generatedBy: "ai" | "template" | "기획"; // 기획=아직 본문 미생성
  hasVideo?: boolean; // 릴스: 영상 업로드 여부
  theme: string;
  brandColor: string;
  photoStyle?: "top" | "bg"; // 사진 배치: top=상단 블록(기본) / bg=배경 풀블리드 + DIM
  ratio?: "1:1" | "3:4"; // 카드 비율: 정사각(기본) / 세로 3:4
  createdAt: number;
  updatedAt: number;
}

export type PublishChannelStatus = "예약" | "발행완료" | "취소";

export interface PublishJob {
  id: string;
  userId: string;
  cardId: string;
  cardTitle: string;
  igHandle?: string;
  scheduledAt: number;
  immediate: boolean;
  status: PublishChannelStatus;
  publishedAt?: number;
  igPermalink?: string;
  createdAt: number;
}

// 성과/인사이트 기록 (초기 수동 입력 허용 / P1 자동 수집)
export interface MetricEntry {
  id: string;
  userId: string;
  cardId?: string;
  mediaId?: string; // 인스타 미디어 ID (자동수집 시 중복 방지 키)
  source?: "manual" | "instagram"; // 출처 — 미지정은 수동 입력으로 간주
  date: string; // YYYY-MM-DD
  views: number; // 조회
  reach: number; // 도달
  saves: number; // 저장
  shares: number; // 공유
  likes: number; // 좋아요
  comments: number; // 댓글
  profileVisits: number; // 프로필 방문
  follows: number; // 게시물 기여 팔로우
  newFollowers: number; // 계정 단위 팔로워 순증
  createdAt: number;
}

export interface DmRule {
  id: string;
  userId: string;
  enabled: boolean;
  optIn: boolean;
  triggerKeyword: string;
  postReference: string; // 표시용 라벨(선택한 게시물 캡션/설명). 매칭엔 mediaId 사용
  mediaId?: string; // 대상 게시물 IG 미디어 ID. 비우면 "전체 게시물"에 적용
  dmMessage: string;
  resourceLink: string;
  sentCount: number;
  createdAt: number;
}

export type Plan = "베이직" | "프로" | "프리미엄";
export type BillingCycle = "월" | "연";

export const DM_LIMITS: Record<Plan, number> = {
  베이직: 100,
  프로: 1000,
  프리미엄: Number.POSITIVE_INFINITY,
};

// DM 기본 문구(미리 채워지고 수정 가능). 자료 링크는 문구 안에 직접 적는다.
export const DM_TEMPLATE = "안녕하세요! 요청하신 자료 보내드려요 🙌";

// DM 문구 렌더 — 미리보기·카드·실제 발송 공용.
//  - 기본은 문구 그대로. (옛 데이터 호환) link 가 따로 있으면 끝에 붙여준다.
export function renderDmMessage(message: string, link?: string): string {
  const msg = message || "";
  const url = (link || "").trim();
  return url && !msg.includes(url) ? `${msg}\n🔗 ${url}` : msg;
}

export interface IgAccount {
  id: string;
  handle: string;
  mode: "테스터베타" | "정식";
  loginType?: "instagram" | "facebook"; // 정식 연동 방식 (호출 호스트 결정)
  igUserId?: string; // 정식: Instagram Business Account ID
  accessToken?: string; // 정식: access token (봉인 저장 — crypto.sealToken). 클라이언트엔 노출 X
  tokenExpiresAt?: number; // 장기 토큰 만료(epoch ms). OAuth 연동 시 설정 — 갱신 판단용
  connectedAt: number;
  // 데모/표시용 메트릭 (mock 단계). 실연동 시 인스타 인사이트로 교체 — TODO(데이터 연결)
  followers?: number;
  weeklyPublished?: number; // 이번 주 발행 수
  weeklyGrowth?: number; // 주간 팔로워 순증
  niche?: string; // 계정 한 줄 소개
}

export function findIgAccount(
  user: { igAccounts: IgAccount[]; activeIgAccountId?: string }
): IgAccount | undefined {
  return user.igAccounts.find((a) => a.id === user.activeIgAccountId) ?? user.igAccounts[0];
}

export function isLiveAccount(acc?: IgAccount): boolean {
  return Boolean(acc?.igUserId && acc?.accessToken);
}

export interface User {
  id: string;
  email: string;
  name: string; // 닉네임
  passwordHash: string;
  passwordSalt: string;
  guest: boolean; // 비회원
  authProvider: "email" | "google" | "guest";
  marketingConsent: boolean; // 이벤트 혜택 및 광고성 정보 동의
  survey?: SurveyProfile;
  plan: Plan;
  billingCycle: BillingCycle;
  subscribedAt?: number;
  igAccounts: IgAccount[];
  activeIgAccountId?: string;
  onboarded: boolean; // 온보딩 캐러셀 확인 여부
  createdAt: number;
}

export interface Session {
  token: string;
  userId: string;
  createdAt: number;
}

export interface DB {
  users: User[];
  sessions: Session[];
  strategies: Record<string, Strategy>;
  cards: CardNews[];
  publishJobs: PublishJob[];
  metrics: MetricEntry[];
  dmRules: DmRule[];
}

export type PublicUser = Omit<User, "passwordHash" | "passwordSalt">;

// 칸반 컬럼 매핑 헬퍼
export function activeIgHandle(user: { igAccounts: IgAccount[]; activeIgAccountId?: string }): string | undefined {
  const acc = user.igAccounts.find((a) => a.id === user.activeIgAccountId) ?? user.igAccounts[0];
  return acc?.handle;
}
