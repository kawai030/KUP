import { getCurrentUser, toPublicUser } from "@/lib/auth";
import { aiAvailable } from "@/lib/ai";
import { publicBaseUrl } from "@/lib/ig";
import { json } from "@/lib/api";

export async function GET() {
  const user = await getCurrentUser();
  return json({
    user: user ? toPublicUser(user) : null,
    aiAvailable: aiAvailable(),
    publicBaseUrl: publicBaseUrl() || null, // 실제 인스타 발행 가능 여부(공개 URL 설정됨?)
  });
}
