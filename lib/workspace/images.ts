import fs from "fs";
import path from "path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// 카드 페이지 이미지(JPEG)/릴스 영상(MP4)을 저장하고 공개 프록시 라우트에서 서빙한다.
// 브라우저가 렌더한 JPEG를 받아 저장 → /api/render/{cardId}/{page} 로 인스타가 가져감.
//
//   KUP_DB_BACKEND=supabase → Supabase Storage(card-media 버킷) — 서버리스/배포용
//   그 외(기본)             → 로컬 파일 .data/images — 로컬 개발
// db.ts 와 동일한 dual-backend 규칙. (FS 는 서버리스에서 휘발하므로 배포엔 Storage 필수)

const USE_SUPABASE = process.env.KUP_DB_BACKEND === "supabase";
const BUCKET = "card-media";

function safeId(cardId: string): string {
  // cardId 검증: 우리 id 포맷만 허용(경로 traversal 방지)
  if (!/^[a-z]+_[a-z0-9]+$/i.test(cardId)) throw new Error("invalid card id");
  return cardId;
}

function decodeImage(url: string): Buffer | null {
  const m = url.match(/^data:image\/(jpeg|jpg|png);base64,(.+)$/);
  if (!m) return null;
  return Buffer.from(m[2] ?? "", "base64");
}

// ── Supabase Storage 백엔드 ─────────────────────────────────────────────────
let _sb: SupabaseClient | null = null;
function sb(): SupabaseClient {
  if (!_sb) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("KUP_DB_BACKEND=supabase 인데 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 없습니다.");
    }
    _sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return _sb;
}

async function sbList(id: string): Promise<string[]> {
  const { data } = await sb().storage.from(BUCKET).list(id);
  return (data ?? []).map((f) => f.name);
}

// ── 파일 백엔드 (로컬) ───────────────────────────────────────────────────────
const IMG_DIR = path.join(process.cwd(), ".data", "images");
function fileDir(id: string): string {
  return path.join(IMG_DIR, id);
}

// ── 이미지 ───────────────────────────────────────────────────────────────────
export async function saveCardImages(cardId: string, dataUrls: string[]): Promise<number> {
  const id = safeId(cardId);
  const bufs = dataUrls.map(decodeImage);

  if (USE_SUPABASE) {
    // 기존 이미지 정리
    const stale = (await sbList(id)).filter((n) => n.endsWith(".jpg"));
    if (stale.length) await sb().storage.from(BUCKET).remove(stale.map((n) => `${id}/${n}`));
    let n = 0;
    for (let i = 0; i < bufs.length; i++) {
      const b = bufs[i];
      if (!b) continue;
      const { error } = await sb().storage.from(BUCKET).upload(`${id}/${i}.jpg`, b, { contentType: "image/jpeg", upsert: true });
      if (error) throw new Error(`이미지 업로드 실패: ${error.message}`);
      n++;
    }
    return n;
  }

  const dir = fileDir(id);
  fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
    if (f.endsWith(".jpg")) fs.unlinkSync(path.join(dir, f));
  }
  let n = 0;
  bufs.forEach((b, i) => {
    if (!b) return;
    fs.writeFileSync(path.join(dir, `${i}.jpg`), b);
    n++;
  });
  return n;
}

export async function readCardImage(cardId: string, page: number): Promise<Buffer | null> {
  const id = safeId(cardId);
  if (USE_SUPABASE) {
    const { data, error } = await sb().storage.from(BUCKET).download(`${id}/${Number(page)}.jpg`);
    if (error || !data) return null;
    return Buffer.from(await data.arrayBuffer());
  }
  const file = path.join(fileDir(id), `${Number(page)}.jpg`);
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file);
}

export async function hasCardImages(cardId: string): Promise<boolean> {
  try {
    const id = safeId(cardId);
    if (USE_SUPABASE) return (await sbList(id)).some((n) => n.endsWith(".jpg"));
    const dir = fileDir(id);
    return fs.existsSync(dir) && fs.readdirSync(dir).some((f) => f.endsWith(".jpg"));
  } catch {
    return false;
  }
}

