import fs from "fs";
import path from "path";

// 카드 페이지 이미지(JPEG)를 디스크에 저장하고 공개 라우트에서 서빙한다.
// 브라우저가 렌더한 JPEG를 받아 저장 → /api/render/{cardId}/{page} 로 인스타가 가져감.

const IMG_DIR = path.join(process.cwd(), ".data", "images");

function cardDir(cardId: string): string {
  // cardId 검증: 우리 id 포맷만 허용(경로 traversal 방지)
  if (!/^[a-z]+_[a-z0-9]+$/i.test(cardId)) throw new Error("invalid card id");
  return path.join(IMG_DIR, cardId);
}

export function saveCardImages(cardId: string, dataUrls: string[]): number {
  const dir = cardDir(cardId);
  fs.mkdirSync(dir, { recursive: true });
  // 기존 이미지 정리
  for (const f of fs.existsSync(dir) ? fs.readdirSync(dir) : []) fs.unlinkSync(path.join(dir, f));
  let n = 0;
  dataUrls.forEach((url, i) => {
    const m = url.match(/^data:image\/(jpeg|jpg|png);base64,(.+)$/);
    if (!m) return;
    fs.writeFileSync(path.join(dir, `${i}.jpg`), Buffer.from(m[2], "base64"));
    n++;
  });
  return n;
}

export function readCardImage(cardId: string, page: number): Buffer | null {
  const file = path.join(cardDir(cardId), `${Number(page)}.jpg`);
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file);
}

// ── 사용자 첨부 사진(사진첨부형 카드뉴스, 페이지별 원본) ──
export function saveCardPhoto(cardId: string, page: number, buf: Buffer): void {
  const dir = cardDir(cardId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `src_${Number(page)}.jpg`), buf);
}
export function readCardPhoto(cardId: string, page: number): Buffer | null {
  const file = path.join(cardDir(cardId), `src_${Number(page)}.jpg`);
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file);
}
export function deleteCardPhoto(cardId: string, page: number): void {
  try {
    fs.rmSync(path.join(cardDir(cardId), `src_${Number(page)}.jpg`), { force: true });
  } catch {
    /* noop */
  }
}
export function listCardPhotoPages(cardId: string): number[] {
  try {
    const dir = cardDir(cardId);
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .map((f) => f.match(/^src_(\d+)\.jpg$/))
      .filter(Boolean)
      .map((m) => Number(m![1]))
      .sort((a, b) => a - b);
  } catch {
    return [];
  }
}

// ── 릴스 영상 ──
export function saveCardVideo(cardId: string, buf: Buffer): void {
  const dir = cardDir(cardId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "video.mp4"), buf);
}
export function readCardVideo(cardId: string): Buffer | null {
  const file = path.join(cardDir(cardId), "video.mp4");
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file);
}
export function hasCardVideo(cardId: string): boolean {
  try {
    return fs.existsSync(path.join(cardDir(cardId), "video.mp4"));
  } catch {
    return false;
  }
}

export function hasCardImages(cardId: string): boolean {
  try {
    const dir = cardDir(cardId);
    return fs.existsSync(dir) && fs.readdirSync(dir).length > 0;
  } catch {
    return false;
  }
}

export function deleteCardImages(cardId: string): void {
  try {
    fs.rmSync(cardDir(cardId), { recursive: true, force: true });
  } catch {
    /* noop */
  }
}
