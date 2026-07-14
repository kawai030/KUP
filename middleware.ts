import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * 루트 미들웨어 — 모든 요청에서 Supabase 세션 쿠키를 갱신(로그인 유지).
 * 정적 파일/이미지는 제외. (인증 게이팅은 추후 여기 또는 레이아웃에서 추가)
 */
export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // _next 정적·이미지, 파비콘, 흔한 이미지 확장자 제외하고 전부
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
