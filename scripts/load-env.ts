import fs from "node:fs";
import path from "node:path";

/**
 * 로컬 스크립트(tsx)용 .env 로더 — Next.js와 달리 tsx는 .env.local을 자동 로드하지 않는다.
 * 이 모듈을 **가장 먼저 import** 하면 process.env가 채워진 뒤 lib/env.ts 검증이 통과한다.
 * 우선순위: 이미 셸에 설정된 값 > .env.local(로컬 인프라·실 키).
 * (이미 설정된 키는 덮어쓰지 않음.)
 */
function parseEnvFile(file: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!fs.existsSync(file)) return out;
  for (const raw of fs.readFileSync(file, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (key) out[key] = val;
  }
  return out;
}

for (const rel of [".env.local"]) {
  const merged = parseEnvFile(path.join(process.cwd(), rel));
  for (const [k, v] of Object.entries(merged)) {
    if (process.env[k] === undefined && v !== "") process.env[k] = v;
  }
}
