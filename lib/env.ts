import { z } from "zod";

/**
 * 환경변수 검증 — 키 누락을 런타임 깊은 곳이 아니라 시작 시점에 잡는다.
 * 시크릿은 .env.local(프론트)·워커 호스트 시크릿에만 두고 절대 커밋 금지(.gitignore).
 *
 * - 클라이언트(브라우저)는 NEXT_PUBLIC_* 만 접근 가능.
 * - service_role·LLM 키·암호화 키는 서버/워커 전용 → serverEnv 로만 노출.
 */

// 어디서든(브라우저 포함) 안전하게 읽는 공개 값.
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

// 서버·워커에서만 읽는 민감 값. (브라우저 번들에 들어가면 안 됨)
const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  // BullMQ / Upstash Redis (워커·예약). 형식: rediss://default:<token>@<host>:<port>
  REDIS_URL: z.string().url().optional(),
  // IG 토큰 봉인용 대칭키(libsodium). DB 밖에 보관(SPEC 2.2).
  TOKEN_ENCRYPTION_KEY: z.string().optional(),
  // Meta(인스타) 앱 전역 자격증명. OAuth(Phase3)·웹훅(Phase6) 착수 시 필수.
  // (사용자별 IG 토큰은 env가 아니라 DB ig_tokens에 암호화 저장)
  IG_APP_ID: z.string().optional(),
  IG_APP_SECRET: z.string().optional(),
  IG_OAUTH_REDIRECT_URI: z.string().url().optional(),
  IG_WEBHOOK_VERIFY_TOKEN: z.string().optional(),
  // 인스타가 image_url/video_url 을 가져갈 공개 https 주소(발행 필수). 예: https://kup-zeta.vercel.app
  PUBLIC_BASE_URL: z.string().url().optional(),
  // 예약 발행 크론(/api/cron/publish) 보호용 시크릿. Vercel Cron 이 Bearer 로 보낸다.
  CRON_SECRET: z.string().optional(),
  // LLM (벤치 결과로 라우팅 — Task 4/5). 없으면 mock.
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  GOOGLE_API_KEY: z.string().optional(),
  // 관측(Task 3은 스텁만 — lib/sentry.ts). DSN 없으면 no-op.
  SENTRY_DSN: z.string().optional(),
});

function read<T extends z.ZodTypeAny>(schema: T, source: NodeJS.ProcessEnv): z.infer<T> {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`[env] 환경변수 검증 실패: ${missing}. .env.example 참고.`);
  }
  return parsed.data;
}

/**
 * 공개(NEXT_PUBLIC_*) 환경. 브라우저에서도 안전.
 * (lazy: 모듈 import만으로 빌드가 키 부재로 깨지지 않게 — serverEnv 와 동일 패턴)
 */
let _publicEnv: z.infer<typeof publicSchema> | null = null;
export function publicEnv() {
  if (!_publicEnv) {
    _publicEnv = read(publicSchema, process.env);
  }
  return _publicEnv;
}

/**
 * 서버/워커 전용 환경. 클라이언트 컴포넌트에서 import 금지.
 * (lazy: 빌드 시점이 아닌 실제 호출 시 검증 → 프론트 빌드가 서버키 부재로 깨지지 않게)
 */
let _serverEnv: z.infer<typeof serverSchema> & z.infer<typeof publicSchema> | null = null;
export function serverEnv() {
  if (!_serverEnv) {
    _serverEnv = {
      ...read(publicSchema, process.env),
      ...read(serverSchema, process.env),
    };
  }
  return _serverEnv;
}
