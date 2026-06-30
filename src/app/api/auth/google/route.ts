import { mutateDB, readDB } from "@/lib/db";
import { createSession, newUser, toPublicUser } from "@/lib/auth";
import { json } from "@/lib/api";

// 구글 연동 로그인/가입 (스텁). 정식: Google OAuth 2.0 동의 화면 → id_token 검증.
// 베타: 모의 구글 계정으로 로그인/가입 흐름을 검증한다.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: string; name?: string };
  const email = (body.email || `google_user_${Math.random().toString(36).slice(2, 7)}@gmail.com`).toLowerCase();
  const existing = readDB().users.find((u) => u.email === email);
  if (existing) {
    await createSession(existing.id);
    return json({ user: toPublicUser(existing) });
  }
  const name = (body.name || email.split("@")[0]).slice(0, 10);
  const user = newUser({ email, name, authProvider: "google", marketingConsent: false });
  mutateDB((d) => d.users.push(user));
  await createSession(user.id);
  return json({ user: toPublicUser(user) });
}
