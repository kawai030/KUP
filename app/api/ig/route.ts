import { mutateDB, uid } from "@/lib/workspace/db";
import { toPublicUser } from "@/lib/workspace/auth";
import { bad, json, withUser } from "@/lib/workspace/api";
import { verifyConnection } from "@/lib/workspace/ig";
import { sealToken } from "@/lib/workspace/crypto";
import type { IgAccount } from "@/lib/workspace/types";

// 인스타 계정 연동 (다중).
//  - 테스터(시뮬레이션): handle 만 입력
//  - 정식(Instagram 로그인): accessToken 만 입력 → IG User ID·사용자명 자동 확보
//  - 정식(Facebook 로그인): igUserId + accessToken 입력
// POST: 계정 추가 / PATCH: 활성 계정 전환 / DELETE: 연동 해제
export async function POST(req: Request) {
  const guard = await withUser();
  if ("res" in guard) return guard.res;
  const b = (await req.json().catch(() => null)) as
    | { handle?: string; igUserId?: string; accessToken?: string }
    | null;

  const inputIgUserId = (b?.igUserId || "").trim();
  const accessToken = (b?.accessToken || "").trim();
  let handle = (b?.handle || "").replace(/^@/, "").trim();
  const live = Boolean(accessToken);

  let loginType: "instagram" | "facebook" | undefined;
  let igUserId: string | undefined;
  if (live) {
    try {
      const v = await verifyConnection(accessToken, inputIgUserId || undefined);
      igUserId = v.igUserId;
      loginType = v.loginType;
      handle = v.username || handle || v.igUserId;
    } catch (e) {
      return bad((e as Error).message, 400);
    }
  } else if (!handle) {
    return bad("인스타 핸들을 입력하거나, 정식 연동 토큰을 입력하세요.");
  }

  const acc: IgAccount = {
    id: uid("ig"),
    handle,
    mode: live ? "정식" : "테스터베타",
    loginType: live ? loginType : undefined,
    igUserId: live ? igUserId : undefined,
    accessToken: live ? sealToken(accessToken) : undefined, // 봉인 저장
    connectedAt: Date.now(),
  };

  const updated = await mutateDB((db) => {
    const u = db.users.find((x) => x.id === guard.user.id);
    if (!u) return null;
    const existing = u.igAccounts.find((a) => a.handle === handle);
    if (existing) {
      // 같은 핸들 재연동 시 자격증명 갱신
      existing.mode = acc.mode;
      existing.loginType = acc.loginType;
      existing.igUserId = acc.igUserId;
      existing.accessToken = acc.accessToken;
      if (!u.activeIgAccountId) u.activeIgAccountId = existing.id;
      return u;
    }
    u.igAccounts.push(acc);
    if (!u.activeIgAccountId) u.activeIgAccountId = acc.id;
    return u;
  });
  if (!updated) return bad("사용자를 찾을 수 없습니다.", 404);
  return json({ user: toPublicUser(updated) });
}

export async function PATCH(req: Request) {
  const guard = await withUser();
  if ("res" in guard) return guard.res;
  const b = (await req.json().catch(() => null)) as { activeId?: string } | null;
  if (!b?.activeId) return bad("activeId가 필요합니다.");
  const updated = await mutateDB((db) => {
    const u = db.users.find((x) => x.id === guard.user.id);
    if (!u || !u.igAccounts.some((a) => a.id === b.activeId)) return null;
    u.activeIgAccountId = b.activeId;
    return u;
  });
  if (!updated) return bad("계정을 찾을 수 없습니다.", 404);
  return json({ user: toPublicUser(updated) });
}

export async function DELETE(req: Request) {
  const guard = await withUser();
  if ("res" in guard) return guard.res;
  const b = (await req.json().catch(() => null)) as { id?: string } | null;
  if (!b?.id) return bad("id가 필요합니다.");
  const updated = await mutateDB((db) => {
    const u = db.users.find((x) => x.id === guard.user.id);
    if (!u) return null;
    u.igAccounts = u.igAccounts.filter((a) => a.id !== b.id);
    if (u.activeIgAccountId === b.id) u.activeIgAccountId = u.igAccounts[0]?.id;
    return u;
  });
  if (!updated) return bad("사용자를 찾을 수 없습니다.", 404);
  return json({ user: toPublicUser(updated) });
}
