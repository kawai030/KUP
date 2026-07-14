import { mutateDB } from "@/lib/workspace/db";
import { destroySession } from "@/lib/workspace/auth";
import { hashPassword, toPublicUser, verifyPassword } from "@/lib/workspace/auth";
import { bad, json, withUser } from "@/lib/workspace/api";
import type { BillingCycle, Plan } from "@/lib/workspace/types";

const PW_RE = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,16}$/;

// 프로필·구독·동의·온보딩·비밀번호 변경
export async function PATCH(req: Request) {
  const guard = await withUser();
  if ("res" in guard) return guard.res;
  const b = (await req.json().catch(() => null)) as {
    plan?: Plan;
    billingCycle?: BillingCycle;
    marketingConsent?: boolean;
    onboarded?: boolean;
    name?: string;
    passwordCurrent?: string;
    passwordNew?: string;
  } | null;
  if (!b) return bad("잘못된 요청입니다.");

  // 비밀번호 변경은 검증 먼저
  if (b.passwordNew !== undefined) {
    if (guard.user.authProvider !== "email") return bad("이메일 가입 계정만 비밀번호를 변경할 수 있어요.", 409);
    if (!verifyPassword(b.passwordCurrent || "", guard.user.passwordHash, guard.user.passwordSalt))
      return bad("현재 비밀번호가 올바르지 않습니다.", 401);
    if (!PW_RE.test(b.passwordNew)) return bad("새 비밀번호는 영문·숫자·특수문자 포함 8~16자여야 합니다.");
  }

  const updated = await mutateDB((db) => {
    const u = db.users.find((x) => x.id === guard.user.id);
    if (!u) return null;
    if (b.plan && ["베이직", "프로", "프리미엄"].includes(b.plan)) {
      u.plan = b.plan;
      u.subscribedAt = b.plan === "베이직" ? undefined : Date.now();
    }
    if (b.billingCycle === "월" || b.billingCycle === "연") u.billingCycle = b.billingCycle;
    if (typeof b.marketingConsent === "boolean") u.marketingConsent = b.marketingConsent;
    if (typeof b.onboarded === "boolean") u.onboarded = b.onboarded;
    if (typeof b.name === "string" && b.name.trim() && b.name.trim().length <= 10) u.name = b.name.trim();
    if (b.passwordNew !== undefined) {
      const { hash, salt } = hashPassword(b.passwordNew);
      u.passwordHash = hash;
      u.passwordSalt = salt;
    }
    return u;
  });
  if (!updated) return bad("사용자를 찾을 수 없습니다.", 404);
  return json({ user: toPublicUser(updated) });
}

// 데이터/계정 삭제. scope: "account"(회원탈퇴) | "data"(프로젝트 데이터, period 일수)
export async function DELETE(req: Request) {
  const guard = await withUser();
  if ("res" in guard) return guard.res;
  const b = (await req.json().catch(() => ({}))) as { scope?: "account" | "data"; period?: "all" | "1" | "7" | "30" };

  if (b.scope === "account") {
    await mutateDB((db) => {
      const uidv = guard.user.id;
      db.users = db.users.filter((u) => u.id !== uidv);
      db.sessions = db.sessions.filter((s) => s.userId !== uidv);
      db.cards = db.cards.filter((c) => c.userId !== uidv);
      db.publishJobs = db.publishJobs.filter((j) => j.userId !== uidv);
      db.metrics = db.metrics.filter((m) => m.userId !== uidv);
      db.dmRules = db.dmRules.filter((d) => d.userId !== uidv);
      delete db.strategies[uidv];
    });
    await destroySession();
    return json({ ok: true, loggedOut: true });
  }

  // data deletion: period "all"=전체, "N"=N일 이전(오래된) 데이터 삭제
  const days = b.period === "all" ? Infinity : Number(b.period || "0");
  const cutoff = days === Infinity ? Infinity : days * 24 * 60 * 60 * 1000;
  // keep = 보존할 것: 내 데이터가 아니거나(다른 사용자), 충분히 최근이면 보존
  const keep = (uidv: string, ownerId: string, ts: number) =>
    ownerId !== uidv || (cutoff !== Infinity && Date.now() - ts < cutoff);
  const removed = await mutateDB((db) => {
    const uidv = guard.user.id;
    const before = db.cards.filter((c) => c.userId === uidv).length;
    db.cards = db.cards.filter((c) => keep(uidv, c.userId, c.createdAt));
    db.publishJobs = db.publishJobs.filter((j) => keep(uidv, j.userId, j.createdAt));
    db.metrics = db.metrics.filter((m) => keep(uidv, m.userId, m.createdAt));
    return before - db.cards.filter((c) => c.userId === uidv).length;
  });
  return json({ ok: true, removed });
}
