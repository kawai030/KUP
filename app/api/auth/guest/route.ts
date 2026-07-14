import { mutateDB, uid } from "@/lib/workspace/db";
import { createSession, newUser, toPublicUser } from "@/lib/workspace/auth";
import { json } from "@/lib/workspace/api";

// 비회원으로 이용 → 비회원 워크스페이스. 데이터는 세션에 임시 보관(정식 가입 유도).
export async function POST() {
  const tag = uid("guest").slice(0, 12);
  const user = newUser({
    email: `${tag}@guest.kup`,
    name: "비회원",
    guest: true,
    authProvider: "guest",
  });
  await mutateDB((d) => d.users.push(user));
  await createSession(user.id);
  return json({ user: toPublicUser(user) });
}
