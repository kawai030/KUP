import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";

/**
 * 세션 갱신 미들웨어 헬퍼 (Supabase SSR 표준).
 * 매 요청마다 만료 직전 세션 쿠키를 갱신해 로그인이 끊기지 않게 한다.
 * 인증/구글 공통 — 로그인 방식과 무관하게 세션 쿠키만 다룬다.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const env = publicEnv(); // dev 리팩터: publicEnv 는 lazy 함수
  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // getUser() 호출이 만료된 토큰을 자동 갱신한다(쿠키 재기록).
  await supabase.auth.getUser();

  return response;
}
