import {defaultRrBasis,validateRrBasis,realisedRR,type RrBasis} from '@/lib/trade-rr';
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { dataDir } from "@/db";
import { convertAccountMoney, type MoneyField } from "@/lib/account-money";
import { volumeUnit, type VolumeUnit } from "@/lib/trade-volume";
import { DETAILS, resultName, type TradeClassification } from "@/lib/trade-classification";
import {validatePotential,type TradePotential} from '@/lib/trade-potential';
import {numberSeries,type NumberSeries} from '@/lib/journal-number-series';

export const TERM_KINDS = [
  "result",
  "account",
  "instrument",
  "setup",
  "storyline",
  "trigger",
  "vp",
  "vwap",
  "type",
] as const;
export type TermKind = (typeof TERM_KINDS)[number];
export type Term = {
  id: string;
  kind: TermKind;
  name: string;
  description: string;
  archived: boolean;
  logo?: string;
};
export type AccountResult = {
  quantity?: number | null;
  quantityUnit?: VolumeUnit;
  accountId: string;
  riskPct: number | null;
  riskCash?: number | null;
  baseBalance?: number | null;
  pnlCash: number | null;
  pnlPct: number | null;
};
export type JournalBodyBlock =
  | { id: string; kind: "text"; text: string }
  | { id: string; kind: "image"; attachmentId: string; name: string };
export type JournalEntry = {
  numberSeries?:NumberSeries;
  rrBasis?:RrBasis;
  potential?:TradePotential;
  classification?: TradeClassification;
  id: string;
  tradeNo: number;
  date: string;
  mode: "Forward" | "Back";
  direction: "Long" | "Short" | "";
  type: string;
  openedAt: string;
  closedAt: string;
  riskTicks: number | null;
  realisedTicks: number | null;
  realisedR: number | null;
  mfe: number | null;
  mae: number | null;
  quickNote: string;
  bodyTitle: string;
  bodyText: string;
  bodyBlocks?: JournalBodyBlock[];
  terms: Partial<Record<TermKind, string[]>>;
  accounts: AccountResult[];
};

const globalJournal = globalThis as unknown as { __personalJournalSqlite?: Database.Database };
const initialized = new WeakSet<Database.Database>();

