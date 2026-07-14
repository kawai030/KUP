import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/decks  — 저장된 deck 목록 (최신순).
 *   개발/테스트용: admin(service_role) 클라이언트로 RLS 우회해 전체를 본다.
 *   TODO(인증): 로그인 사용자 기준(createClient + RLS, channel.user_id=auth.uid())으로 교체.
 *   응답: { count, decks: DeckRow[] }
 */
export const runtime = "nodejs";

export async function GET() {
  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("decks")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ count: data.length, decks: data });
  } catch (e) {
    // serverEnv() 가 키 부재로 던지면 여기서 잡힌다(= .env.local 미설정 안내).
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
