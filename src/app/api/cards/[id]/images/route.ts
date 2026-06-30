import { readDB } from "@/lib/db";
import { bad, json, withUser } from "@/lib/api";
import { saveCardImages } from "@/lib/images";

type Ctx = { params: Promise<{ id: string }> };

// 브라우저가 렌더한 카드 JPEG(data URL 배열)를 저장. 발행 직전에 호출.
export async function PUT(req: Request, ctx: Ctx) {
  const guard = await withUser();
  if ("res" in guard) return guard.res;
  const { id } = await ctx.params;
  const card = readDB().cards.find((c) => c.id === id && c.userId === guard.user.id);
  if (!card) return bad("카드를 찾을 수 없습니다.", 404);

  const body = (await req.json().catch(() => null)) as { images?: string[] } | null;
  if (!body?.images?.length) return bad("이미지가 없습니다.");
  const n = saveCardImages(id, body.images);
  return json({ ok: true, count: n });
}
