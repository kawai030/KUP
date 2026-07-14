"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { bridgeSupabaseSession } from "@/lib/workspace/supabase-bridge";
import { createSession, newUser } from "@/lib/workspace/auth";
import { mutateDB } from "@/lib/workspace/db";

/**
 * 인증 서버 액션 — 세션 발급은 Supabase Auth가 담당.
 * 로그인 진입점은 오직 온보딩(홈 "/") 팝업 모달 하나. 별도 로그인 페이지는 없다.
 * 실패 시 홈으로 되돌리고 `?authError=`로 모달을 다시 띄워 사유를 보여준다.
 */

/** 로그인/가입 실패 → 홈으로 되돌려 모달 재오픈(+에러 표시) */
function backToModal(message: string): never {
  redirect(`/?authError=${encodeURIComponent(message)}`);
}

/** 구글 OAuth 시작 → 구글 동의 화면 → /auth/callback 에서 세션 교환 + 브릿지 */
export async function signInWithGoogle() {
  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? "http://localhost:3000";
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
      // 로그아웃 후 재로그인 시 구글이 조용히 재인증하지 않도록 계정 선택창을 항상 띄운다.
      // (지속 로그인 편의는 유지 — 유효 쿠키로 재방문하면 이 경로를 안 타고 바로 워크스페이스)
      queryParams: { prompt: "select_account" },
    },
  });
  if (error) backToModal(error.message);
  if (data?.url) redirect(data.url);
}

/** Supabase 세션 확보 후 워크스페이스 진입 — 설문 강제 없이 홈으로(설문은 홈에서 유도) */
async function enterWorkspace(): Promise<never> {
  const { ok, survey } = await bridgeSupabaseSession();
  if (!ok) backToModal("세션을 만들지 못했어요");
  redirect(survey ? "/app/home" : "/onboarding");
}

/** 이메일/비번 로그인 */
export async function signInWithPassword(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
  if (error) backToModal(error.message);
  await enterWorkspace();
}

/** 이메일/비번 가입 (로컬은 자동 확인 → 바로 세션) */
export async function signUpWithPassword(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
  if (error) backToModal(error.message);
  await enterWorkspace();
}

/**
 * 비회원으로 둘러보기 — Supabase 없이 파일DB 게스트 세션만 발급(화면 구경용).
 * Supabase가 안 떠 있어도 워크스페이스를 볼 수 있게 하는 폴백.
 */
export async function continueAsGuest() {
  const guest = newUser({
    email: `guest_${Date.now().toString(36)}@kup.local`,
    name: "게스트",
    guest: true,
  });
  await mutateDB((d) => d.users.push(guest));
  await createSession(guest.id);
  redirect("/app/home");
}
