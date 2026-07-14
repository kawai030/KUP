import { scryptSync, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { mutateDB, readDB, uid } from "./db";
import type { PublicUser, User } from "./types";

const COOKIE = "onekup_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30일

/**
 * 데모 연동 계정 시드 — **게스트(둘러보기) 전용**. 워크스페이스를 데이터와 함께 미리 보여주기 위함.
 * ⚠️ 실유저(구글/이메일)에게는 절대 심지 않는다 — 각자 자기 인스타를 OAuth 로 실제 연동해야 하므로.
 */
// (제거됨) 게스트에게 데모 인스타 계정을 심던 시드.
// 실제로 연동하지도 않은 계정이 "이미 등록됨"으로 보여 혼란스러워서 없앴다.
// 게스트도 실유저와 동일하게 '연동 계정 0개'인 빈 상태로 시작한다.

export function newUser(partial: Partial<User> & { email: string; name: string }): User {
  const now = Date.now();
  return {
    id: uid("user"),
    email: partial.email,
    name: partial.name,
    passwordHash: partial.passwordHash ?? "",
    passwordSalt: partial.passwordSalt ?? "",
    guest: partial.guest ?? false,
    authProvider: partial.authProvider ?? "email",
    marketingConsent: partial.marketingConsent ?? false,
    plan: "베이직",
    billingCycle: "월",
    // 게스트·실유저 모두 빈 상태로 시작 — 자기 인스타를 직접 연동한다.
    igAccounts: [],
    activeIgAccountId: undefined,
    onboarded: false,
    createdAt: now,
  };
}

export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

export function toPublicUser(user: User): PublicUser {
  const { passwordHash: _h, passwordSalt: _s, ...rest } = user;
  // 액세스 토큰은 클라이언트로 보내지 않는다(서버 전용)
  return {
    ...rest,
    igAccounts: rest.igAccounts.map((a) => ({ ...a, accessToken: a.accessToken ? "" : undefined })),
  };
}

export async function createSession(userId: string): Promise<void> {
  const token = uid("sess") + randomBytes(16).toString("hex");
  const now = Date.now();
  await mutateDB((db) => {
    // 만료된 세션 정리(무한 누적 방지) — 쓰기가 일어나는 로그인 시점에만 수행(읽기 경로엔 부담 X)
    db.sessions = db.sessions.filter((s) => now - s.createdAt <= COOKIE_MAX_AGE * 1000);
    db.sessions.push({ token, userId, createdAt: now });
  });
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // 프로덕션(HTTPS)에선 secure 쿠키
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) {
    await mutateDB((db) => {
      db.sessions = db.sessions.filter((s) => s.token !== token);
    });
  }
  store.delete(COOKIE);
}

export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  const db = (await readDB());
  const session = db.sessions.find((s) => s.token === token);
  if (!session) return null;
  // 서버측 만료 검사 — 쿠키가 남아 있어도 발급 후 30일 지난 세션은 무효(토큰 무기한 유효 방지)
  if (Date.now() - session.createdAt > COOKIE_MAX_AGE * 1000) return null;
  return db.users.find((u) => u.id === session.userId) ?? null;
}

export async function requireUser(): Promise<User | null> {
  return getCurrentUser();
}
