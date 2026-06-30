import { readCardImage } from "@/lib/images";

type Ctx = { params: Promise<{ id: string; page: string }> };

// 공개 라우트(인증 없음) — 인스타 Graph API 가 image_url 로 가져갈 수 있어야 한다.
// 저장된 카드 페이지 JPEG 를 그대로 서빙한다.
export async function GET(_req: Request, ctx: Ctx) {
  const { id, page } = await ctx.params;
  const buf = readCardImage(id, Number(page));
  if (!buf) return new Response("not found", { status: 404 });
  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      "content-type": "image/jpeg",
      "cache-control": "public, max-age=600",
    },
  });
}
