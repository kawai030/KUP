import { mutateDB, readDB } from "@/lib/workspace/db";
import { bad, json, withUser } from "@/lib/workspace/api";
import { saveCardVideo } from "@/lib/workspace/images";

type Ctx = { params: Promise<{ id: string }> };

// 릴스 영상 업로드 (multipart). 발행 시 공개 URL(/api/render-video/[id])로 인스타가 가져감.
export async function PUT(req: Request, ctx: Ctx) {
  const guard = await withUser();
  if ("res" in guard) return guard.res;
  const { id } = await ctx.params;
  const card = (await readDB()).cards.find((c) => c.id === id && c.userId === guard.user.id);
  if (!card) return bad("카드를 찾을 수 없습니다.", 404);
  if (card.format !== "릴스") return bad("릴스만 영상을 업로드할 수 있어요.", 409);

  const form = await req.formData().catch(() => null);
  const file = form?.get("video");
  if (!(file instanceof File)) return bad("영상 파일이 없습니다.");
  if (!file.type.startsWith("video/")) return bad("영상 파일만 업로드할 수 있어요.");

  const buf = Buffer.from(await file.arrayBuffer());
  await saveCardVideo(id, buf);
  await mutateDB((db) => {
    const c = db.cards.find((x) => x.id === id && x.userId === guard.user.id);
    if (c) {
      c.hasVideo = true;
      c.updatedAt = Date.now();
    }
  });
  return json({ ok: true, sizeBytes: buf.length, name: file.name });
}
