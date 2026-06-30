import { mutateDB, readDB } from "@/lib/db";
import { createSession, hashPassword, newUser, toPublicUser } from "@/lib/auth";
import { bad, json } from "@/lib/api";

const PW_RE = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,16}$/;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    email?: string;
    password?: string;
    name?: string;
    agreeTerms?: boolean;
    agreePrivacy?: boolean;
    agreeMeta?: boolean;
    marketingConsent?: boolean;
  } | null;
  if (!body) return bad("잘못된 요청입니다.");

  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";
  const name = (body.name || "").trim();

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return bad("이메일 형식을 확인하세요.");
  if (!PW_RE.test(password)) return bad("비밀번호는 영문·숫자·특수문자 포함 8~16자여야 합니다.");
  if (!name || name.length > 10) return bad("닉네임은 10자 이내로 입력하세요.");
  if (!(body.agreeTerms && body.agreePrivacy && body.agreeMeta))
    return bad("필수 약관(이용약관·개인정보·Meta 연동)에 동의해야 합니다.", 409);

  const db = readDB();
  if (db.users.find((u) => u.email === email)) return bad("이미 가입된 이메일입니다.");
  if (db.users.find((u) => u.name === name && !u.guest)) return bad("이미 사용 중인 닉네임입니다.");

  const { hash, salt } = hashPassword(password);
  const user = newUser({
    email,
    name,
    passwordHash: hash,
    passwordSalt: salt,
    authProvider: "email",
    marketingConsent: !!body.marketingConsent,
  });
  mutateDB((d) => d.users.push(user));
  await createSession(user.id);
  return json({ user: toPublicUser(user) });
}
