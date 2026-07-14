import { readDB } from "@/lib/workspace/db";
import { bad, json, withUser } from "@/lib/workspace/api";
import { deleteCardPhoto, readCardPhoto, saveCardPhoto } from "@/lib/workspace/images";

type Ctx = { params: Promise<{ id: string; page: string }> };

async function ownCard(userId: string, id: string) {
  return (await readDB()).cards.find((c) => c.id === id && c.userId === userId);
}

// 페이지별 사용자 첨부 사진 — 업로드/조회/삭제 (소유자 인증)
export async function PUT(req: Request, ctx: Ctx) {
  const guard = await withUser();
  if ("res" in guard) return guard.res;
  const { id, page } = await ctx.params;
  if (!(await ownCard(guard.user.id, id))) return bad("카드를 찾을 수 없습니다.", 404);

  const form = await req.formData().catch(() => null);
  const file = form?.get("photo");
  if (!(file instanceof File)) return bad("사진 파일이 없습니다.");
  if (!file.type.startsWith("image/")) return bad("이미지 파일만 업로드할 수 있어요.");
  const buf = Buffer.from(await file.arrayBuffer());
  await saveCardPhoto(id, Number(page), buf);
  return json({ ok: true, sizeBytes: buf.length });
}

export async function GET(_req: Request, ctx: Ctx) {
  const guard = await withUser();
  if ("res" in guard) return guard.res;
  const { id, page } = await ctx.params;
  if (!(await ownCard(guard.user.id, id))) return bad("카드를 찾을 수 없습니다.", 404);
  const buf = await readCardPhoto(id, Number(page));
  if (!buf) return new Response("not found", { status: 404 });
  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: { "content-type": "image/jpeg", "cache-control": "no-store" },
  });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const guard = await withUser();
  if ("res" in guard) return guard.res;
  const { id, page } = await ctx.params;
  if (!(await ownCard(guard.user.id, id))) return bad("카드를 찾을 수 없습니다.", 404);
  await deleteCardPhoto(id, Number(page));
  return json({ ok: true });
}
