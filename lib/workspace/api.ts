import { getCurrentUser } from "./auth";
import type { User } from "./types";

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function bad(message: string, status = 400): Response {
  return json({ error: message }, status);
}

// 인증이 필요한 라우트 가드. 실패 시 Response, 성공 시 User 반환.
export async function withUser(): Promise<{ user: User } | { res: Response }> {
  const user = await getCurrentUser();
  if (!user) return { res: bad("로그인이 필요합니다.", 401) };
  return { user };
}
