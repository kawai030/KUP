import { readDB } from "@/lib/db";
import { createSession, toPublicUser, verifyPassword } from "@/lib/auth";
import { bad, json } from "@/lib/api";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { email?: string; password?: string }
    | null;
  if (!body) return bad("잘못된 요청입니다.");
  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";

  const user = readDB().users.find((u) => u.email === email);
  if (!user || !verifyPassword(password, user.passwordHash, user.passwordSalt)) {
    return bad("이메일 또는 비밀번호가 올바르지 않습니다.", 401);
  }
  await createSession(user.id);
  return json({ user: toPublicUser(user) });
}