// ── 릴스 영상 ──────────────────────────────────────────────────────────────
export async function saveCardVideo(cardId: string, buf: Buffer): Promise<void> {
  const id = safeId(cardId);
  if (USE_SUPABASE) {
    const { error } = await sb().storage.from(BUCKET).upload(`${id}/video.mp4`, buf, { contentType: "video/mp4", upsert: true });
    if (error) throw new Error(`영상 업로드 실패: ${error.message}`);
    return;
  }
  const dir = fileDir(id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "video.mp4"), buf);
}

export async function readCardVideo(cardId: string): Promise<Buffer | null> {
  const id = safeId(cardId);
  if (USE_SUPABASE) {
    const { data, error } = await sb().storage.from(BUCKET).download(`${id}/video.mp4`);
    if (error || !data) return null;
    return Buffer.from(await data.arrayBuffer());
  }
  const file = path.join(fileDir(id), "video.mp4");
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file);
}

export async function hasCardVideo(cardId: string): Promise<boolean> {
  try {
    const id = safeId(cardId);
    if (USE_SUPABASE) return (await sbList(id)).includes("video.mp4");
    return fs.existsSync(path.join(fileDir(id), "video.mp4"));
  } catch {
    return false;
  }
}

// ── 삭제 ─────────────────────────────────────────────────────────────────────
export async function deleteCardImages(cardId: string): Promise<void> {
  try {
    const id = safeId(cardId);
    if (USE_SUPABASE) {
      const names = await sbList(id);
      if (names.length) await sb().storage.from(BUCKET).remove(names.map((n) => `${id}/${n}`));
      return;
    }
    fs.rmSync(fileDir(id), { recursive: true, force: true });
  } catch {
    /* noop */
  }
}

// ── 사용자 첨부 사진(게시물, 페이지별 원본) ── dual-backend(Supabase Storage / 로컬 fs)
function photoName(page: number): string {
  return `src_${Number(page)}.jpg`;
}
export async function saveCardPhoto(cardId: string, page: number, buf: Buffer): Promise<void> {
  const id = safeId(cardId);
  if (USE_SUPABASE) {
    const { error } = await sb().storage.from(BUCKET).upload(`${id}/${photoName(page)}`, buf, { contentType: "image/jpeg", upsert: true });
    if (error) throw new Error(`사진 업로드 실패: ${error.message}`);
    return;
  }
  const dir = fileDir(id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, photoName(page)), buf);
}
export async function readCardPhoto(cardId: string, page: number): Promise<Buffer | null> {
  const id = safeId(cardId);
  if (USE_SUPABASE) {
    const { data, error } = await sb().storage.from(BUCKET).download(`${id}/${photoName(page)}`);
    if (error || !data) return null;
    return Buffer.from(await data.arrayBuffer());
  }
  const file = path.join(fileDir(id), photoName(page));
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file);
}
export async function deleteCardPhoto(cardId: string, page: number): Promise<void> {
  try {
    const id = safeId(cardId);
    if (USE_SUPABASE) {
      await sb().storage.from(BUCKET).remove([`${id}/${photoName(page)}`]);
      return;
    }
    fs.rmSync(path.join(fileDir(id), photoName(page)), { force: true });
  } catch {
    /* noop */
  }
}
export async function listCardPhotoPages(cardId: string): Promise<number[]> {
  const pick = (names: string[]) =>
    names
      .map((f) => f.match(/^src_(\d+)\.jpg$/))
      .filter(Boolean)
      .map((m) => Number(m![1]))
      .sort((a, b) => a - b);
  try {
    const id = safeId(cardId);
    if (USE_SUPABASE) return pick(await sbList(id));
    const dir = fileDir(id);
    if (!fs.existsSync(dir)) return [];
    return pick(fs.readdirSync(dir));
  } catch {
    return [];
  }
}
