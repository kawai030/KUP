// 클라이언트 측 fetch 래퍼

export async function api<T = unknown>(
  url: string,
  options?: { method?: string; body?: unknown }
): Promise<T> {
  const res = await fetch(url, {
    method: options?.method || "GET",
    headers: options?.body ? { "content-type": "application/json" } : undefined,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || "요청에 실패했어요.");
  }
  return data as T;
}

export function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(
    d.getDate()
  ).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(
    2,
    "0"
  )}`;
}

export function formatDay(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}
