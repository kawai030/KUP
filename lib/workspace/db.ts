import fs from "fs";
import path from "path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { DB } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// 워크스페이스 저장소 — 좁은 인터페이스(readDB/writeDB/mutateDB)로 백엔드를 감춘다.
//
//   KUP_DB_BACKEND=supabase  → Supabase 단일 행(app_state) JSONB blob (서버리스/배포용)
//   그 외(기본)              → 로컬 파일 .data/db.json (로컬 개발·npm run gen)
//
// ⚠️ 임시(C안): Supabase 백엔드도 통짜 blob이라 동시 write 는 마지막-쓰기-승리다.
//    소규모 베타엔 충분. 정식은 관계형 테이블(A안)로 이관 예정 — 그때 이 파일만 교체.
// ─────────────────────────────────────────────────────────────────────────────

const EMPTY_DB: DB = {
  users: [],
  sessions: [],
  strategies: {},
  cards: [],
  publishJobs: [],
  metrics: [],
  dmRules: [],
};

const USE_SUPABASE = process.env.KUP_DB_BACKEND === "supabase";

function withDefaults(parsed: Partial<DB> | null | undefined): DB {
  // 누락된 컬렉션 보강 (스키마 진화 대비)
  return { ...EMPTY_DB, ...(parsed ?? {}) } as DB;
}

// ── Supabase blob 백엔드 ─────────────────────────────────────────────────────
let _sb: SupabaseClient | null = null;
function sb(): SupabaseClient {
  if (!_sb) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error(
        "KUP_DB_BACKEND=supabase 인데 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 없습니다."
      );
    }
    _sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return _sb;
}

async function readSupabase(): Promise<DB> {
  const { data, error } = await sb().from("app_state").select("data").eq("id", 1).maybeSingle();
  if (error) throw new Error(`app_state 읽기 실패: ${error.message}`);
  return withDefaults((data?.data as Partial<DB> | undefined) ?? undefined);
}

// CAS(낙관적 락)용 — data 와 함께 현재 version 을 읽는다. 시드 행이 없으면 만들어 version 0 으로 시작.
async function readSupabaseWithVersion(): Promise<{ db: DB; version: number }> {
  const { data, error } = await sb().from("app_state").select("data, version").eq("id", 1).maybeSingle();
  if (error) throw new Error(`app_state 읽기 실패: ${error.message}`);
  if (!data) {
    // 시드 행 부재(비정상) → version 0 행을 만들어 이후 CAS update 가 매칭되게 한다.
    const { error: seedErr } = await sb().from("app_state").upsert({ id: 1, data: {}, version: 0 });
    if (seedErr) throw new Error(`app_state 시드 실패: ${seedErr.message}`);
    return { db: structuredClone(EMPTY_DB), version: 0 };
  }
  return {
    db: withDefaults((data.data as Partial<DB> | undefined) ?? undefined),
    version: (data.version as number | null) ?? 0,
  };
}

async function writeSupabase(db: DB): Promise<void> {
  const { error } = await sb().from("app_state").upsert({ id: 1, data: db as unknown as object });
  if (error) throw new Error(`app_state 쓰기 실패: ${error.message}`);
}

// version 을 조건으로 한 CAS update. 갱신된 행이 있으면 성공, 0행이면 충돌(다른 요청이 먼저 커밋).
async function casWriteSupabase(db: DB, expectedVersion: number): Promise<boolean> {
  const { data, error } = await sb()
    .from("app_state")
    .update({ data: db as unknown as object, version: expectedVersion + 1, updated_at: new Date().toISOString() })
    .eq("id", 1)
    .eq("version", expectedVersion)
    .select("id");
  if (error) throw new Error(`app_state 쓰기 실패(CAS): ${error.message}`);
  return Array.isArray(data) && data.length > 0;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── 파일 백엔드 (로컬) ───────────────────────────────────────────────────────
// KUP_DATA_DIR 로 데이터 디렉터리를 격리할 수 있다(기본: .data)
const DATA_DIR = process.env.KUP_DATA_DIR
  ? path.resolve(process.env.KUP_DATA_DIR)
  : path.join(process.cwd(), ".data");
const DB_PATH = path.join(DATA_DIR, "db.json");

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(EMPTY_DB, null, 2), "utf-8");
  }
}

function readFileDB(): DB {
  ensureFile();
  try {
    const raw = fs.readFileSync(DB_PATH, "utf-8");
    return withDefaults(JSON.parse(raw) as Partial<DB>);
  } catch {
    return structuredClone(EMPTY_DB);
  }
}

function writeFileDB(db: DB): void {
  ensureFile();
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
}

// ── 공개 API (async — 백엔드 무관) ───────────────────────────────────────────
export async function readDB(): Promise<DB> {
  return USE_SUPABASE ? readSupabase() : readFileDB();
}

export async function writeDB(db: DB): Promise<void> {
  if (USE_SUPABASE) await writeSupabase(db);
  else writeFileDB(db);
}

// read-modify-write 를 하나의 호출로 묶는다.
//   Supabase: version 기반 CAS 로 동시 write 유실을 막는다(충돌 시 최신 상태로 재시도).
//   파일(로컬): 단일 프로세스라 경합이 없어 그대로 read→write.
// ⚠️ fn 은 부수효과 없이 db 만 변형해야 한다(충돌 시 최신 db 로 재실행되므로).
const CAS_MAX_ATTEMPTS = 8;

export async function mutateDB<T>(fn: (db: DB) => T): Promise<T> {
  if (!USE_SUPABASE) {
    const db = readFileDB();
    const result = fn(db);
    writeFileDB(db);
    return result;
  }
  // Supabase: 낙관적 동시성 제어 — read version → 변형 → CAS write → 충돌 시 재시도
  for (let attempt = 0; attempt < CAS_MAX_ATTEMPTS; attempt++) {
    const { db, version } = await readSupabaseWithVersion();
    const result = fn(db);
    if (await casWriteSupabase(db, version)) return result;
    // 충돌: 다른 요청이 먼저 커밋됨 → 지수 백오프 + 지터 후 최신 상태로 재시도
    await sleep(15 * (attempt + 1) + Math.floor(Math.random() * 25));
  }
  throw new Error(`app_state 동시 쓰기 충돌: ${CAS_MAX_ATTEMPTS}회 재시도 초과`);
}

export function uid(prefix = "id"): string {
  const rnd = Math.random().toString(36).slice(2, 10);
  const t = Date.now().toString(36);
  return `${prefix}_${t}${rnd}`;
}
