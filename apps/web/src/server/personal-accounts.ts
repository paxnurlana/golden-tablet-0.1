import { randomUUID } from "node:crypto";
import {accountPotentialSummary} from '@/lib/trade-potential';
import { sumVolumes, volumeUnit } from "@/lib/trade-volume";
import {
  connection,
  listPersonalJournal,
  createPersonalJournalTerm,
  updatePersonalJournalTerm,
} from "./personal-journal";
import { requireValue } from "./api";
import {
  accountBalance,
  payoutRoi,
  defaultProfile,
  type AccountProfile,
  type AccountMovement,
  type AccountPhase,
  type JournalFirm,
} from "@/lib/personal-accounts";

function database() {
  const sql = connection();
  sql.exec(`CREATE TABLE IF NOT EXISTS personal_account_profiles (account_id TEXT PRIMARY KEY REFERENCES personal_journal_terms(id), profile_json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS personal_account_firms (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE COLLATE NOCASE, logo TEXT NOT NULL DEFAULT '');
    CREATE TABLE IF NOT EXISTS personal_account_movements (id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES personal_journal_terms(id), kind TEXT NOT NULL, date TEXT NOT NULL, amount REAL NOT NULL, received REAL NOT NULL, note TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS personal_account_phases (id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES personal_journal_terms(id), stage TEXT NOT NULL, date TEXT NOT NULL);`);
  if (
    !(sql.pragma("table_info(personal_account_movements)") as { name: string }[]).some(
      (c) => c.name === "deleted_at",
    )
  )
    sql.exec("ALTER TABLE personal_account_movements ADD COLUMN deleted_at TEXT");
  if (
    !(sql.pragma("table_info(personal_account_firms)") as { name: string }[]).some(
      (c) => c.name === "deleted_at",
    )
  )
    sql.exec("ALTER TABLE personal_account_firms ADD COLUMN deleted_at TEXT");
  return sql;
}
const validDate = (value: unknown) =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;
function validate(profile: AccountProfile, draft = false) {
  requireValue(profile && ["personal", "prop"].includes(profile.kind), "Выберите тип аккаунта");
  requireValue(["Futures", "Forex", "CFD"].includes(profile.market), "Выберите Futures, Forex или CFD");
  requireValue(profile.leverage == null || (Number.isSafeInteger(profile.leverage) && profile.leverage >= 1), "Плечо должно быть положительным целым числом");
  requireValue(validDate(profile.startDate), "Укажите дату начала учёта");
  requireValue(["Phase 1", "Phase 2", "Funded"].includes(profile.stage), "Некорректный этап");
  requireValue(["Static", "EOD Trailing"].includes(profile.drawdownType), "Некорректный drawdown");
  for (const key of [
    "accountSize",
    "openingBalance",
    "drawdown",
    "phase1Target",
    "phase2Target",
    "traderShare",
  ] as const)
    requireValue(
      typeof profile[key] === "number" && Number.isFinite(profile[key]) && profile[key] >= 0,
      "Суммы должны быть неотрицательными",
    );
  requireValue(profile.traderShare <= 100, "Доля трейдера — от 0 до 100%");
  requireValue(
    profile.purchasePrice === undefined ||
      (typeof profile.purchasePrice === "number" &&
        Number.isFinite(profile.purchasePrice) &&
        profile.purchasePrice >= 0),
    "Цена аккаунта должна быть неотрицательной",
  );
  requireValue(
    profile.dailyLimit === null || (Number.isFinite(profile.dailyLimit) && profile.dailyLimit >= 0),
    "Некорректный дневной лимит",
  );
  if (profile.kind === "prop") {
    requireValue(
      (draft || (profile.accountSize > 0 && profile.drawdown > 0)) &&
        profile.drawdown <= profile.accountSize,
      "Укажите размер счёта и drawdown не больше размера счёта",
    );
    requireValue(
      (draft && !profile.firmId) ||
        database().prepare("SELECT id FROM personal_account_firms WHERE id=?").get(profile.firmId),
      "Выберите фирму",
    );
  }
}
import {isScenarioEntry} from '@/lib/trade-accounting';
export function listPersonalAccounts() {
  const sql = database();
  const journal = listPersonalJournal();
  const firms = sql
    .prepare(
      "SELECT id,name,logo,deleted_at IS NOT NULL AS archived FROM personal_account_firms ORDER BY name",
    )
    .all() as JournalFirm[];
  const accounts = journal.terms
    .filter((t) => t.kind === "account")
    .map((term) => {
      const row = sql
        .prepare("SELECT profile_json FROM personal_account_profiles WHERE account_id=?")
        .get(term.id) as { profile_json: string } | undefined;
      const profile = row ? (JSON.parse(row.profile_json) as AccountProfile) : null;
      const movements = sql
        .prepare(
          "SELECT id,account_id AS accountId,kind,date,amount,received,note FROM personal_account_movements WHERE account_id=? AND deleted_at IS NULL ORDER BY date,id",
        )
        .all(term.id) as AccountMovement[];
      const phases = sql
        .prepare("SELECT stage,date FROM personal_account_phases WHERE account_id=? ORDER BY rowid")
        .all(term.id) as AccountPhase[];
      const entries = journal.entries.filter(
        (e) =>
          e.mode === "Forward" &&
          !isScenarioEntry(e,new Map(journal.terms.map(t=>[t.id,t.name]))) &&
          (!profile || e.date >= profile.startDate) &&
          e.accounts.some((a) => a.accountId === term.id),
      );
      const results = entries.flatMap((e) => e.accounts.filter((a) => a.accountId === term.id));
      const pnl = results.reduce((sum, a) => sum + (a.pnlCash ?? 0), 0);
      const received = movements
        .filter((m) => m.kind === "payout" || m.kind === "withdrawal")
        .reduce((s, m) => s + m.received, 0);
      const cost =
        (profile?.purchasePrice ?? 0) +
        movements.filter((m) => m.kind === "expense").reduce((s, m) => s + m.amount, 0);
      return {
        ...term,
        logo: (
          sql.prepare("SELECT logo FROM personal_journal_terms WHERE id=?").get(term.id) as {
            logo: string;
          }
        ).logo,
        profile,
        movements,
        phases,
        pnl,
        potential:accountPotentialSummary(journal.entries.filter(e=>!profile||e.date>=profile.startDate),term.id,journal.terms),
        volumes: sumVolumes(entries.flatMap(e => {
          const result = e.accounts.find(a => a.accountId === term.id);
          if (result?.quantity == null) return [];
          const asset = journal.terms.find(t => t.id === e.terms.instrument?.[0])?.name ?? "Без Asset";
          return [{ asset, unit: result.quantityUnit ?? volumeUnit(asset), quantity: result.quantity }];
        })),
        missingPnl: results.filter((a) => a.pnlCash === null).length,
        balance: profile ? accountBalance(profile.openingBalance, pnl, movements) : null,
        received,
        cost,
        roi: payoutRoi(cost, received),
        trades: entries.length,
        tradeIds: entries.map((e) => e.id),
      };
    });
  const firmStats = firms.map((f) => {
    const members = accounts.filter((a) => a.profile?.kind === "prop" && a.profile.firmId === f.id);
    const cost = members.reduce((s, a) => s + a.cost, 0),
      received = members.reduce((s, a) => s + a.received, 0);
    return {
      ...f,
      accountCount: members.length,
      challenge: members.filter((a) => a.profile?.stage !== "Funded").length,
      funded: members.filter((a) => a.profile?.stage === "Funded").length,
      trades: new Set(members.flatMap((a) => a.tradeIds)).size,
      cost,
      received,
      profit: received - cost,
      roi: payoutRoi(cost, received),
    };
  });
  return { accounts, firms: firmStats };
}
export function savePersonalAccount(body: {
  id?: string;
  name: string;
  profile: AccountProfile;
  logo?: string;
  draft?: boolean;
}) {
  const sql = database();
  requireValue(
    typeof body.name === "string" && body.name.trim().length > 0 && body.name.trim().length <= 100,
    "Введите название до 100 символов",
  );
  validate(body.profile, body.draft === true);
  return sql.transaction(() => {
    let id = body.id;
    if (id)
      requireValue(
        sql
          .prepare(
            "SELECT id FROM personal_journal_terms WHERE id=? AND kind='account' AND deleted_at IS NULL",
          )
          .get(id),
        "Аккаунт не найден",
      );
    else {
      requireValue(
        !sql
          .prepare(
            "SELECT id FROM personal_journal_terms WHERE kind='account' AND name=? COLLATE NOCASE",
          )
          .get(body.name.trim()),
        "Аккаунт с таким названием уже существует",
      );
      id = createPersonalJournalTerm("account", body.name).id;
    }
    updatePersonalJournalTerm(id, { name: body.name, logo: body.logo });
    const old = sql
      .prepare("SELECT profile_json FROM personal_account_profiles WHERE account_id=?")
      .get(id) as { profile_json: string } | undefined;
    const previous = old ? (JSON.parse(old.profile_json) as AccountProfile) : null;
    if (
      previous &&
      (previous.startDate !== body.profile.startDate ||
        previous.openingBalance !== body.profile.openingBalance)
    )
      requireValue(
        !sql
          .prepare(
            "SELECT id FROM personal_account_movements WHERE account_id=? AND deleted_at IS NULL AND amount>0 LIMIT 1",
          )
          .get(id),
        "После движения денег начальный баланс и дату нельзя менять",
      );
    sql
      .prepare(
        "INSERT INTO personal_account_profiles VALUES (?,?) ON CONFLICT(account_id) DO UPDATE SET profile_json=excluded.profile_json",
      )
      .run(id, JSON.stringify(body.profile));
    if (!previous || previous.stage !== body.profile.stage || previous.kind !== body.profile.kind)
      sql
        .prepare("INSERT INTO personal_account_phases VALUES (?,?,?,?)")
        .run(
          randomUUID(),
          id,
          body.profile.kind === "personal" ? "Личный" : body.profile.stage,
          new Date().toISOString(),
        );
    return { id };
  })();
}
export function saveFirm(body: { name: string; logo?: string; id?: string }) {
  const sql = database();
  requireValue(
    typeof body.name === "string" && body.name.trim().length > 0 && body.name.length <= 100,
    "Введите название фирмы до 100 символов",
  );
  const logo = body.logo ?? "";
  requireValue(
    typeof logo === "string" &&
      logo.length < 700000 &&
      (logo === "" || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(logo)),
    "Выберите логотип до 512 КБ",
  );
  const id = body.id ?? randomUUID();
  if (logo) {
    const bytes = Buffer.from(logo.split(",")[1] ?? "", "base64");
    const valid = logo.startsWith("data:image/png;")
      ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : logo.startsWith("data:image/jpeg;")
        ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
        : bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
    requireValue(
      valid && bytes.length <= 512 * 1024,
      "Логотип должен быть PNG, JPEG или WebP до 512 КБ",
    );
  }
  if (body.id)
    requireValue(
      sql.prepare("SELECT id FROM personal_account_firms WHERE id=?").get(id),
      "Фирма не найдена",
    );
  sql
    .prepare(
      "INSERT INTO personal_account_firms (id,name,logo) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,logo=excluded.logo",
    )
    .run(id, body.name.trim(), logo);
  return { id };
}
export function addMovement(body: {
  id?: string;
  draft?: boolean;
  accountId: string;
  kind: AccountMovement["kind"];
  date: string;
  amount: number;
  received: number;
  note?: string;
}) {
  const sql = database();
  const row = sql
    .prepare("SELECT profile_json FROM personal_account_profiles WHERE account_id=?")
    .get(body.accountId) as { profile_json: string } | undefined;
  requireValue(row, "Сначала настройте аккаунт");
  const profile = JSON.parse(row.profile_json) as AccountProfile;
  requireValue(
    ["deposit", "withdrawal", "payout", "expense"].includes(body.kind),
    "Некорректная операция",
  );
  requireValue(
    validDate(body.date) && body.date >= profile.startDate,
    "Дата операции не раньше начала учёта",
  );
  requireValue(
    Number.isFinite(body.amount) &&
      (body.draft === true ? body.amount >= 0 : body.amount > 0) &&
      Number.isFinite(body.received) &&
      body.received >= 0 &&
      body.received <= body.amount,
    "Проверьте суммы",
  );
  requireValue(
    profile.kind === "personal"
      ? body.kind !== "payout" && body.kind !== "expense"
      : body.kind === "expense" || (body.kind === "payout" && profile.stage === "Funded"),
    "Для проп-счёта выплаты доступны только на Funded",
  );
  requireValue(
    !body.note || (typeof body.note === "string" && body.note.length <= 1000),
    "Заметка до 1000 символов",
  );
  const id = body.id ?? randomUUID();
  const existing = sql
    .prepare("SELECT account_id,kind FROM personal_account_movements WHERE id=?")
    .get(id) as { account_id: string; kind: string } | undefined;
  requireValue(
    !existing || (existing.account_id === body.accountId && existing.kind === body.kind),
    "Операция принадлежит другому аккаунту",
  );
  sql
    .prepare(
      "INSERT INTO personal_account_movements (id,account_id,kind,date,amount,received,note) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET date=excluded.date,amount=excluded.amount,received=excluded.received,note=excluded.note",
    )
    .run(
      id,
      body.accountId,
      body.kind,
      body.date,
      body.amount,
      body.kind === "payout" ? body.received : body.amount,
      body.note ?? "",
    );
  return { id };
}
export function createAccountDraft(body: {
  requestId: string;
  kind?: "personal" | "prop";
  firmId?: string;
}) {
  const sql = database();
  requireValue(
    typeof body.requestId === "string" && /^[a-f0-9-]{36}$/.test(body.requestId),
    "Некорректный ID",
  );
  const existing = sql
    .prepare("SELECT id FROM personal_journal_terms WHERE id=? AND kind='account'")
    .get(body.requestId);
  if (existing) return { id: body.requestId };
  return sql.transaction(() => {
    const prefix = body.kind === "prop" ? "Проп-аккаунт" : "Личный счёт";
    let n = 1;
    while (
      sql
        .prepare("SELECT id FROM personal_journal_terms WHERE kind='account' AND name=?")
        .get(`${prefix} ${n}`)
    )
      n++;
    const term = createPersonalJournalTerm("account", `${prefix} ${n}`);
    sql.prepare("UPDATE personal_journal_terms SET id=? WHERE id=?").run(body.requestId, term.id);
    savePersonalAccount({
      id: body.requestId,
      name: term.name,
      profile: { ...defaultProfile(), kind: body.kind ?? "personal", firmId: body.firmId ?? "" },
      draft: true,
    });
    return { id: body.requestId };
  })();
}
export function createFirmDraft(body: { requestId: string }) {
  const sql = database();
  requireValue(
    typeof body.requestId === "string" && /^[a-f0-9-]{36}$/.test(body.requestId),
    "Некорректный ID",
  );
  if (sql.prepare("SELECT id FROM personal_account_firms WHERE id=?").get(body.requestId))
    return { id: body.requestId };
  return sql.transaction(() => {
    let n = 1;
    while (
      sql.prepare("SELECT id FROM personal_account_firms WHERE name=?").get(`Новая фирма ${n}`)
    )
      n++;
    sql
      .prepare("INSERT INTO personal_account_firms (id,name) VALUES (?,?)")
      .run(body.requestId, `Новая фирма ${n}`);
    return { id: body.requestId };
  })();
}
export function removeMovement(body: { id: string; restore?: boolean }) {
  const sql = database();
  requireValue(typeof body.id === "string", "Некорректная операция");
  requireValue(
    sql.prepare("SELECT id FROM personal_account_movements WHERE id=?").get(body.id),
    "Операция не найдена",
  );
  sql
    .prepare("UPDATE personal_account_movements SET deleted_at=? WHERE id=?")
    .run(body.restore ? null : new Date().toISOString(), body.id);
  return { id: body.id };
}
export function archiveFirm(body: { id: string; restore?: boolean }) {
  const sql = database();
  requireValue(typeof body.id === "string", "Некорректная фирма");
  requireValue(
    sql.prepare("SELECT id FROM personal_account_firms WHERE id=?").get(body.id),
    "Фирма не найдена",
  );
  if (!body.restore)
    requireValue(
      !sql
        .prepare(
          "SELECT p.account_id FROM personal_account_profiles p JOIN personal_journal_terms t ON t.id=p.account_id WHERE json_extract(p.profile_json,'$.firmId')=? AND t.deleted_at IS NULL LIMIT 1",
        )
        .get(body.id),
      "Сначала уберите аккаунты этой фирмы в архив",
    );
  sql
    .prepare("UPDATE personal_account_firms SET deleted_at=? WHERE id=?")
    .run(body.restore ? null : new Date().toISOString(), body.id);
  return { id: body.id };
}
