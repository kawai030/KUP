import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { withUser, bad } from "@/lib/workspace/api";
import { buildAuthorizeUrl, igOAuthConfigured } from "@/lib/workspace/ig";

// 인스타 OAuth 시작 — "인스타로 로그인" 버튼이 이 주소로 이동한다.
//  1) CSRF 방지용 state 생성 → httpOnly 쿠키에 저장
//  2) 인스타 authorize 화면으로 리다이렉트
export async function GET(req: Request) {
  const guard = await withUser();
  if ("res" in guard) return guard.res;
  if (!igOAuthConfigured()) return bad("인스타 앱 자격증명(IG_APP_ID/IG_APP_SECRET)이 설정되지 않았어요.", 503);

  // 등록된 redirect_uri 와 정확히 일치해야 함. env 우선, 없으면 현재 출처로 유도.
  const redirectUri = process.env.IG_OAUTH_REDIRECT_URI || new URL("/api/ig/oauth/callback", req.url).toString();

  const state = randomBytes(16).toString("hex");
  const store = await cookies();
  store.set("ig_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10분
  });

  return Response.redirect(buildAuthorizeUrl(redirectUri, state), 302);
}
