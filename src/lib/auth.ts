import { scryptSync, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { mutateDB, readDB, uid } from "./db";
import type { PublicUser, User } from "./types";

const COOKIE = "onekup_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30일

export function newUser(partial: Partial<User> & { email: string; name: string }): User {
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
    igAccounts: [],
    onboarded: false,
    createdAt: Date.now(),
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
  mutateDB((db) => {
    db.sessions.push({ token, userId, createdAt: Date.now() });
  });
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) {
    mutateDB((db) => {
      db.sessions = db.sessions.filter((s) => s.token !== token);
    });
  }
  store.delete(COOKIE);
}

export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  const db = readDB();
  const session = db.sessions.find((s) => s.token === token);
  if (!session) return null;
  return db.users.find((u) => u.id === session.userId) ?? null;
}

export async function requireUser(): Promise<User | null> {
  return getCurrentUser();
}
