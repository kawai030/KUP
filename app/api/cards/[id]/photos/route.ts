import { readDB } from "@/lib/workspace/db";
import { bad, json, withUser } from "@/lib/workspace/api";
import { listCardPhotoPages } from "@/lib/workspace/images";

type Ctx = { params: Promise<{ id: string }> };

// 이 카드에서 사용자 사진이 업로드된 페이지 번호 목록
export async function GET(_req: Request, ctx: Ctx) {
  const guard = await withUser();
  if ("res" in guard) return guard.res;
  const { id } = await ctx.params;
  const card = (await readDB()).cards.find((c) => c.id === id && c.userId === guard.user.id);
  if (!card) return bad("카드를 찾을 수 없습니다.", 404);
  return json({ pages: await listCardPhotoPages(id) });
}
