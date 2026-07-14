import { readDB } from "@/lib/workspace/db";
import { bad, json, withUser } from "@/lib/workspace/api";
import { saveCardImages } from "@/lib/workspace/images";

type Ctx = { params: Promise<{ id: string }> };

// 브라우저가 렌더한 카드 JPEG(data URL 배열)를 저장. 발행 직전에 호출.
export async function PUT(req: Request, ctx: Ctx) {
  const guard = await withUser();
  if ("res" in guard) return guard.res;
  const { id } = await ctx.params;
  const card = (await readDB()).cards.find((c) => c.id === id && c.userId === guard.user.id);
  if (!card) return bad("카드를 찾을 수 없습니다.", 404);

  const body = (await req.json().catch(() => null)) as { images?: string[] } | null;
  if (!body?.images?.length) return bad("이미지가 없습니다.");
  const n = await saveCardImages(id, body.images);
  return json({ ok: true, count: n });
}
