/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 격리 실행용(HTML 내보내기 등) — 기본값은 .next 로 동일
  distDir: process.env.KUP_DIST_DIR || ".next",
  // Docker/배포용 최소 standalone 서버 출력 (next build 시에만 영향)
  output: "standalone",
};

export default nextConfig;
