import { destroySession } from "@/lib/workspace/auth";
import { createClient } from "@/lib/supabase/server";
import { json } from "@/lib/workspace/api";

// 완전 로그아웃 — 두 세션을 모두 종료한다.
//  1) onekup_session (워크스페이스 파일/blob DB 세션)
//  2) Supabase Auth 세션 (구글/이메일 로그인). 안 지우면 미들웨어가 계속 살려서 로그아웃이 안 먹는다.
export async function POST() {
  await destroySession();
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    /* Supabase 미구성(게스트/로컬 파일DB)이면 무시 */
  }
  return json({ ok: true });
}
