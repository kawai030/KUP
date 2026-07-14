import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";
import type { Database } from "@/lib/db/database.types";

/**
 * 브라우저(클라이언트 컴포넌트)용 Supabase 클라이언트.
 * anon 키 + RLS로 본인 데이터만 접근(데이터모델 §6).
 */
export function createClient() {
  const env = publicEnv();
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
