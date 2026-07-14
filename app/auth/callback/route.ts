import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { bridgeSupabaseSession } from "@/lib/workspace/supabase-bridge";

/**
 * OAuth 콜백 — 구글 로그인이 끝난 뒤 돌아오는 곳.
 * Supabase code 를 세션으로 교환 → 워크스페이스 파일DB 브릿지(세션쿠키 발급)
 * → survey 유무로 /app/home 또는 /onboarding 진입.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { ok } = await bridgeSupabaseSession();
      if (ok) {
        return NextResponse.redirect(`${origin}/app/home`);
      }
    }
  }
  // 코드 없음/교환 실패 → 온보딩(홈)으로 되돌려 로그인 모달 재오픈
  return NextResponse.redirect(`${origin}/?authError=${encodeURIComponent("로그인에 실패했어요")}`);
}
