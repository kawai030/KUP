import { serverEnv } from "@/lib/env";

/**
 * Sentry 스텁 (Task 3).
 * 지금은 DSN이 있으면 콘솔로만 흘리는 no-op 어댑터. 발행 실패·웹훅 누락 추적이
 * 실제로 필요한 Phase 5~6에서 @sentry/nextjs로 교체한다(개발계획 §7 모니터링).
 *
 * 호출부는 이 인터페이스만 의존 → 나중에 구현만 바꾸면 됨.
 */

function dsn(): string | undefined {
  try {
    return serverEnv().SENTRY_DSN;
  } catch {
    return undefined;
  }
}

export function captureException(error: unknown, context?: Record<string, unknown>) {
  if (dsn()) {
    // TODO(Phase5): Sentry.captureException(error, { extra: context })
    console.error("[sentry:stub] captureException", error, context ?? "");
  } else {
    console.error("[sentry:stub:no-dsn]", error, context ?? "");
  }
}

export function captureMessage(message: string, context?: Record<string, unknown>) {
  if (dsn()) {
    // TODO(Phase5): Sentry.captureMessage(message, { extra: context })
    console.warn("[sentry:stub] captureMessage", message, context ?? "");
  } else {
    console.warn("[sentry:stub:no-dsn]", message, context ?? "");
  }
}
