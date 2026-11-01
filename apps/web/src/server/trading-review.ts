import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "@/db";
import { emptyReview, type ReviewRecord } from "@/lib/trading-review";
import { requireValue } from "@/server/api";
import { REVIEW_CONTEXT } from "@/lib/review-context";

export function reviewConnection() {
  mkdirSync(dataDir(), { recursive: true });
  const db = new Database(join(dataDir(), "journal.db"));
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  db.exec(`CREATE TABLE IF NOT EXISTS personal_trading_reviews (
    key TEXT NOT NULL, kind TEXT NOT NULL, content TEXT NOT NULL, updated_at TEXT NOT NULL,
    PRIMARY KEY(key,kind)
  )`);
  db.exec(`CREATE TABLE IF NOT EXISTS personal_session_entries (
    id TEXT PRIMARY KEY, day_key TEXT NOT NULL, created_at TEXT NOT NULL, blocks TEXT NOT NULL DEFAULT '[]'
  )`);
  if (!(db.pragma('table_info(personal_session_entries)') as {name:string}[]).some(c=>c.name==='deleted_at')) db.exec('ALTER TABLE personal_session_entries ADD COLUMN deleted_at TEXT');
  if (!(db.pragma('table_info(personal_session_entries)') as {name:string}[]).some(c=>c.name==='review_kind')) db.exec("ALTER TABLE personal_session_entries ADD COLUMN review_kind TEXT NOT NULL DEFAULT 'day'");
  return db;
}
export function validReviewKey(key: unknown): key is string {
  return (
    typeof key === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(key) &&
    Number(key.slice(0, 4)) >= 1900 &&
    Number(key.slice(0, 4)) <= 2200 &&
    !Number.isNaN(Date.parse(`${key}T12:00:00Z`)) &&
    new Date(`${key}T12:00:00Z`).toISOString().slice(0, 10) === key
  );
}
export function listReviews() {
  const db = reviewConnection();
  try {
    return (
      db.prepare("SELECT content FROM personal_trading_reviews").all() as { content: string }[]
    ).map((row) => JSON.parse(row.content) as ReviewRecord);
  } finally {
    db.close();
  }
}
export function hasReviewAttachmentOwner(source:string){
  const [prefix,kind,key,field]=source.split(':');
  if(prefix!=='review'||!['day','week','month'].includes(kind??'')||!validReviewKey(key)||!['preText','mindsetText','sessionText','postText'].includes(field??'')||source.split(':').length!==4)return false;
  const db=reviewConnection();try{return !!db.prepare('SELECT key FROM personal_trading_reviews WHERE key=? AND kind=?').get(key,kind);}finally{db.close();}
}
export function saveReview(input: Record<string, unknown>) {
  requireValue(validReviewKey(input.key), "Некорректная дата");
  requireValue(
    input.kind === "day" || input.kind === "week" || input.kind === "month",
    "Некорректный вид отчёта",
  );
  if (input.kind === "month")
    requireValue(
      (input.key as string).endsWith("-01"),
      "Месячный обзор начинается с первого числа",
    );
  if (input.kind === "week")
    requireValue(
      new Date(`${input.key}T12:00:00Z`).getUTCDay() === 1,
      "Неделя начинается в понедельник",
    );
  const db = reviewConnection();
  try {
    return db.transaction(() => {
      const row = db
        .prepare("SELECT content FROM personal_trading_reviews WHERE key=? AND kind=?")
        .get(input.key, input.kind) as { content: string } | undefined;
      const record = row
        ? (JSON.parse(row.content) as ReviewRecord)
        : emptyReview(input.key as string, input.kind as ReviewRecord["kind"]);
      for (const field of [
        "preNarrative",
        "preText",
        "mindsetText",
        "sessionText",
        "nyNarrative",
        "postText",
      ] as const) {
        if (input[field] === undefined) continue;
        const value = input[field];
        requireValue(typeof value === "string" && value.length <= 100_000, "Некорректный текст");
        record[field] = value;
      }
      for (const field of ["preAtr", "nyAtr"] as const) {
        if (input[field] === undefined) continue;
        requireValue(
          input[field] === null ||
            (typeof input[field] === "number" &&
              Number.isFinite(input[field]) &&
              input[field] >= 0),
          "ATR должен быть неотрицательным числом",
        );
        record[field] = input[field] as number | null;
      }
      if (input.dayStatus !== undefined) {
        requireValue(
          record.kind === "day" &&
            ["", "Win Day", "Loss Day", "BE", "Nothing Day", "Missed"].includes(input.dayStatus as string),
          "Некорректный статус дня",
        );
        record.dayStatus = input.dayStatus as ReviewRecord["dayStatus"];
      }
      for (const key of ["vpOpen", "vwapOpen", "vpShape", "preSessionVpOpen", "preSessionVpShape"] as const) {
        if (input[key] === undefined) continue;
        const values = input[key];
        requireValue(
          Array.isArray(values) &&
            values.length <= 20 &&
            values.every(
              (value) =>
                typeof value === "string" &&
                (REVIEW_CONTEXT[key] as readonly string[]).includes(value),
            ),
          "Некорректный контекст рынка",
        );
        record[key] = [...new Set(values)] as string[];
      }
      if (input.complete !== undefined) {
        requireValue(typeof input.complete === "boolean", "Некорректный статус");
        record.complete = input.complete;
      }
      db.prepare(
        "INSERT INTO personal_trading_reviews(key,kind,content,updated_at) VALUES (?,?,?,?) ON CONFLICT(key,kind) DO UPDATE SET content=excluded.content,updated_at=excluded.updated_at",
      ).run(record.key, record.kind, JSON.stringify(record), new Date().toISOString());
      return record;
    })();
  } finally {
    db.close();
  }
}
