import { randomUUID } from "node:crypto";
import { reviewConnection } from "./trading-review";
import { requireValue } from "./api";
import { workflowCommands, type WorkflowCard } from "@/lib/workflow";
import type { JournalBodyBlock } from "./personal-journal";
import {normalizeWorkflowSource} from '@/lib/workflow-source';
import {cloneMedia} from './media-storage';
function connection() {
  const db = reviewConnection();
  db.exec(`CREATE TABLE IF NOT EXISTS personal_workflow_cards (
    id TEXT PRIMARY KEY, source TEXT NOT NULL, url TEXT NOT NULL, label TEXT NOT NULL,
    slot INTEGER NOT NULL, category TEXT NOT NULL, text TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'inbox',
    detached INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL, UNIQUE(source,slot)
  )`);
  if (
    !(db.pragma("table_info(personal_workflow_cards)") as { name: string }[]).some(
      (column) => column.name === "blocks",
    )
  )
    db.exec("ALTER TABLE personal_workflow_cards ADD COLUMN blocks TEXT NOT NULL DEFAULT '[]'");
  const columns = db.pragma("table_info(personal_workflow_cards)") as { name: string }[];
  if (!columns.some(c => c.name === "created_at")) {
    db.exec("ALTER TABLE personal_workflow_cards ADD COLUMN created_at TEXT NOT NULL DEFAULT ''; UPDATE personal_workflow_cards SET created_at=updated_at");
  }
  if (!columns.some(c => c.name === "deleted_at")) db.exec("ALTER TABLE personal_workflow_cards ADD COLUMN deleted_at TEXT");
  if (!columns.some(c => c.name === "category_override")) db.exec("ALTER TABLE personal_workflow_cards ADD COLUMN category_override TEXT");
  if (!columns.some(c => c.name === "status_changed_at")) db.exec("ALTER TABLE personal_workflow_cards ADD COLUMN status_changed_at TEXT");
  if (!columns.some(c => c.name === "text_override")) db.exec("ALTER TABLE personal_workflow_cards ADD COLUMN text_override TEXT");
  return db;
}
export function listWorkflow() {
  const db = connection();
  try {
    return (
      db
        .prepare("SELECT * FROM personal_workflow_cards WHERE deleted_at IS NULL ORDER BY created_at ASC,id ASC")
        .all() as WorkflowCard[]
    ).map((card) => ({
      ...card,
      category: (card as WorkflowCard & {category_override?:string}).category_override || card.category,
      sourceImages: [...card.text.matchAll(/\[\[image:([a-zA-Z0-9-]+)\]\]/g)].flatMap(match => {
        const image = db.prepare("SELECT id,name FROM attachments WHERE id=? AND owner_id=? AND (mime LIKE 'image/%' OR mime LIKE 'video/%')").get(match[1], card.source.startsWith('review:')?card.source:card.source.split(":")[1]) as { id: string; name: string } | undefined;
        return image ? [image] : [];
      }),
      text: (card as WorkflowCard & {text_override?:string|null}).text_override ?? (card.text.replace(/\[\[image:[a-zA-Z0-9-]+\]\]/g, "").trim() || (card.source.startsWith("manual:") ? "" : "Скриншот")),
      detached: Boolean(card.detached),
      blocks: JSON.parse(String(card.blocks ?? "[]")),
    }));
  } finally {
    db.close();
  }
}
export function syncWorkflow(input: Record<string, unknown>) {
  input=normalizeWorkflowSource(input);
  requireValue(
    typeof input.source === "string" && input.source.length > 0 && input.source.length <= 1500,
    "Некорректный источник",
  );
  requireValue(
    typeof input.url === "string" && /^\/(?!\/)/.test(input.url) && input.url.length <= 1500,
    "Некорректная ссылка",
  );
  requireValue(
    typeof input.label === "string" && input.label.length <= 300,
    "Некорректная подпись",
  );
  requireValue(typeof input.text === "string" && input.text.length <= 100000, "Некорректный текст");
  const commands = workflowCommands(input.text);
  const db = connection();
  try {
    db.transaction(() => {
      const previous = db
        .prepare("SELECT * FROM personal_workflow_cards WHERE source=? OR (?=1 AND substr(source,1,length(?)+1)=?||':') ORDER BY updated_at DESC,id")
        .all(input.source,String(input.source).startsWith('review:')?1:0,input.source,input.source) as (WorkflowCard & { deleted_at: string | null })[];
      const claimed = new Set<string>();
      const assigned = commands.filter(command => !previous.some(card => card.deleted_at && card.category === command.category && card.text === command.text)).map((command) => {
        const exact = previous.find(
          (card) =>
            !claimed.has(card.id) &&
            !card.deleted_at &&
            card.category === command.category &&
            card.text === command.text,
        );
        if (exact) claimed.add(exact.id);
        return { command, id: exact?.id };
      });
      for (const item of assigned)
        if (!item.id) {
          const sameSlot = previous.find(
            (card) => !card.deleted_at && !claimed.has(card.id) && !card.detached && card.slot === item.command.slot,
          );
          item.id = sameSlot?.id ?? randomUUID();
          claimed.add(item.id);
        }
      // Free unique positions first; detached cards remain recoverable, never deleted.
      const freeBase = Math.min(0, ...previous.map((card) => card.slot)) - 1;
      previous.forEach((card, index) =>
        db
          .prepare("UPDATE personal_workflow_cards SET source=?,slot=?,detached=1 WHERE id=?")
          .run(input.source,freeBase - index, card.id),
      );
      for (const { command, id } of assigned)
        db.prepare(
          `INSERT INTO personal_workflow_cards(id,source,url,label,slot,category,text,updated_at,created_at,status_changed_at)
      VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET slot=excluded.slot,url=excluded.url,label=excluded.label,category=excluded.category,text=excluded.text,detached=0,updated_at=excluded.updated_at`,
        ).run(
          id,
          input.source,
          input.url,
          input.label,
          command.slot,
          command.category,
          command.text,
          new Date().toISOString(),
          new Date().toISOString(),
          new Date().toISOString(),
        );
    }).immediate();
  } finally {
    db.close();
  }
}
export function moveWorkflow(id: unknown, status: unknown) {
  requireValue(
    typeof id === "string" && ["inbox", "doing", "done"].includes(String(status)),
    "Некорректная карточка",
  );
  const db = connection();
  try {
    requireValue(
      db.prepare("UPDATE personal_workflow_cards SET status_changed_at=CASE WHEN status<>? THEN ? ELSE status_changed_at END,updated_at=CASE WHEN status<>? THEN ? ELSE updated_at END,status=? WHERE id=? AND deleted_at IS NULL").run(status,new Date().toISOString(),status,new Date().toISOString(),status,id).changes,
      "Карточка не найдена",
    );
  } finally {
    db.close();
  }
}
export function changeWorkflowCategory(id:unknown,category:unknown){
  requireValue(typeof id==='string' && typeof category==='string' && /^[\p{L}\p{N}_-]{1,40}$/u.test(category),'Некорректная категория');
  const db=connection();
  try{requireValue(db.prepare('UPDATE personal_workflow_cards SET category_override=?,updated_at=? WHERE id=? AND deleted_at IS NULL').run(String(category).toLowerCase(),new Date().toISOString(),id).changes,'Карточка не найдена');}finally{db.close();}
}
export function hasWorkflowCard(id: string) {
  const db = connection();
  try {
    return !!db.prepare("SELECT id FROM personal_workflow_cards WHERE id=?").get(id);
  } finally {
    db.close();
  }
}
export function updateWorkflowCard(input: Record<string, unknown>) {
  requireValue(typeof input.id === "string", "Некорректная карточка");
  const db = connection();
  try {
    const card = db
      .prepare("SELECT source,text,text_override FROM personal_workflow_cards WHERE id=? AND deleted_at IS NULL")
      .get(input.id) as { source: string;text:string;text_override:string|null } | undefined;
    requireValue(card, "Карточка не найдена");
    if (input.text !== undefined) {
      requireValue(
        typeof input.text === "string" &&
          input.text.length <= 100000,
        "Введите название",
      );
    }
    requireValue(Array.isArray(input.blocks) && input.blocks.length <= 1000, "Некорректные блоки");
    for (const block of input.blocks as JournalBodyBlock[]) {
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
          db
            .prepare(
              "SELECT id FROM attachments WHERE id=? AND owner_type='workflow' AND owner_id=?",
            )
            .get(block.attachmentId, input.id),
          "Скриншот не принадлежит карточке",
        );
    }
    db.prepare(
      "UPDATE personal_workflow_cards SET blocks=?,text=COALESCE(?,text),text_override=COALESCE(?,text_override),updated_at=? WHERE id=?",
    ).run(JSON.stringify(input.blocks), card.source.startsWith('manual:') ? input.text ?? null : null,
      !card.source.startsWith('manual:') && input.text !== undefined && input.text !== (card.text_override ?? (card.text.replace(/\[\[image:[a-zA-Z0-9-]+\]\]/g,'').trim() || 'Скриншот')) ? input.text : null,
      new Date().toISOString(), input.id);
  } finally {
    db.close();
  }
}
export function createWorkflow(input: Record<string, unknown>) {
  requireValue(
    typeof input.text === "string" && (input.text === "" || input.text.trim().length > 0) && input.text.length <= 100000,
    "Введите текст карточки",
  );
  requireValue(
    typeof input.category === "string" && /^[\p{L}\p{N}_-]{1,40}$/u.test(input.category),
    "Некорректная категория",
  );
  requireValue(["inbox", "doing", "done"].includes(String(input.status)), "Некорректный статус");
  const id = randomUUID();
  const db = connection();
  try {
    db.prepare(
      `INSERT INTO personal_workflow_cards(id,source,url,label,slot,category,text,status,updated_at,created_at,status_changed_at) VALUES (?,?, '/workflow', 'Создано в Workflow',0,?,?,?,?,?,?)`,
    ).run(
      id,
      `manual:${id}`,
      input.category.toLowerCase(),
      input.text.trim(),
      input.status,
      new Date().toISOString(),
      new Date().toISOString(),
      new Date().toISOString(),
    );
    return { id };
  } finally {
    db.close();
  }
}

