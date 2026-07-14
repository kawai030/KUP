import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";
import type { Database } from "@/lib/db/database.types";

/**
 * service_role 클라이언트 — RLS 우회.
 * 발행·웹훅·인사이트 수집 워커만 사용(데이터모델 §6). 브라우저 노출 절대 금지.
 */
export function createAdminClient() {
  const env = serverEnv();
  return createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );
}