export function connection(): Database.Database {
  if (globalJournal.__personalJournalSqlite) {
    if (initialized.has(globalJournal.__personalJournalSqlite))
      return globalJournal.__personalJournalSqlite;
    ensureDeletedColumn(globalJournal.__personalJournalSqlite);
    ensureTypeRelations(globalJournal.__personalJournalSqlite);
    ensureTermFields(globalJournal.__personalJournalSqlite);
    ensureDefaultResults(globalJournal.__personalJournalSqlite);
    initialized.add(globalJournal.__personalJournalSqlite);
    return globalJournal.__personalJournalSqlite;
  }
  mkdirSync(dataDir(), { recursive: true });
  const sqlite = new Database(join(dataDir(), "journal.db"));
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS personal_journal_entries (
      id TEXT PRIMARY KEY,
      trade_no INTEGER NOT NULL UNIQUE,
      date TEXT NOT NULL,
      mode TEXT NOT NULL CHECK (mode IN ('Forward','Back')),
      direction TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL DEFAULT '',
      opened_at TEXT NOT NULL DEFAULT '',
      closed_at TEXT NOT NULL DEFAULT '',
      risk_ticks REAL,
      realised_ticks REAL,
      realised_r REAL,
      mfe REAL,
      mae REAL,
      quick_note TEXT NOT NULL DEFAULT '',
      body_title TEXT NOT NULL DEFAULT '',
      body_text TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS personal_journal_terms (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      name TEXT NOT NULL,
      UNIQUE(kind,name)
    );
    CREATE TABLE IF NOT EXISTS personal_journal_entry_terms (
      entry_id TEXT NOT NULL REFERENCES personal_journal_entries(id) ON DELETE CASCADE,
      term_id TEXT NOT NULL REFERENCES personal_journal_terms(id) ON DELETE CASCADE,
      PRIMARY KEY (entry_id,term_id)
    );
    CREATE TABLE IF NOT EXISTS personal_journal_account_results (
      entry_id TEXT NOT NULL REFERENCES personal_journal_entries(id) ON DELETE CASCADE,
      account_id TEXT NOT NULL REFERENCES personal_journal_terms(id) ON DELETE CASCADE,
      risk_pct REAL,
      pnl_cash REAL,
      pnl_pct REAL,
      PRIMARY KEY (entry_id,account_id)
    );
    CREATE INDEX IF NOT EXISTS personal_journal_entries_date ON personal_journal_entries(date);
    CREATE INDEX IF NOT EXISTS personal_journal_entry_terms_term ON personal_journal_entry_terms(term_id);
  `);
  ensureDeletedColumn(sqlite);
  ensureTypeRelations(sqlite);
  ensureTermFields(sqlite);
  ensureDefaultResults(sqlite);
  globalJournal.__personalJournalSqlite = sqlite;
  initialized.add(sqlite);
  return sqlite;
}

function ensureTermFields(sqlite: Database.Database) {
  const moneyColumns = sqlite.pragma("table_info(personal_journal_account_results)") as {
    name: string;
  }[];
  for (const column of ["risk_cash", "base_balance", "quantity"])
    if (!moneyColumns.some((c) => c.name === column))
      sqlite.exec(`ALTER TABLE personal_journal_account_results ADD COLUMN ${column} REAL`);
  if (!moneyColumns.some(c => c.name === "quantity_unit")) sqlite.exec("ALTER TABLE personal_journal_account_results ADD COLUMN quantity_unit TEXT");
  const columns = sqlite.pragma("table_info(personal_journal_terms)") as { name: string }[];
  if (!columns.some((column) => column.name === "logo"))
    sqlite.exec("ALTER TABLE personal_journal_terms ADD COLUMN logo TEXT NOT NULL DEFAULT ''");
  if (!columns.some((column) => column.name === "description"))
    sqlite.exec(
      "ALTER TABLE personal_journal_terms ADD COLUMN description TEXT NOT NULL DEFAULT ''",
    );
  if (!columns.some((column) => column.name === "deleted_at"))
    sqlite.exec("ALTER TABLE personal_journal_terms ADD COLUMN deleted_at TEXT");
}
function ensureDefaultResults(sqlite: Database.Database) {
  if (
    sqlite
      .prepare("SELECT name FROM personal_journal_migrations WHERE name='default-results-v1'")
      .get()
  )
    return;
  sqlite.transaction(() => {
    if (
      !(
        sqlite
          .prepare("SELECT COUNT(*) AS count FROM personal_journal_terms WHERE kind='result'")
          .get() as { count: number }
      ).count
    )
      for (const name of ["Win", "Loss", "BE", "Missed", "НЛО", "Hypothesis"])
        sqlite
          .prepare("INSERT INTO personal_journal_terms(id,kind,name) VALUES (?,'result',?)")
          .run(randomUUID(), name);
    sqlite
      .prepare("INSERT INTO personal_journal_migrations(name) VALUES ('default-results-v1')")
      .run();
  })();
}
type TermRow = {
  id: string;
  kind: TermKind;
  name: string;
  description: string;
  deleted_at: string | null;
  logo?: string;
};
const parseTerm = (row: TermRow): Term => ({
  id: row.id,
  kind: row.kind,
  name: row.kind === "result" ? resultName(row.name) : row.name,
  description: row.description,
  archived: row.deleted_at !== null,
  logo: row.logo ?? "",
});

function ensureDeletedColumn(sqlite: Database.Database) {
  const columns = sqlite.pragma("table_info(personal_journal_entries)") as { name: string }[];
  if(!columns.some(c=>c.name==='rr_basis_json'))sqlite.exec("ALTER TABLE personal_journal_entries ADD COLUMN rr_basis_json TEXT");
  if(!columns.some(c=>c.name==='potential_json'))sqlite.exec("ALTER TABLE personal_journal_entries ADD COLUMN potential_json TEXT NOT NULL DEFAULT '{}'");
  if (!columns.some(c=>c.name==='custom_trade_no')) sqlite.exec('ALTER TABLE personal_journal_entries ADD COLUMN custom_trade_no INTEGER');
  if (!columns.some(c=>c.name==="classification_json")) sqlite.exec("ALTER TABLE personal_journal_entries ADD COLUMN classification_json TEXT NOT NULL DEFAULT '{}'");
  if (!columns.some((column) => column.name === "deleted_at"))
    sqlite.exec("ALTER TABLE personal_journal_entries ADD COLUMN deleted_at TEXT");
  if (!columns.some((column) => column.name === "body_blocks_json"))
    sqlite.exec(
      "ALTER TABLE personal_journal_entries ADD COLUMN body_blocks_json TEXT NOT NULL DEFAULT ''",
    );
}

function ensureTypeRelations(sqlite: Database.Database) {
  sqlite.exec("CREATE TABLE IF NOT EXISTS personal_journal_migrations (name TEXT PRIMARY KEY)");
  if (
    sqlite
      .prepare("SELECT name FROM personal_journal_migrations WHERE name='type-relations-v1'")
      .get()
  )
    return;
  sqlite.transaction(() => {
    for (const name of ["Clear", "Dirty", "Re-entry", "Anomaly"])
      sqlite
        .prepare("INSERT OR IGNORE INTO personal_journal_terms(id,kind,name) VALUES (?,'type',?)")
        .run(randomUUID(), name);
    const rows = sqlite
      .prepare("SELECT id,type FROM personal_journal_entries WHERE trim(type)<>''")
      .all() as { id: string; type: string }[];
    for (const row of rows) {
      sqlite
        .prepare("INSERT OR IGNORE INTO personal_journal_terms(id,kind,name) VALUES (?,'type',?)")
        .run(randomUUID(), row.type);
      const term = sqlite
        .prepare("SELECT id FROM personal_journal_terms WHERE kind='type' AND name=?")
        .get(row.type) as { id: string };
      sqlite
        .prepare(
          "INSERT OR IGNORE INTO personal_journal_entry_terms(entry_id,term_id) VALUES (?,?)",
        )
        .run(row.id, term.id);
    }
    sqlite
      .prepare("INSERT INTO personal_journal_migrations(name) VALUES ('type-relations-v1')")
      .run();
  })();
}

type EntryRow = {
  deleted_at?: string | null;
  id: string;
  trade_no: number;
  date: string;
  mode: "Forward" | "Back";
  direction: "Long" | "Short" | "";
  type: string;
  opened_at: string;
  closed_at: string;
  risk_ticks: number | null;
  realised_ticks: number | null;
  realised_r: number | null;
  mfe: number | null;
  mae: number | null;
  quick_note: string;
  body_title: string;
  body_text: string;
  body_blocks_json: string;
};

function entryNumberIndex(sql:Database.Database){
 const rows=sql.prepare(`SELECT e.id,t.name FROM personal_journal_entries e
 LEFT JOIN personal_journal_entry_terms l ON l.entry_id=e.id
 LEFT JOIN personal_journal_terms t ON t.id=l.term_id AND t.kind='result'
 WHERE e.deleted_at IS NULL ORDER BY e.trade_no`).all() as {id:string;name:string|null}[];
 const grouped=new Map<string,string[]>();for(const r of rows){const values=grouped.get(r.id)??[];if(r.name)values.push(r.name);grouped.set(r.id,values);}
 const counts={main:0,hypothesis:0,unidentified:0},index=new Map<string,{series:NumberSeries;number:number}>();
 for(const [id,names] of grouped){const series=numberSeries(names);index.set(id,{series,number:++counts[series]});}
 return index;
}
function parseEntry(
  row: EntryRow,
  sql: Database.Database,
  prefetched?: {
    numbers:Map<string,{series:NumberSeries;number:number}>;
    links: Map<string, { id: string; kind: TermKind }[]>;
    accounts: Map<string, AccountResult[]>;
  },
  displayNumber?: number,
): JournalEntry {
  const links = prefetched
    ? (prefetched.links.get(row.id) ?? [])
    : (sql
        .prepare(
          `SELECT t.id,t.kind FROM personal_journal_entry_terms l
    JOIN personal_journal_terms t ON t.id=l.term_id WHERE l.entry_id=?`,
        )
        .all(row.id) as { id: string; kind: TermKind }[]);
  const terms: JournalEntry["terms"] = {};
  for (const { id, kind } of links) (terms[kind] ??= []).push(id);
  const numbering=(prefetched?.numbers??entryNumberIndex(sql)).get(row.id);
  const series=numbering?.series??numberSeries((sql.prepare("SELECT t.name FROM personal_journal_entry_terms l JOIN personal_journal_terms t ON t.id=l.term_id WHERE l.entry_id=? AND t.kind='result'").all(row.id) as {name:string}[]).map(t=>t.name));
  const accounts = prefetched
    ? (prefetched.accounts.get(row.id) ?? [])
    : (sql
        .prepare(
          `SELECT account_id AS accountId,risk_pct AS riskPct,
    pnl_cash AS pnlCash,pnl_pct AS pnlPct,risk_cash AS riskCash,base_balance AS baseBalance,quantity,quantity_unit AS quantityUnit FROM personal_journal_account_results WHERE entry_id=?`,
        )
        .all(row.id) as AccountResult[]);
  return {
    numberSeries:series,
    ...((row as EntryRow&{rr_basis_json?:string}).rr_basis_json?{rrBasis:JSON.parse((row as EntryRow&{rr_basis_json:string}).rr_basis_json) as RrBasis}:{}),
    id: row.id,
    ...((row as EntryRow&{potential_json?:string}).potential_json && (row as EntryRow&{potential_json?:string}).potential_json!=='{}'?{potential:JSON.parse((row as EntryRow&{potential_json:string}).potential_json) as TradePotential}:{}),
    classification: JSON.parse((row as EntryRow & {classification_json?:string}).classification_json || "{}"),
    // Keep the immutable insertion order internally; public numbers skip trash.
    tradeNo:(row as EntryRow & {custom_trade_no?:number|null}).custom_trade_no ?? numbering?.number ?? row.trade_no,
    date: row.date,
    mode: row.mode,
    direction: row.direction,
    type: row.type,
    openedAt: row.opened_at,
    closedAt: row.closed_at,
    riskTicks: row.risk_ticks,
    realisedTicks: row.realised_ticks,
    realisedR: row.realised_r,
    mfe: row.mfe,
    mae: row.mae,
    quickNote: row.quick_note,
    bodyTitle: row.body_title,
    bodyText: row.body_text,
    ...(row.body_blocks_json
      ? { bodyBlocks: JSON.parse(row.body_blocks_json) as JournalBodyBlock[] }
      : {}),
    terms,
    accounts: accounts.map(({ riskCash, baseBalance, quantity, quantityUnit, ...account }) => ({
      ...account,
      ...(riskCash != null ? { riskCash } : {}),
      ...(baseBalance != null ? { baseBalance } : {}),
      ...(quantity != null ? { quantity, quantityUnit } : {}),
    })),
  };
}

export function listPersonalJournal() {
  const sql = connection();
  const prefetched = {
    numbers:entryNumberIndex(sql),
    links: new Map<string, { id: string; kind: TermKind }[]>(),
    accounts: new Map<string, AccountResult[]>(),
  };
  for (const link of sql
    .prepare(
      "SELECT l.entry_id,t.id,t.kind FROM personal_journal_entry_terms l JOIN personal_journal_terms t ON t.id=l.term_id",
    )
    .all() as { entry_id: string; id: string; kind: TermKind }[]) {
    const group = prefetched.links.get(link.entry_id) ?? [];
    group.push({ id: link.id, kind: link.kind });
    prefetched.links.set(link.entry_id, group);
  }
  for (const result of sql
    .prepare(
      "SELECT entry_id,account_id AS accountId,risk_pct AS riskPct,pnl_cash AS pnlCash,pnl_pct AS pnlPct,risk_cash AS riskCash,base_balance AS baseBalance,quantity,quantity_unit AS quantityUnit FROM personal_journal_account_results",
    )
    .all() as (AccountResult & { entry_id: string })[]) {
    const group = prefetched.accounts.get(result.entry_id) ?? [];
    const { entry_id, ...account } = result;
    group.push(account);
    prefetched.accounts.set(entry_id, group);
  }
  const rows = sql
    .prepare(
      "SELECT * FROM personal_journal_entries WHERE deleted_at IS NULL ORDER BY trade_no ASC",
    )
    .all() as EntryRow[];
  const deletedRows = sql
    .prepare(
      "SELECT * FROM personal_journal_entries WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC",
    )
    .all() as EntryRow[];
  const terms = sql
    .prepare(
      `SELECT id,kind,name,description,deleted_at,logo FROM personal_journal_terms ORDER BY
    CASE WHEN kind='result' THEN CASE name WHEN 'Win' THEN 0 WHEN 'Loss' THEN 1 WHEN 'BE' THEN 2
    WHEN 'Missed' THEN 3 WHEN 'НЛО' THEN 4 WHEN 'Hypothesis' THEN 5 ELSE 6 END ELSE 7 END,
    name COLLATE NOCASE`,
    )
    .all() as TermRow[];
  const firmsAvailable = sql
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='personal_account_firms'")
    .get();
  const accountLogo = firmsAvailable
    ? sql.prepare(
        "SELECT f.logo FROM personal_account_profiles p JOIN personal_account_firms f ON f.id=json_extract(p.profile_json,'$.firmId') WHERE p.account_id=? AND json_extract(p.profile_json,'$.kind')='prop'",
      )
    : null;
  return {
    entries: rows.map((row, index) => parseEntry(row, sql, prefetched, index + 1)),
    terms: terms.map((row) => {
      const term = parseTerm(row);
      if (term.kind === "account" && !term.logo && accountLogo)
        term.logo = (accountLogo.get(term.id) as { logo: string } | undefined)?.logo ?? "";
      return term;
    }),
    trashed: deletedRows.map((row) => parseEntry(row, sql, prefetched)),
  };
}

export function archivePersonalJournalEntry(id: string) {
  const sql = connection();
  if (!sql.prepare("SELECT id FROM personal_journal_entries WHERE id=?").get(id))
    throw new Error("Запись не найдена");
  sql
    .prepare("UPDATE personal_journal_entries SET deleted_at=?,updated_at=? WHERE id=?")
    .run(new Date().toISOString(), new Date().toISOString(), id);
}
export function restorePersonalJournalEntry(id: string): JournalEntry {
  const sql = connection();
  const row = sql.prepare("SELECT * FROM personal_journal_entries WHERE id=?").get(id) as
    EntryRow | undefined;
  if (!row) throw new Error("Запись не найдена");
  sql
    .prepare("UPDATE personal_journal_entries SET deleted_at=NULL,updated_at=? WHERE id=?")
    .run(new Date().toISOString(), id);
  return parseEntry({ ...row, deleted_at: null }, sql);
}

export function hasPersonalJournalEntry(id: string): boolean {
  return !!connection().prepare("SELECT id FROM personal_journal_entries WHERE id=?").get(id);
}
function accountCalculationBase(
  sql: Database.Database,
  accountId: string,
  entryId: string,
  stored: number | null,
): number | null {
  if (!sql.prepare("SELECT name FROM sqlite_master WHERE name='personal_account_profiles'").get())
    return stored;
  const row = sql
    .prepare("SELECT profile_json FROM personal_account_profiles WHERE account_id=?")
    .get(accountId) as { profile_json: string } | undefined;
  if (!row) return stored;
  const profile = JSON.parse(row.profile_json) as {
    kind: string;
    accountSize: number;
    openingBalance: number;
    startDate: string;
  };
  if (profile.kind === "prop") {
    const base = profile.accountSize || profile.openingBalance;
    return base > 0 ? base : null;
  }
  if (stored && stored > 0) return stored;
  const pnl = (
    sql
      .prepare(
        "SELECT COALESCE(SUM(r.pnl_cash),0) n FROM personal_journal_account_results r JOIN personal_journal_entries e ON e.id=r.entry_id WHERE r.account_id=? AND e.id<>? AND e.deleted_at IS NULL AND e.mode='Forward' AND e.date>=? AND NOT EXISTS (SELECT 1 FROM personal_journal_entry_terms et JOIN personal_journal_terms t ON t.id=et.term_id WHERE et.entry_id=e.id AND t.kind='result' AND (lower(trim(t.name)) IN ('missed','miss','hypothesis','hypotesys','hypothesys') OR trim(t.name) IN ('НЛО','Неопознанный трейд','неопознанный трейд','нло')))",
      )
      .get(accountId, entryId, profile.startDate) as { n: number }
  ).n;
  const flow = (
    sql
      .prepare(
        "SELECT COALESCE(SUM(CASE WHEN kind='deposit' THEN amount WHEN kind IN ('withdrawal','payout') THEN -amount ELSE 0 END),0) n FROM personal_account_movements WHERE account_id=? AND deleted_at IS NULL",
      )
      .get(accountId) as { n: number }
  ).n;
  const base = profile.openingBalance + pnl + flow;
  return base > 0 ? base : null;
}

export function createPersonalJournalEntry(): JournalEntry {
  const sql = connection();
  const id = randomUUID();
  const tradeNo = (
    sql
      .prepare("SELECT COALESCE(MAX(trade_no),0)+1 AS value FROM personal_journal_entries")
      .get() as { value: number }
  ).value;
  const now = new Date().toISOString();
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Qyzylorda",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  sql
    .prepare(
      `INSERT INTO personal_journal_entries
    (id,trade_no,date,mode,created_at,updated_at) VALUES (?,?,?,?,?,?)`,
    )
    .run(id, tradeNo, date, "Forward", now, now);
  sql.prepare("UPDATE personal_journal_entries SET rr_basis_json=? WHERE id=?").run(JSON.stringify(defaultRrBasis()),id);
  return parseEntry(
    sql.prepare("SELECT * FROM personal_journal_entries WHERE id=?").get(id) as EntryRow,
    sql,
  );
}

const stringFields = new Map([
  ["date", "date"],
  ["mode", "mode"],
  ["direction", "direction"],
  ["type", "type"],
  ["openedAt", "opened_at"],
  ["closedAt", "closed_at"],
  ["quickNote", "quick_note"],
  ["bodyTitle", "body_title"],
  ["bodyText", "body_text"],
]);
const numericFields = new Map([
  ["riskTicks", "risk_ticks"],
  ["realisedTicks", "realised_ticks"],
  ["realisedR", "realised_r"],
  ["mfe", "mfe"],
  ["mae", "mae"],
]);

export function updatePersonalJournalEntry(
  id: string,
  changes: Record<string, unknown>,
): JournalEntry {
  const sql = connection();
  if (!sql.prepare("SELECT id FROM personal_journal_entries WHERE id=?").get(id))
    throw new Error("Запись не найдена");
  sql.transaction(() => {
    // An explicitly entered RR opts into manual mode; tick-only edits keep automation.
    if('realisedR' in changes&&changes.rrBasis===undefined){
      const row=sql.prepare('SELECT rr_basis_json FROM personal_journal_entries WHERE id=?').get(id) as {rr_basis_json:string|null};
      const previous=row.rr_basis_json?JSON.parse(row.rr_basis_json) as RrBasis:defaultRrBasis();
      changes={...changes,rrBasis:{...previous,mode:'manual'}};
    }
    if(changes.rrBasis!==undefined){
      const basis=validateRrBasis(changes.rrBasis);
      sql.prepare('UPDATE personal_journal_entries SET rr_basis_json=?,updated_at=? WHERE id=?').run(JSON.stringify(basis),new Date().toISOString(),id);
    }
    if(changes.potential!==undefined){
      const potential=validatePotential(changes.potential);
      const previous=JSON.parse((sql.prepare('SELECT potential_json FROM personal_journal_entries WHERE id=?').get(id) as {potential_json:string}).potential_json) as Partial<TradePotential>;
      // Preserve historical overrides if an account is later detached; they never enter its totals.
      for(const accountId of Object.keys(potential.accountCash))if(!sql.prepare("SELECT account_id FROM personal_journal_account_results WHERE entry_id=? AND account_id=?").get(id,accountId)&&!Object.hasOwn(previous.accountCash??{},accountId))throw new Error('Аккаунт потенциала не привязан к сделке');
      sql.prepare('UPDATE personal_journal_entries SET potential_json=? WHERE id=?').run(JSON.stringify(potential),id);
    }
    if(changes.tradeNo !== undefined) {
      if(changes.tradeNo !== null && (typeof changes.tradeNo !== 'number' || !Number.isSafeInteger(changes.tradeNo) || changes.tradeNo < 1)) throw new Error('Номер должен быть целым положительным числом');
      sql.prepare('UPDATE personal_journal_entries SET custom_trade_no=? WHERE id=?').run(changes.tradeNo,id);
    }
    if (changes.bodyBlocks !== undefined) {
      if (!Array.isArray(changes.bodyBlocks) || changes.bodyBlocks.length > 1000)
        throw new Error("Некорректное содержимое записи");
      const ids = new Set<string>();
      const blocks: JournalBodyBlock[] = [];
      for (const block of changes.bodyBlocks) {
        if (!block || typeof block.id !== "string" || ids.has(block.id))
          throw new Error("Некорректный блок");
        ids.add(block.id);
        if (block.kind === "text" && typeof block.text === "string")
          blocks.push({ id: block.id, kind: "text", text: block.text });
        else if (
          block.kind === "image" &&
          typeof block.attachmentId === "string" &&
          typeof block.name === "string"
        ) {
          if (
            !sql
              .prepare(
                "SELECT id FROM attachments WHERE id=? AND owner_type='personal-journal' AND owner_id=? AND (mime LIKE 'image/%' OR mime LIKE 'video/%')",
              )
              .get(block.attachmentId, id)
          )
            throw new Error("Скриншот не найден");
          blocks.push({
            id: block.id,
            kind: "image",
            attachmentId: block.attachmentId,
            name: block.name,
          });
        } else throw new Error("Некорректный блок");
      }
      sql
        .prepare(
          "UPDATE personal_journal_entries SET body_blocks_json=?,body_text=?,updated_at=? WHERE id=?",
        )
        .run(
          JSON.stringify(blocks),
          blocks
            .filter(
              (block): block is Extract<JournalBodyBlock, { kind: "text" }> =>
                block.kind === "text",
            )
            .map((block) => block.text)
            .join("\n"),
          new Date().toISOString(),
          id,
        );
    }
    for (const [key, column] of stringFields) {
      if (key in changes) {
        const value = changes[key];
        if (typeof value !== "string") throw new Error(`Некорректное поле: ${key}`);
        if (key === "mode" && value !== "Forward" && value !== "Back")
          throw new Error("Некорректный режим");
        if (key === "direction" && !["", "Long", "Short"].includes(value))
          throw new Error("Некорректное направление");
        sql
          .prepare(`UPDATE personal_journal_entries SET ${column}=?,updated_at=? WHERE id=?`)
          .run(value, new Date().toISOString(), id);
      }
    }
    for (const [key, column] of numericFields) {
      if (key in changes) {
        const raw = changes[key];
        if (raw !== null && (typeof raw !== "number" || !Number.isFinite(raw)))
          throw new Error(`Некорректное число: ${key}`);
        sql
          .prepare(`UPDATE personal_journal_entries SET ${column}=?,updated_at=? WHERE id=?`)
          .run(raw, new Date().toISOString(), id);
      }
    }
    if(['rrBasis','riskTicks','realisedTicks','realisedR'].some(key=>key in changes)){
      const current=parseEntry(sql.prepare('SELECT * FROM personal_journal_entries WHERE id=?').get(id) as EntryRow,sql);
      if(current.rrBasis&&current.rrBasis.mode!=='manual')sql.prepare('UPDATE personal_journal_entries SET realised_r=? WHERE id=?').run(realisedRR(current),id);
    }
    if (changes.terms !== undefined) {
      const value = changes.terms;
      if (!value || typeof value !== "object" || Array.isArray(value))
        throw new Error("Некорректные связи");
      const instrument = (value as Record<string, unknown>).instrument;
      if (instrument !== undefined) {
        if (!Array.isArray(instrument)) throw new Error("Некорректный Asset");
        const previous = (sql.prepare("SELECT t.id FROM personal_journal_entry_terms l JOIN personal_journal_terms t ON t.id=l.term_id WHERE l.entry_id=? AND t.kind='instrument'").all(id) as {id:string}[]).map(t=>t.id).sort();
        const next = [...instrument].sort();
        if (JSON.stringify(previous) !== JSON.stringify(next)) sql.prepare("UPDATE personal_journal_account_results SET quantity=NULL,quantity_unit=NULL WHERE entry_id=?").run(id);
      }
      sql.prepare("DELETE FROM personal_journal_entry_terms WHERE entry_id=?").run(id);
      for (const [kind, ids] of Object.entries(value)) {
        if (!TERM_KINDS.includes(kind as TermKind) || kind === "account" || !Array.isArray(ids))
          throw new Error("Некорректные связи");
        for (const termId of ids) {
          const term = sql
            .prepare("SELECT id FROM personal_journal_terms WHERE id=? AND kind=?")
            .get(termId, kind);
          if (!term) throw new Error("Связь не найдена");
          sql
            .prepare(
              "INSERT OR IGNORE INTO personal_journal_entry_terms(entry_id,term_id) VALUES (?,?)",
            )
            .run(id, termId);
        }
      }
    }
    if (changes.accounts !== undefined) {
      if (!Array.isArray(changes.accounts)) throw new Error("Некорректные аккаунты");
      const previousAccounts = new Map(
        (
          sql
            .prepare(
              "SELECT account_id,base_balance FROM personal_journal_account_results WHERE entry_id=?",
            )
            .all(id) as { account_id: string; base_balance: number | null }[]
        ).map((a) => [a.account_id, a.base_balance]),
      );
      sql.prepare("DELETE FROM personal_journal_account_results WHERE entry_id=?").run(id);
      for (const item of changes.accounts) {
        if (!item || typeof item.accountId !== "string") throw new Error("Некорректный аккаунт");
        const term = sql
          .prepare("SELECT id FROM personal_journal_terms WHERE id=? AND kind='account'")
          .get(item.accountId);
        if (!term) throw new Error("Аккаунт не найден");
        for (const field of ["riskCash", "riskPct", "pnlCash", "pnlPct", "baseBalance", "quantity"]) {
          const value = item[field];
          if (value != null && (typeof value !== "number" || !Number.isFinite(value)))
            throw new Error(`Некорректное число: ${field}`);
        }
        let values = item as AccountResult;
        const asset = sql.prepare("SELECT t.name FROM personal_journal_entry_terms l JOIN personal_journal_terms t ON t.id=l.term_id WHERE l.entry_id=? AND t.kind='instrument' LIMIT 1").get(id) as { name: string } | undefined;
        const profile = sql.prepare("SELECT name FROM sqlite_master WHERE name='personal_account_profiles'").get()
          ? sql.prepare("SELECT json_extract(profile_json,'$.market') AS market FROM personal_account_profiles WHERE account_id=?").get(item.accountId) as {market?:string}|undefined : undefined;
        const unit = volumeUnit(asset?.name ?? "",profile?.market);
        if (item.quantity != null && (item.quantity <= 0 || (unit === "contracts" && !Number.isInteger(item.quantity)))) throw new Error("Объём должен быть положительным; контракты — целым числом");
        if (item.editedField !== undefined) {
          if (!["riskCash", "riskPct", "pnlCash", "pnlPct"].includes(item.editedField))
            throw new Error("Некорректное денежное поле");
          const field = item.editedField as MoneyField;
          if (field.startsWith("risk") && item[field] != null && item[field] < 0)
            throw new Error("Риск не может быть отрицательным");
          const base = accountCalculationBase(
            sql,
            item.accountId,
            id,
            previousAccounts.get(item.accountId) ?? null,
          );
          if (field.endsWith("Pct") && item[field] != null && !base)
            throw new Error("Сначала укажите положительный баланс в настройках аккаунта");
          values = convertAccountMoney(values, field, item[field] ?? null, base);
        }
        sql
          .prepare(
            `INSERT INTO personal_journal_account_results
          (entry_id,account_id,risk_pct,pnl_cash,pnl_pct,risk_cash,base_balance,quantity,quantity_unit) VALUES (?,?,?,?,?,?,?,?,?)`,
          )
          .run(
            id,
            item.accountId,
            values.riskPct ?? null,
            values.pnlCash ?? null,
            values.pnlPct ?? null,
            values.riskCash ?? null,
            values.baseBalance ?? previousAccounts.get(item.accountId) ?? null,
            item.quantity ?? null,
            item.quantity != null ? unit : null,
          );
      }
    }
    if (changes.classification !== undefined || changes.terms !== undefined) {
      const row = sql.prepare("SELECT classification_json FROM personal_journal_entries WHERE id=?").get(id) as {classification_json:string};
      const raw = changes.classification === undefined ? JSON.parse(row.classification_json) : changes.classification;
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Некорректная классификация");
      const value = raw as TradeClassification;
      const tags = value.tags ?? [];
      if (!Array.isArray(tags) || tags.length>20 || tags.some(t=>typeof t!=="string"||!t.trim()||t.length>80)) throw new Error("Некорректные метки");
      let detail = value.detail ?? "";
      if (typeof detail!=="string" || (detail && !DETAILS.some(d=>d.id===detail))) throw new Error("Некорректное уточнение");
      const results = (sql.prepare("SELECT t.name FROM personal_journal_entry_terms l JOIN personal_journal_terms t ON t.id=l.term_id WHERE l.entry_id=? AND t.kind='result'").all(id) as {name:string}[]).map(t=>resultName(t.name));
      if(detail && !results.includes(DETAILS.find(d=>d.id===detail)!.result)) {
        if(changes.classification!==undefined)throw new Error("Уточнение не соответствует результату");
        detail="";
      }
      if(value.targetHit!==undefined&&value.targetHit!==null&&typeof value.targetHit!=='boolean')throw new Error('Некорректная отметка цели');
      sql.prepare("UPDATE personal_journal_entries SET classification_json=? WHERE id=?").run(JSON.stringify({detail,tags:[...new Set(tags)],...(value.targetHit!==undefined?{targetHit:value.targetHit}:{})}),id);
    }
  })();
  return parseEntry(
    sql.prepare("SELECT * FROM personal_journal_entries WHERE id=?").get(id) as EntryRow,
    sql,
  );
}

export function createPersonalJournalTerm(kind: TermKind, name: string): Term {
  if (!TERM_KINDS.includes(kind)) throw new Error("Неизвестный справочник");
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 100) throw new Error("Введите название до 100 символов");
  const sql = connection();
  const existing = sql
    .prepare("SELECT * FROM personal_journal_terms WHERE kind=? AND name=? COLLATE NOCASE")
    .get(kind, trimmed) as TermRow | undefined;
  if (existing) {
    if (existing.deleted_at)
      sql.prepare("UPDATE personal_journal_terms SET deleted_at=NULL WHERE id=?").run(existing.id);
    return { ...parseTerm(existing), archived: false };
  }
  const id = randomUUID();
  sql
    .prepare("INSERT OR IGNORE INTO personal_journal_terms(id,kind,name) VALUES (?,?,?)")
    .run(id, kind, trimmed);
  return parseTerm(
    sql
      .prepare("SELECT * FROM personal_journal_terms WHERE kind=? AND name=?")
      .get(kind, trimmed) as TermRow,
  );
}

export function updatePersonalJournalTerm(
  id: string,
  changes: { name?: string; description?: string; archived?: boolean; logo?: string },
): Term {
  const sql = connection();
  const current = sql.prepare("SELECT * FROM personal_journal_terms WHERE id=?").get(id) as
    TermRow | undefined;
  if (!current) throw new Error("Значение не найдено");
  if (changes.logo !== undefined) {
    if (current.kind !== "account" || typeof changes.logo !== "string")
      throw new Error("Логотип доступен только для аккаунта");
    if (changes.logo !== "") {
      const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(
        changes.logo,
      );
      if (!match || !match[2] || changes.logo.length > 700000)
        throw new Error("Выберите PNG, JPEG или WebP до 512 КБ");
      const bytes = Buffer.from(match[2], "base64");
      const valid =
        match[1] === "png"
          ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          : match[1] === "jpeg"
            ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
            : bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
      if (!valid || bytes.length > 512 * 1024)
        throw new Error("Логотип должен быть изображением до 512 КБ");
    }
  }
  sql.transaction(() => {
    if (changes.logo !== undefined)
      sql.prepare("UPDATE personal_journal_terms SET logo=? WHERE id=?").run(changes.logo, id);
    if (changes.name !== undefined) {
      const name = changes.name.trim();
      if (!name || name.length > 100) throw new Error("Введите название до 100 символов");
      if (
        sql
          .prepare(
            "SELECT id FROM personal_journal_terms WHERE kind=? AND name=? COLLATE NOCASE AND id<>?",
          )
          .get(current.kind, name, id)
      )
        throw new Error("Такое название уже есть в этом справочнике");
      sql.prepare("UPDATE personal_journal_terms SET name=? WHERE id=?").run(name, id);
    }
    if (changes.description !== undefined)
      sql
        .prepare("UPDATE personal_journal_terms SET description=? WHERE id=?")
        .run(changes.description, id);
    if (changes.archived !== undefined)
      sql
        .prepare("UPDATE personal_journal_terms SET deleted_at=? WHERE id=?")
        .run(changes.archived ? new Date().toISOString() : null, id);
  })();
  return parseTerm(
    sql.prepare("SELECT * FROM personal_journal_terms WHERE id=?").get(id) as TermRow,
  );
}
