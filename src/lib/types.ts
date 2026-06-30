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

export type ContentFormat = "카드뉴스" | "릴스" | "사진" | "스토리";
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
  followers: number;
  operatingMonths: number;
  goals: OperationGoal[];
  weeklyCapacity: number;
  mainFormats: ContentFormat[];
  assets: string;
  brandKeywords: string[];
  brandColor: string; // 비주얼: 브랜드 컬러(템플릿+브랜드컬러)
  voiceExample: string;
  forbiddenExpressions: string[];
  captionLength: "짧게" | "보통" | "길게";
  hashtagStyle: string;
  ctaStyle: string;
  visualGuide: string;
  sensitiveDomain: SensitiveDomain;
  benchmark: string;
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

// IA 칸반 6단계 = 카드 수명주기
export type CardStatus =
  | "기획중"
  | "기획완료"
  | "제작중"
  | "제작완료"
  | "예약업로드"
  | "업로드완료";

export const KANBAN_COLUMNS: CardStatus[] = [
  "기획중",
  "기획완료",
  "제작중",
  "제작완료",
  "예약업로드",
  "업로드완료",
];

export interface ReviewFlag {
  id: string;
  type: "민감표현" | "표기누락" | "미검증주장" | "출처확인" | "이미지아티팩트";
  severity: "high" | "medium" | "low";
  message: string;
  excerpt?: string;
  resolved: boolean;
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
  postReference: string;
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

export interface IgAccount {
  id: string;
  handle: string;
  mode: "테스터베타" | "정식";
  loginType?: "instagram" | "facebook"; // 정식 연동 방식 (호출 호스트 결정)
  igUserId?: string; // 정식: Instagram Business Account ID
  accessToken?: string; // 정식: access token (콘텐츠 발행 권한)
  connectedAt: number;
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
