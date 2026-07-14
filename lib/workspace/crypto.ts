import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

// ─────────────────────────────────────────────────────────────────────────────
// IG 액세스 토큰 봉인(at-rest 암호화). DB(현재 파일DB)에 평문 토큰을 두지 않기 위함.
//
//  - TOKEN_ENCRYPTION_KEY 가 설정돼 있으면 AES-256-GCM 으로 봉인한다.
//      봉인 포맷: "enc:v1:<ivB64>:<tagB64>:<dataB64>"
//  - 키가 없으면(로컬 개발) 평문 그대로 둔다 → 시드/기존 데이터와 하위호환.
//  - openToken 은 "enc:" 접두사 유무로 봉인 여부를 자동 판별하므로,
//    평문이든 봉인이든 항상 사용 가능한 토큰을 돌려준다.
//
// env 키는 임의 문자열을 허용하고 scrypt 로 32바이트 키를 유도한다(고정 salt).
// ─────────────────────────────────────────────────────────────────────────────

const PREFIX = "enc:v1:";
const SCRYPT_SALT = "kup-ig-token-v1"; // 키 유도용 고정 salt (비밀 아님)

function keyOrNull(): Buffer | null {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) return null;
  return scryptSync(raw, SCRYPT_SALT, 32);
}

/** 토큰을 봉인한다. 암호화 키가 없으면 평문을 그대로 반환(로컬 개발). */
export function sealToken(plain: string): string {
  if (!plain) return plain;
  const key = keyOrNull();
  if (!key) return plain;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${data.toString("base64")}`;
}

/** 봉인 토큰을 사용 가능한 평문으로 되돌린다. 평문이면 그대로 반환. */
export function openToken(sealed: string | undefined): string {
  if (!sealed) return "";
  if (!sealed.startsWith(PREFIX)) return sealed; // 평문(또는 키 없이 저장된 값)
  const key = keyOrNull();
  if (!key) throw new Error("봉인된 토큰을 열 수 없어요. TOKEN_ENCRYPTION_KEY가 설정되지 않았습니다.");
  const [ivB64, tagB64, dataB64] = sealed.slice(PREFIX.length).split(":");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("봉인 토큰 형식이 올바르지 않습니다.");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}
