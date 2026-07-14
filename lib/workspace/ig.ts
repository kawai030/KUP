import type { CardNews, IgAccount } from "./types";
import { isLiveAccount } from "./types";
import { openToken } from "./crypto";

// ─────────────────────────────────────────────────────────────────────────────
// Instagram 연동 커넥터. 두 가지 정식 연동 방식을 지원한다.
//
//  ① Instagram 로그인 방식 (loginType: "instagram", graph.instagram.com)  ← 권장·간편
//     - 앱 대시보드 "계정 추가 → 액세스 토큰 생성"으로 받은 토큰만 있으면 됨.
//     - IG User ID 는 토큰으로 /me?fields=user_id 호출해 자동 확보.
//  ② Facebook 로그인 방식 (loginType: "facebook", graph.facebook.com)
//     - 페이스북 페이지에 연결된 IG 비즈니스 계정. IG User ID + 토큰 필요.
//
//  토큰이 없으면(테스터) → 시뮬레이터로 흐름만 검증.
//
// 실제 발행 전제: 인스타 프로페셔널 계정 + 콘텐츠 발행 권한 토큰, 그리고 PUBLIC_BASE_URL
// (인스타가 image_url 을 가져갈 공개 https 주소 — 이미지는 /api/render/{cardId}/{page} 로 서빙).
// ─────────────────────────────────────────────────────────────────────────────

const VER = () => process.env.IG_GRAPH_VERSION || "v21.0";
const FB = () => `https://graph.facebook.com/${VER()}`;
const IG = () => `https://graph.instagram.com/${VER()}`;

function graphBase(account: IgAccount): string {
  return account.loginType === "facebook" ? FB() : IG();
}

export function publicBaseUrl(): string {
  return (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "");
}
export function imageUrlFor(baseUrl: string, cardId: string, page: number): string {
  return `${baseUrl}/api/render/${cardId}/${page}`;
}

export interface PublishResult {
  permalink: string;
  publishedAt: number;
}
interface GraphError {
  error?: { message?: string; type?: string; code?: number };
}

async function gPOST(base: string, path: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  const res = await fetch(`${base}${path}`, { method: "POST", body: new URLSearchParams(params) });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown> & GraphError;
  if (!res.ok || data.error) throw new Error(data.error?.message || `Graph API 오류 (${res.status})`);
  return data;
}
async function gGET(base: string, path: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${base}${path}`);
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown> & GraphError;
  if (!res.ok || data.error) throw new Error(data.error?.message || `Graph API 오류 (${res.status})`);
  return data;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitReady(base: string, containerId: string, token: string, tries = 12, delayMs = 1500): Promise<void> {
  for (let i = 0; i < tries; i++) {
    const s = (await gGET(base, `/${containerId}?fields=status_code&access_token=${token}`)) as { status_code?: string };
    if (s.status_code === "FINISHED") return;
    if (s.status_code === "ERROR" || s.status_code === "EXPIRED") throw new Error(`미디어 처리 실패(${s.status_code})`);
    await sleep(delayMs);
  }
  throw new Error("미디어 처리가 시간 내에 끝나지 않았어요. 잠시 후 다시 시도해 주세요.");
}

export function videoUrlFor(baseUrl: string, cardId: string): string {
  return `${baseUrl}/api/render-video/${cardId}`;
}

function buildCaption(card: CardNews): string {
  const tags = card.hashtags.slice(0, 30).join(" ");
  return [card.caption, tags].filter(Boolean).join("\n\n").slice(0, 2200);
}

// 연동 검증 — 토큰(+선택 igUserId)으로 계정 확인. loginType 자동 판별.
//  - igUserId 없이 토큰만 → Instagram 로그인 방식 (graph.instagram.com/me?fields=user_id)
//  - igUserId + 토큰 → Facebook 로그인 방식 (graph.facebook.com/{id}?fields=username)
export async function verifyConnection(
  accessToken: string,
  igUserId?: string
): Promise<{ igUserId: string; username: string; loginType: "instagram" | "facebook" }> {
  if (igUserId) {
    const d = (await gGET(FB(), `/${igUserId}?fields=username&access_token=${accessToken}`)) as { username?: string };
    if (!d.username) throw new Error("계정 정보를 확인할 수 없어요. IG User ID와 토큰을 확인하세요.");
    return { igUserId, username: d.username, loginType: "facebook" };
  }
  const d = (await gGET(IG(), `/me?fields=user_id,username&access_token=${accessToken}`)) as {
    user_id?: string;
    id?: string;
    username?: string;
  };
  const uid = d.user_id || d.id;
  if (!uid) throw new Error("토큰으로 계정을 확인할 수 없어요. ‘계정 추가 → 액세스 토큰 생성’으로 받은 토큰인지 확인하세요.");
  return { igUserId: uid, username: d.username || uid, loginType: "instagram" };
}

// ─────────────────────────────────────────────────────────────────────────────
// OAuth (Instagram 로그인 방식) — 사용자가 토큰을 직접 만들 필요 없이 "인스타로 로그인".
//   start → authorize 리다이렉트 → callback(code) → 단기토큰 → 장기토큰(약 60일)
// ─────────────────────────────────────────────────────────────────────────────

// Instagram API with Instagram Login 권한 스코프 (Meta 앱에서 승인 필요).
export const IG_OAUTH_SCOPES = [
  "instagram_business_basic",
  "instagram_business_content_publish",
  "instagram_business_manage_comments", // 댓글 트리거(DM 리드마그넷)
  "instagram_business_manage_messages", // DM 발송
  "instagram_business_manage_insights", // 인사이트 수집
];

export function igOAuthConfigured(): boolean {
  return Boolean(process.env.IG_APP_ID && process.env.IG_APP_SECRET);
}

export function buildAuthorizeUrl(redirectUri: string, state: string): string {
  const appId = process.env.IG_APP_ID;
  if (!appId) throw new Error("IG_APP_ID가 설정되지 않았어요. Meta 앱 자격증명을 환경변수에 넣어주세요.");
  const p = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: IG_OAUTH_SCOPES.join(","),
    state,
  });
  return `https://www.instagram.com/oauth/authorize?${p.toString()}`;
}

