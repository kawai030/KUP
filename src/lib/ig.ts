import type { CardNews, IgAccount } from "./types";
import { isLiveAccount } from "./types";

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
  const token = account!.accessToken!;
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
