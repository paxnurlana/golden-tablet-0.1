import { randomUUID } from "node:crypto";
import { reviewConnection, validReviewKey } from "@/server/trading-review";
import { requireValue } from "@/server/api";
import type { JournalBodyBlock } from "@/server/personal-journal";
export type SessionEntry = {
  kind?:'day'|'week';
  id: string;
  dayKey: string;
  createdAt: string;
  blocks: JournalBodyBlock[];
};
function validateScope(dayKey:string,kind:unknown):asserts kind is 'day'|'week'{
 requireValue(validReviewKey(dayKey)&&['day','week'].includes(String(kind)),'Некорректный период заметки');
 if(kind==='week')requireValue(new Date(dayKey+'T12:00:00Z').getUTCDay()===1,'Неделя должна начинаться с понедельника');
}
export function listSessionEntries(dayKey: string,kind:'day'|'week'='day') {
  validateScope(dayKey,kind);
  requireValue(validReviewKey(dayKey), "Некорректная дата");
  const db = reviewConnection();
  try {
    return (
      db
        .prepare("SELECT * FROM personal_session_entries WHERE day_key=? AND review_kind=? AND deleted_at IS NULL ORDER BY created_at,id")
        .all(dayKey,kind) as { id: string; day_key: string; created_at: string; blocks: string }[]
    ).map((row) => ({
      id: row.id,
      ...(kind==='week'?{kind}:{}),
      dayKey: row.day_key,
      createdAt: row.created_at,
      blocks: JSON.parse(row.blocks) as JournalBodyBlock[],
    }));
  } finally {
    db.close();
  }
}
export function archiveSessionEntry(id:string, restore=false) {
  const db=reviewConnection();
  try { requireValue(db.prepare('SELECT id FROM personal_session_entries WHERE id=?').get(id),'Запись не найдена');
    db.prepare('UPDATE personal_session_entries SET deleted_at=? WHERE id=?').run(restore?null:new Date().toISOString(),id);
  } finally {db.close();}
}
export function hasSessionEntry(id: string) {
  const db = reviewConnection();
  try {
    return !!db.prepare("SELECT id FROM personal_session_entries WHERE id=?").get(id);
  } finally {
    db.close();
  }
}
export function createSessionEntry(dayKey: string,kind:'day'|'week'='day') {
  validateScope(dayKey,kind);
  requireValue(validReviewKey(dayKey), "Некорректная дата");
  const entry: SessionEntry = {
    ...(kind==='week'?{kind}:{}),
    id: randomUUID(),
    dayKey,
    createdAt: new Date().toISOString(),
    blocks: [{ id: randomUUID(), kind: "text", text: "" }],
  };
  const db = reviewConnection();
  try {
    db.prepare(
      "INSERT INTO personal_session_entries(id,day_key,created_at,blocks,review_kind) VALUES (?,?,?,?,?)",
    ).run(entry.id, dayKey, entry.createdAt, JSON.stringify(entry.blocks),kind);
    return entry;
  } finally {
    db.close();
  }
}
export function updateSessionEntry(id: string, blocks: unknown) {
  const db = reviewConnection();
  try {
    requireValue(
      db.prepare("SELECT id FROM personal_session_entries WHERE id=?").get(id),
      "Запись не найдена",
    );
    requireValue(Array.isArray(blocks) && blocks.length <= 1000, "Некорректная запись");
    for (const block of blocks) {
      requireValue(
        block && typeof block.id === "string" && ["text", "image"].includes(block.kind),
        "Некорректный блок",
      );
      if (block.kind === "text")
        requireValue(
          typeof block.text === "string" && block.text.length <= 100000,
          "Некорректный текст",
        );
      else
        requireValue(
          typeof block.attachmentId === "string" &&
            db
              .prepare(
                "SELECT id FROM attachments WHERE id=? AND owner_type='session-entry' AND owner_id=?",
              )
              .get(block.attachmentId, id),
          "Скриншот не принадлежит записи",
        );
    }
    db.prepare("UPDATE personal_session_entries SET blocks=? WHERE id=?").run(
      JSON.stringify(blocks),
      id,
    );
  } finally {
    db.close();
  }
}
