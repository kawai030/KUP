import { readDB } from "@/lib/db";
import { bad, json, withUser } from "@/lib/api";
import { deleteCardPhoto, readCardPhoto, saveCardPhoto } from "@/lib/images";

type Ctx = { params: Promise<{ id: string; page: string }> };

async function ownCard(userId: string, id: string) {
  return readDB().cards.find((c) => c.id === id && c.userId === userId);
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
  saveCardPhoto(id, Number(page), buf);
  return json({ ok: true, sizeBytes: buf.length });
}

export async function GET(_req: Request, ctx: Ctx) {
  const guard = await withUser();
  if ("res" in guard) return guard.res;
  const { id, page } = await ctx.params;
  if (!(await ownCard(guard.user.id, id))) return bad("카드를 찾을 수 없습니다.", 404);
  const buf = readCardPhoto(id, Number(page));
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
  deleteCardPhoto(id, Number(page));
  return json({ ok: true });
}
