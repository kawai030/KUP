import { createHmac, timingSafeEqual } from "crypto";
import { readDB, mutateDB } from "@/lib/workspace/db";
import { sendPrivateReply } from "@/lib/workspace/ig";
import { DM_LIMITS, renderDmMessage, type IgAccount, type User } from "@/lib/workspace/types";

// 인스타 웹훅 — 댓글 → DM 리드마그넷 자동화.
//  GET  : 웹훅 등록 검증(hub.challenge 에코)
//  POST : 댓글 이벤트 수신 → 규칙 매칭 → 비공개 답장(DM) 발송
//
// Meta 앱 대시보드 → Webhooks(Instagram) 에 등록:
//   콜백 URL    : https://<공개주소>/api/ig/webhook
//   Verify token: IG_WEBHOOK_VERIFY_TOKEN 과 동일
//   구독 필드   : comments
// (로컬은 공개 https 가 필요 — 터널/배포 후 등록)

// 같은 댓글 재처리 방지(프로세스 메모리 — 파일DB 단계용. 서버리스에선 영속 저장 필요).
const handled = new Set<string>();

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token && token === process.env.IG_WEBHOOK_VERIFY_TOKEN) {
    return new Response(challenge ?? "", { status: 200, headers: { "content-type": "text/plain" } });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(req: Request) {
  const raw = await req.text();

  // 서명 검증 (X-Hub-Signature-256: sha256=...). APP_SECRET 없으면 생략(개발).
  const secret = process.env.IG_APP_SECRET;
  if (secret) {
    const sig = req.headers.get("x-hub-signature-256") || "";
    const expected = "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");
    const ok = sig.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    if (!ok) return new Response("Forbidden", { status: 403 });
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("EVENT_RECEIVED", { status: 200 }); // 잘못된 본문도 200(재전송 방지)
  }

  // 인스타에 빠르게 200을 주는 게 원칙이나, 서버리스 호환을 위해 처리 후 응답.
  try {
    await processWebhook(payload);
  } catch (e) {
    console.error("[ig-webhook] 처리 오류:", (e as Error).message);
  }
  return new Response("EVENT_RECEIVED", { status: 200 });
}

interface WebhookPayload {
  object?: string;
  entry?: Array<{ id?: string; changes?: Array<{ field?: string; value?: CommentValue }> }>;
}
interface CommentValue {
  id?: string; // comment_id
  text?: string;
  from?: { id?: string; username?: string };
  media?: { id?: string };
}

async function processWebhook(payload: WebhookPayload): Promise<void> {
  if (payload.object !== "instagram") return;
  for (const entry of payload.entry ?? []) {
    const recipientIgId = String(entry.id ?? ""); // 댓글이 달린 내 계정의 IG user id
    for (const change of entry.changes ?? []) {
      if (change.field === "comments" && change.value) await handleComment(recipientIgId, change.value);
    }
  }
}

// IG user id 로 우리 사용자+계정 찾기
async function findByIgUserId(igUserId: string): Promise<{ user: User; account: IgAccount } | null> {
  if (!igUserId) return null;
  for (const user of (await readDB()).users) {
    const account = user.igAccounts.find((a) => a.igUserId === igUserId);
    if (account) return { user, account };
  }
  return null;
}

async function handleComment(recipientIgId: string, value: CommentValue): Promise<void> {
  const commentId = value.id;
  const text = value.text || "";
  const fromId = value.from?.id;
  if (!commentId || handled.has(commentId)) return;

  const ctx = await findByIgUserId(recipientIgId);
  if (!ctx) return; // 우리 시스템에 없는 계정
  const { user, account } = ctx;

  // 내 계정이 단 댓글은 무시(무한루프 방지)
  if (fromId && account.igUserId && String(fromId) === String(account.igUserId)) return;

  // 매칭 규칙: 활성 + 옵트인 + 키워드 포함(대소문자 무시) + 게시물(mediaId) 일치
  //   - rule.mediaId 가 있으면 그 게시물 댓글에만, 없으면 전체 게시물에 적용
  const mediaId = value.media?.id;
  const rules = (await readDB()).dmRules.filter((r) => r.userId === user.id && r.enabled && r.optIn);
  const rule = rules.find(
    (r) =>
      r.triggerKeyword &&
      text.toLowerCase().includes(r.triggerKeyword.toLowerCase()) &&
      (!r.mediaId || r.mediaId === mediaId)
  );
  if (!rule) return;

  // 플랜 DM 한도 확인
  const limit = DM_LIMITS[user.plan];
  const used = (await readDB()).dmRules.filter((r) => r.userId === user.id).reduce((s, r) => s + r.sentCount, 0);
  if (used >= limit) {
    console.warn(`[ig-webhook] DM 한도 초과(user=${user.id}, plan=${user.plan})`);
    return;
  }

  handled.add(commentId); // 실패 시 아래에서 해제
  const message = renderDmMessage(rule.dmMessage, rule.resourceLink);
  try {
    await sendPrivateReply(account, commentId, message);
    await mutateDB((db) => {
      const r = db.dmRules.find((x) => x.id === rule.id);
      if (r) r.sentCount += 1;
    });
    console.log(`[ig-webhook] DM 발송: rule=${rule.id} comment=${commentId}`);
  } catch (e) {
    handled.delete(commentId);
    console.error(`[ig-webhook] DM 발송 실패: ${(e as Error).message}`);
  }
}

