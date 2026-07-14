import { cookies } from "next/headers";
import { mutateDB, uid } from "@/lib/workspace/db";
import { getCurrentUser } from "@/lib/workspace/auth";
import { sealToken } from "@/lib/workspace/crypto";
import { exchangeCodeForLongLivedToken, verifyConnection } from "@/lib/workspace/ig";
import type { IgAccount } from "@/lib/workspace/types";

// 인스타 OAuth 콜백 — authorize 동의 후 인스타가 code 와 함께 이 주소로 되돌려보낸다.
//  code → 장기 토큰 교환 → 사용자명 확인 → 계정 저장(봉인 토큰) → /app/accounts 로 복귀.
//  실패는 항상 /app/accounts?error=... 로 안내(흰 화면 대신).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (params: Record<string, string>) => {
    const u = new URL("/app/accounts", url.origin);
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    return Response.redirect(u.toString(), 302);
  };

  // 사용자가 인스타에서 거부했거나 인스타 쪽 오류
  const oauthError = url.searchParams.get("error_description") || url.searchParams.get("error");
  if (oauthError) return back({ ig_error: oauthError });

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code) return back({ ig_error: "인증 코드가 없어요. 다시 시도해 주세요." });

  // CSRF: start 에서 심은 state 쿠키와 대조
  const store = await cookies();
  const expected = store.get("ig_oauth_state")?.value;
  store.delete("ig_oauth_state");
  if (!expected || expected !== state) return back({ ig_error: "잘못된 요청(state 불일치)입니다. 다시 시도해 주세요." });

  const user = await getCurrentUser();
  if (!user) return back({ ig_error: "로그인이 필요합니다." });

  try {
    const redirectUri = process.env.IG_OAUTH_REDIRECT_URI || new URL("/api/ig/oauth/callback", url.origin).toString();
    const tok = await exchangeCodeForLongLivedToken(code, redirectUri);
    // 사용자명/계정 확인(Instagram 로그인 → graph.instagram.com/me)
    const v = await verifyConnection(tok.accessToken);

    const updated = await mutateDB((db) => {
      const u = db.users.find((x) => x.id === user.id);
      if (!u) return null;
      const handle = v.username || v.igUserId;
      const existing = u.igAccounts.find((a) => a.igUserId === v.igUserId || a.handle === handle);
      const fields = {
        handle,
        mode: "정식" as const,
        loginType: "instagram" as const,
        igUserId: v.igUserId,
        accessToken: sealToken(tok.accessToken),
        tokenExpiresAt: tok.expiresAt,
      };
      if (existing) {
        Object.assign(existing, fields); // 같은 계정 재연동 → 자격증명 갱신
        if (!u.activeIgAccountId) u.activeIgAccountId = existing.id;
      } else {
        const acc: IgAccount = { id: uid("ig"), connectedAt: Date.now(), ...fields };
        u.igAccounts.push(acc);
        if (!u.activeIgAccountId) u.activeIgAccountId = acc.id;
      }
      return u;
    });
    if (!updated) return back({ ig_error: "사용자를 찾을 수 없습니다." });

    return back({ ig_connected: v.username || "1" });
  } catch (e) {
    return back({ ig_error: (e as Error).message });
  }
}