export function archiveWorkflow(id: unknown, restore = false) {
  requireValue(typeof id === "string", "Некорректная карточка");
  const db = connection();
  try {
    requireValue(db.prepare("UPDATE personal_workflow_cards SET deleted_at=? WHERE id=?").run(restore ? null : new Date().toISOString(), id).changes, "Карточка не найдена");
  } finally { db.close(); }
}

export function duplicateWorkflow(id: unknown) {
  requireValue(typeof id === "string", "Некорректная карточка");
  const db = connection();
  try {
    return db.transaction(() => {
      const card = db.prepare("SELECT * FROM personal_workflow_cards WHERE id=? AND deleted_at IS NULL").get(id) as (Omit<WorkflowCard, "blocks"> & {blocks:string;category_override?:string;text_override?:string|null}) | undefined;
      requireValue(card, "Карточка не найдена");
      const copyId = randomUUID();
      const now = new Date().toISOString();
      const copied = new Map<string,string>();
      function copyImage(imageId: string, owner: string) {
        if (copied.has(imageId)) return copied.get(imageId)!;
        const nextId = randomUUID();
        const result = db.prepare("INSERT INTO attachments(id,owner_type,owner_id,name,mime,size,data,created_at) SELECT ?, 'workflow', ?, name,mime,size,data,? FROM attachments WHERE id=? AND owner_id=? AND (mime LIKE 'image/%' OR mime LIKE 'video/%')").run(nextId,copyId,now,imageId,owner);
        requireValue(result.changes, "Скриншот не найден");
        cloneMedia(imageId,nextId);
        copied.set(imageId,nextId);
        return nextId;
      }
      const sourceImages: JournalBodyBlock[] = [];
      const sourceText = card.text.replace(/\[\[image:([a-zA-Z0-9-]+)\]\]/g, (_, imageId: string) => {
        sourceImages.push({id:randomUUID(),kind:"image",attachmentId:copyImage(imageId,card.source.startsWith('review:')?card.source:card.source.split(":")[1]!),name:"Скриншот"});
        return "";
      }).trim() || (card.source.startsWith("manual:") ? "" : "Скриншот");
      const text = card.text_override ?? sourceText;
      const blocks = (JSON.parse(card.blocks || "[]") as JournalBodyBlock[]).map(block => block.kind === "image"
        ? {...block,id:randomUUID(),attachmentId:copyImage(block.attachmentId,card.id)}
        : {...block,id:randomUUID(),text:block.text.replace(/\[\[image:([a-zA-Z0-9-]+)\]\]/g, (_, imageId:string) => `[[image:${copyImage(imageId,card.id)}]]`)});
      db.prepare("INSERT INTO personal_workflow_cards(id,source,url,label,slot,category,text,status,updated_at,created_at,blocks,status_changed_at) VALUES (?,?,'/workflow','Создано в Workflow',0,?,?,?,?,?,?,?)").run(copyId,`manual:${copyId}`,card.category_override || card.category,text,card.status,now,now,JSON.stringify([...sourceImages,...blocks]),now);
      return {id:copyId};
    }).immediate();
  } finally { db.close(); }
}