export interface OAuthTokenResult {
  accessToken: string; // 장기 토큰(약 60일)
  igUserId: string;
  expiresAt: number; // epoch ms
}

// code → 단기토큰(+user_id) → 장기토큰(약 60일) 교환까지 한 번에 처리.
export async function exchangeCodeForLongLivedToken(code: string, redirectUri: string): Promise<OAuthTokenResult> {
  const appId = process.env.IG_APP_ID;
  const appSecret = process.env.IG_APP_SECRET;
  if (!appId || !appSecret) throw new Error("IG_APP_ID/IG_APP_SECRET이 설정되지 않았어요.");

  // 1) 인증 code → 단기 토큰(+user_id)
  const shortRes = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code,
    }),
  });
  const short = (await shortRes.json().catch(() => ({}))) as {
    access_token?: string;
    user_id?: string | number;
    error_message?: string;
  };
  if (!shortRes.ok || !short.access_token) throw new Error(short.error_message || "인스타 인증 코드 교환에 실패했어요.");

  // 2) 단기 → 장기 토큰(약 60일). 엔드포인트는 버전 없는 graph.instagram.com/access_token.
  const longRes = await fetch(
    `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${appSecret}&access_token=${short.access_token}`
  );
  const long = (await longRes.json().catch(() => ({}))) as { access_token?: string; expires_in?: number } & GraphError;
  if (!longRes.ok || long.error || !long.access_token) throw new Error(long.error?.message || "장기 토큰 교환에 실패했어요.");

  const expiresIn = Number(long.expires_in) || 60 * 24 * 60 * 60; // 기본 60일(초)
  return {
    accessToken: long.access_token,
    igUserId: String(short.user_id ?? ""),
    expiresAt: Date.now() + expiresIn * 1000,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DM 자동화 — 댓글 비공개 답장(Private Replies). 댓글 작성자에게 정보 DM 발송.
//   POST {host}/me/messages  body: { recipient:{comment_id}, message:{text} }
//   ※ 콜드 DM 아님 — "키워드 댓글(옵트인)"에 대한 답장만 보낸다(정책).
// ─────────────────────────────────────────────────────────────────────────────
export async function sendPrivateReply(account: IgAccount, commentId: string, text: string): Promise<void> {
  const token = openToken(account.accessToken);
  const host = graphBase(account);
  const res = await fetch(`${host}/me/messages?access_token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipient: { comment_id: commentId }, message: { text } }),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown> & GraphError;
  if (!res.ok || data.error) throw new Error(data.error?.message || `DM 발송 실패 (${res.status})`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 인사이트 자동수집 — 연동 계정의 팔로워/게시물 지표를 Graph API 로 가져온다(읽기전용).
//   계정 단위: followers_count
//   게시물 단위: like_count·comments_count(미디어 필드) + reach·saved·shares·views·
//               profile_visits·follows(insights). 메트릭은 API 버전마다 가용성이 달라
//               단계적 폴백으로 안전하게 가져온다(일부 실패해도 가능한 것만 채움).
// ─────────────────────────────────────────────────────────────────────────────

// 우리 MetricEntry 의 지표 필드(저장/표시 공통 모양)
export interface IgMetricFields {
  views: number;
  reach: number;
  saves: number;
  shares: number;
  likes: number;
  comments: number;
  profileVisits: number;
  follows: number;
}
export interface IgMediaInsight extends IgMetricFields {
  mediaId: string;
  permalink?: string;
  timestamp?: string;
}

const ZERO_METRICS: IgMetricFields = {
  views: 0, reach: 0, saves: 0, shares: 0, likes: 0, comments: 0, profileVisits: 0, follows: 0,
};

// 계정 팔로워 수
export async function fetchAccountFollowers(account: IgAccount): Promise<number> {
  const token = openToken(account.accessToken);
  const host = graphBase(account);
  const id = account.igUserId!;
  const d = (await gGET(host, `/${id}?fields=followers_count&access_token=${token}`)) as { followers_count?: number };
  return Number(d.followers_count) || 0;
}

interface MediaNode {
  id: string;
  permalink?: string;
  timestamp?: string;
  media_type?: string;
  like_count?: number;
  comments_count?: number;
}

// 게시물 선택기용 경량 목록(캡션 포함). DM 규칙에서 "어떤 게시물" 고를 때 사용.
export interface IgMediaSummary {
  id: string;
  caption: string;
  permalink?: string;
  mediaType?: string;
  timestamp?: string;
}
export async function fetchMediaList(account: IgAccount, limit = 25): Promise<IgMediaSummary[]> {
  const token = openToken(account.accessToken);
  const host = graphBase(account);
  const id = account.igUserId!;
  const d = (await gGET(
    host,
    `/${id}/media?fields=id,caption,permalink,timestamp,media_type&limit=${limit}&access_token=${token}`
  )) as { data?: Array<MediaNode & { caption?: string }> };
  return (d.data ?? []).map((m) => ({
    id: m.id,
    caption: (m.caption || "").trim(),
    permalink: m.permalink,
    mediaType: m.media_type,
    timestamp: m.timestamp,
  }));
}

// 최근 게시물 목록(기본 필드 + 좋아요/댓글 수)
async function fetchUserMedia(account: IgAccount, limit: number): Promise<MediaNode[]> {
  const token = openToken(account.accessToken);
  const host = graphBase(account);
  const id = account.igUserId!;
  const d = (await gGET(
    host,
    `/${id}/media?fields=id,permalink,timestamp,media_type,like_count,comments_count&limit=${limit}&access_token=${token}`
  )) as { data?: MediaNode[] };
  return d.data ?? [];
}

// insights 응답을 name→number 맵으로. 신/구 포맷(values[0].value / total_value.value) 모두 대응.
function parseInsights(data: { data?: Array<{ name?: string; values?: Array<{ value?: number }>; total_value?: { value?: number } }> }): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of data.data ?? []) {
    if (!m.name) continue;
    const v = m.total_value?.value ?? m.values?.[0]?.value ?? 0;
    out[m.name] = Number(v) || 0;
  }
  return out;
}

// 단일 미디어 insights — 메트릭 셋을 풍부→최소 순으로 시도(올오어낫싱 에러 회피).
async function fetchMediaInsights(account: IgAccount, mediaId: string): Promise<Record<string, number>> {
  const token = openToken(account.accessToken);
  const host = graphBase(account);
  const ladders = [
    "reach,saved,shares,views,profile_visits,follows",
    "reach,saved,shares,impressions", // 구버전(impressions→views 로 매핑)
    "reach,saved,shares",
    "reach",
  ];
  for (const metric of ladders) {
    try {
      const d = (await gGET(host, `/${mediaId}/insights?metric=${metric}&access_token=${token}`)) as Parameters<typeof parseInsights>[0];
      return parseInsights(d);
    } catch {
      // 다음(더 보수적인) 셋으로 폴백
    }
  }
  return {};
}

// 최근 게시물들의 인사이트를 모아서 반환(계정 단위 동기화 진입점).
export async function fetchRecentMediaInsights(account: IgAccount, limit = 25): Promise<IgMediaInsight[]> {
  const media = await fetchUserMedia(account, limit);
  const out: IgMediaInsight[] = [];
  for (const m of media) {
    const ins = await fetchMediaInsights(account, m.id);
    out.push({
      ...ZERO_METRICS,
      mediaId: m.id,
      permalink: m.permalink,
      timestamp: m.timestamp,
      likes: Number(m.like_count) || 0,
      comments: Number(m.comments_count) || 0,
      reach: ins.reach ?? 0,
      saves: ins.saved ?? 0,
      shares: ins.shares ?? 0,
      views: ins.views ?? ins.impressions ?? 0,
      profileVisits: ins.profile_visits ?? 0,
      follows: ins.follows ?? 0,
    });
  }
  return out;
}

export async function publishCard(card: CardNews, account: IgAccount | undefined): Promise<PublishResult> {
  // ── 시뮬레이터(테스터) ──────────────────────────────────────────────────────
  if (!isLiveAccount(account)) {
    const slug = card.title.replace(/\s+/g, "-").slice(0, 24) || "post";
    const code = Math.random().toString(36).slice(2, 9).toUpperCase();
    const user = account?.handle?.replace(/^@/, "") || "tester";
    return { permalink: `https://instagram.com/p/${code}_${slug}_by_${user}`, publishedAt: Date.now() };
  }

  // ── 실제 발행 (Instagram / Facebook 로그인 공통 흐름, 호스트만 다름) ─────────────
  const base = publicBaseUrl();
  if (!base) throw new Error("PUBLIC_BASE_URL이 설정되지 않았어요. 인스타가 이미지를 가져갈 공개 주소가 필요합니다(ngrok 등).");
  if (!/^https:\/\//.test(base)) throw new Error("PUBLIC_BASE_URL은 https 주소여야 합니다.");

  const host = graphBase(account!);
  const igId = account!.igUserId!;
  const token = openToken(account!.accessToken); // 봉인 토큰 → 평문
  const caption = buildCaption(card);
  const reels = card.format === "릴스";

  let containerId: string;
  if (reels) {
    // 릴스: 업로드된 영상(공개 URL)으로 REELS 컨테이너 생성
    const c = (await gPOST(host, `/${igId}/media`, {
      media_type: "REELS",
      video_url: videoUrlFor(base, card.id),
      caption,
      access_token: token,
    })) as { id: string };
    containerId = c.id;
  } else {
    const pages = Math.min(card.pages.length, 10);
    if (pages <= 1) {
      const c = (await gPOST(host, `/${igId}/media`, { image_url: imageUrlFor(base, card.id, 0), caption, access_token: token })) as { id: string };
      containerId = c.id;
    } else {
      const children: string[] = [];
      for (let p = 0; p < pages; p++) {
        const child = (await gPOST(host, `/${igId}/media`, { image_url: imageUrlFor(base, card.id, p), is_carousel_item: "true", access_token: token })) as { id: string };
        children.push(child.id);
      }
      const carousel = (await gPOST(host, `/${igId}/media`, { media_type: "CAROUSEL", children: children.join(","), caption, access_token: token })) as { id: string };
      containerId = carousel.id;
    }
  }

  // 릴스 영상은 처리 시간이 더 길다
  await waitReady(host, containerId, token, reels ? 40 : 12, reels ? 2500 : 1500);
  const published = (await gPOST(host, `/${igId}/media_publish`, { creation_id: containerId, access_token: token })) as { id: string };
  const info = (await gGET(host, `/${published.id}?fields=permalink&access_token=${token}`).catch(() => ({}))) as { permalink?: string };

  return { permalink: info.permalink || "https://instagram.com/", publishedAt: Date.now() };
}
