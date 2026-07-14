import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** 로그아웃 — 세션 종료 후 홈("/")으로. (form action="/auth/signout" method="post") */
export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
