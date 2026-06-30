# KUP — 멀티스테이지 Docker 이미지 (Next.js standalone)
# 빌드:  docker build -t kup .
# 실행:  docker compose up -d   (권장 — 볼륨/환경변수 포함)

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
# standalone 서버 + 정적 파일
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
# 런타임 데이터 디렉터리(JSON 저장소 + 이미지/영상) — 볼륨으로 마운트 권장
RUN mkdir -p /app/.data
EXPOSE 3000
CMD ["node", "server.js"]
