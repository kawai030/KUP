import fs from "fs";
import path from "path";
import type { DB } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// 단순 파일 기반 저장소 (프로토타입용, 네이티브 의존성 없음).
// 운영 단계에서는 Postgres/Prisma 등으로 교체 가능하도록 인터페이스를 좁게 유지한다.
// ─────────────────────────────────────────────────────────────────────────────

// KUP_DATA_DIR 로 데이터 디렉터리를 격리할 수 있다(기본: .data)
const DATA_DIR = process.env.KUP_DATA_DIR
  ? path.resolve(process.env.KUP_DATA_DIR)
  : path.join(process.cwd(), ".data");
const DB_PATH = path.join(DATA_DIR, "db.json");

const EMPTY_DB: DB = {
  users: [],
  sessions: [],
  strategies: {},
  cards: [],
  publishJobs: [],
  metrics: [],
  dmRules: [],
};

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(EMPTY_DB, null, 2), "utf-8");
  }
}

export function readDB(): DB {
  ensureFile();
  try {
    const raw = fs.readFileSync(DB_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<DB>;
    // 누락된 컬렉션 보강 (스키마 진화 대비)
    return { ...EMPTY_DB, ...parsed } as DB;
  } catch {
    return structuredClone(EMPTY_DB);
  }
}

export function writeDB(db: DB): void {
  ensureFile();
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
}

// read-modify-write 를 하나의 호출로 묶어 일관성을 높인다.
export function mutateDB<T>(fn: (db: DB) => T): T {
  const db = readDB();
  const result = fn(db);
  writeDB(db);
  return result;
}

export function uid(prefix = "id"): string {
  const rnd = Math.random().toString(36).slice(2, 10);
  const t = Date.now().toString(36);
  return `${prefix}_${t}${rnd}`;
}
