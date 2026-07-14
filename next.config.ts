import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 워커(workers/)는 Next 빌드 대상이 아님 — Vercel은 app/만 배포.
  // 렌더된 카드 PNG는 Supabase Storage 공개 URL을 통해 노출(원격 호스트).
  images: {
    remotePatterns: [
      // 예: { protocol: "https", hostname: "<project>.supabase.co" }
    ],
  },
};

export default nextConfig;
