"use client";
import Link from "next/link";
import {PotentialRRHint} from './potential-rr-hint';
import { volumeLabels, type VolumeTotal } from "@/lib/trade-volume";
import { useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, X, Building2, ArrowLeft, Trash2 } from "lucide-react";
import { postJson, useApi } from "@/lib/use-api";
import {
  defaultProfile,
  payoutRoi,
  type AccountProfile,
  type AccountMovement,
  type AccountPhase,
  type JournalFirm,
} from "@/lib/personal-accounts";
import type { Term } from "@/server/personal-journal";
import { JournalAccountAvatar } from "./journal-account-avatar";
import { accountDraft, useAccountAutosave } from "./use-account-autosave";
import type {accountPotentialSummary} from '@/lib/trade-potential';

type Account = Term & {
  potential?:ReturnType<typeof accountPotentialSummary>;
  profile: AccountProfile | null;
  movements: AccountMovement[];
  phases: AccountPhase[];
  pnl: number;
  balance: number | null;
  received: number;
  missingPnl: number;
  cost: number;
  roi: number | null;
  trades: number;
  tradeIds: string[];
  volumes?: VolumeTotal[];
};
type Firm = JournalFirm & {
  accountCount: number;
  challenge: number;
  funded: number;
  trades: number;
  cost: number;
  received: number;
  profit: number;
  roi: number | null;
};
type Data = { accounts: Account[]; firms: Firm[] };
const field =
  "w-full min-w-0 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40";
const button =
  "rounded-md border bg-foreground/5 px-3 py-2 text-sm hover:bg-foreground/10 disabled:opacity-50";
const money = (n: number) =>
  `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(n)} $`;
const roi = (n: number | null) =>
  n === null ? "—" : `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(n)}%`;
const tone = (n: number) => (n > 0 ? "text-emerald-400" : n < 0 ? "text-rose-400" : "");
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Qyzylorda",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const navigate = (url: string) => window.history.pushState(null, "", url);
function Num({
  label,
  value,
  onChange,
  optional = false,
  disabled = false,
}: {
  label: string;
  value: number | null;
  onChange: (n: number | null) => void;
  optional?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <input
        aria-label={label}
        type="number"
        min="0"
        step="0.01"
        disabled={disabled}
        className={`${field} disabled:opacity-50`}
        value={value ?? ""}
        onChange={(e) =>
          onChange(e.target.value === "" && optional ? null : Number(e.target.value))
        }
      />
    </label>
  );
}
function Metric({
  label,
  value,
  color = "",
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${color}`}>{value}</p>
    </div>
  );
}
function SaveStatus({ save }: { save: ReturnType<typeof useAccountAutosave> }) {
  return (
    <div aria-live="polite" className="text-xs text-muted-foreground">
      {save.status}
      {save.error && (
        <div role="alert" className="mt-1 text-rose-400">
          {save.error}{" "}
          <button onClick={save.retry} className="underline">
            Повторить
          </button>
        </div>
      )}
    </div>
  );
}
function Logo({
  value,
  onChange,
  onError,
}: {
  value: string;
  onChange: (s: string) => void;
  onError: (s: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {value && <img src={value} alt="Логотип" className="size-12 rounded-full object-contain" />}
      <label className={`${button} cursor-pointer`}>
        Загрузить логотип
        <input
          className="sr-only"
          aria-label="Загрузить логотип"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            if (
              !["image/png", "image/jpeg", "image/webp"].includes(f.type) ||
              f.size > 512 * 1024
            ) {
              onError("PNG, JPEG или WebP до 512 КБ");
              return;
            }
            const r = new FileReader();
            r.onload = () => onChange(String(r.result));
            r.onerror = () => onError("Не удалось прочитать файл");
            r.readAsDataURL(f);
          }}
        />
      </label>
      {value && (
        <button className="text-xs text-muted-foreground" onClick={() => onChange("")}>
          Убрать логотип
        </button>
      )}
    </div>
  );
}
export function PersonalAccounts() {
  const { data, refresh, error: loadError } = useApi<Data>("/api/personal-accounts");
  const search = useSearchParams(),
    view = search.get("view") ?? "dashboard";
  const selected = data?.accounts.find((a) => a.id === search.get("account"));
  const selectedFirm = data?.firms.find((f) => f.id === search.get("firm"));
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [undo, setUndo] = useState<{ id: string; kind: "account" | "movement" | "firm" } | null>(null);
  const creating = useRef(false);
  const base = `/accounts?view=${view}${selectedFirm ? `&firm=${selectedFirm.id}` : ""}`;
  const openAccount = (id: string) => navigate(`${base}&account=${id}`);
  async function create(kind: "personal" | "prop", firmId?: string) {
    if (creating.current) return;
    creating.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await postJson<{ id: string }>("/api/personal-accounts", {
        action: "account-create",
        requestId: crypto.randomUUID(),
        kind,
        firmId,
      });
      refresh();
      openAccount(result.id);
    } catch (e) {
      setError(String(e));
    } finally {
      creating.current = false;
      setBusy(false);
    }
  }
  async function createFirm(open = true) {
    if (creating.current) return null;
    creating.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await postJson<{ id: string }>("/api/personal-accounts", {
        action: "firm-create",
        requestId: crypto.randomUUID(),
      });
      refresh();
      if (open) navigate(`/accounts?view=prop&firm=${result.id}`);
      return result.id;
    } catch (e) {
      setError(String(e));
      return null;
    } finally {
      creating.current = false;
      setBusy(false);
    }
  }
  async function archive(a: Account) {
    try {
      await postJson("/api/personal-journal", {
        action: "term-update",
        id: a.id,
        changes: { archived: true },
      });
      setUndo({ id: a.id, kind: "account" });
      refresh();
      navigate(base);
    } catch (e) {
      setError(String(e));
    }
  }
  const personal =
    data?.accounts.filter((a) => !a.archived && a.profile?.kind === "personal") ?? [];
  const unconfigured =
    data?.accounts.filter(
      (a) => !a.archived && (!a.profile || (a.profile.kind === "prop" && !a.profile.firmId)),
    ) ?? [];
  const props = data?.accounts.filter((a) => a.profile?.kind === "prop") ?? [];
  const totalCost = props.reduce((s, a) => s + a.cost, 0),
    totalReceived = props.reduce((s, a) => s + a.received, 0);
  function cards(accounts: Account[]) {
    return (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {accounts
          .filter((a) => !a.archived)
          .map((a) => (
            <button
              key={a.id}
              onClick={() => openAccount(a.id)}
              className="min-w-0 rounded-xl border bg-card p-4 text-left hover:border-foreground/30"
            >
              <div className="flex items-center gap-3">
                <JournalAccountAvatar
                  term={{
                    ...a,
                    logo: a.logo || data?.firms.find((f) => f.id === a.profile?.firmId)?.logo,
                  }}
                  size="size-10"
                />
                <div className="min-w-0">
                  <h3 className="truncate font-semibold">{a.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {a.profile
                      ? `${a.profile.market} · ${a.profile.kind === "personal" ? "Личный" : a.profile.stage === "Funded" ? "Funded" : `Challenge · ${a.profile.stage}`}`
                      : "Настрой аккаунт"}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Баланс{a.missingPnl ? " · неполный" : ""}
                  </p>
                  <b>{a.balance === null ? "—" : money(a.balance)}</b>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Сделки</p>
                  <b>{a.trades}</b>
                </div>
              </div>
              {a.profile?.kind === "prop" && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Расходы {money(a.cost)} · выплаты {money(a.received)} · ROI {roi(a.roi)}
                </p>
              )}
              <p className="mt-3 text-xs text-muted-foreground">Реализовано {money(a.pnl)} · Недобрано {a.potential?.missedCash==null?'не оценено':money(a.potential.missedCash)} · оценено {a.potential?.cashCompared??0} из {a.trades}</p>
            </button>
          ))}
      </div>
    );
  }
  return (
    <div className="space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Аккаунты</h1>
        <span className="text-xs text-muted-foreground">USD · автоматическое сохранение</span>
      </div>
      {(error || loadError) && (
        <p role="alert" className="text-sm text-rose-400">
          {error || loadError}
        </p>
      )}
      <nav className="flex gap-2">
        {[
          ["dashboard", "Обзор"],
          ["prop", "Проп-фирмы"],
          ["personal", "Личные счета"],
        ].map(([key, label]) => (
          <button
            key={key}
            className={`${button} ${view === key ? "bg-accent" : ""}`}
            onClick={() => navigate(`/accounts?view=${key}`)}
          >
            {label}
          </button>
        ))}
      </nav>
      {!data && <p>Загрузка…</p>}
      {data && view === "dashboard" && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Проп-фирмы / аккаунты"
              value={`${data.firms.filter((f) => !f.archived).length} / ${props.length}`}
            />
            <Metric label="Потрачено на проп-счета" value={money(totalCost)} />
            <Metric label="Получено payout" value={money(totalReceived)} />
            <Metric
              label="ROI проп-счетов"
              value={roi(payoutRoi(totalCost, totalReceived))}
              color={tone(totalReceived - totalCost)}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="Личные счета" value={personal.length} />
            <Metric
              label="Баланс личных счетов"
              value={money(personal.reduce((s, a) => s + (a.balance ?? 0), 0))}
            />
            <Metric
              label="Сделки проп-счетов (без дублей)"
              value={new Set(props.flatMap((a) => a.tradeIds)).size}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            ROI = (полученные выплаты − цена аккаунтов − дополнительные расходы) / расходы × 100%.
            Если расходы не указаны, ROI не рассчитывается. Выводы не меняют торговый PnL.
          </p>
          <section className="rounded-xl border p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Проп-фирмы</h2>
              <button className={button} onClick={() => navigate("/accounts?view=prop")}>
                Открыть →
              </button>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Фирмы, челленджи, Funded, расходы и выплаты.
            </p>
          </section>
          <section className="rounded-xl border p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Личные счета</h2>
              <button className={button} onClick={() => navigate("/accounts?view=personal")}>
                Открыть →
              </button>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Собственный депозит, пополнения, торговый результат и выводы.
            </p>
          </section>
        </>
      )}
      {data && view === "personal" && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Личные счета</h2>
            <button disabled={busy} className={button} onClick={() => void create("personal")}>
              <Plus className="mr-1 inline size-4" />
              Добавить счёт
            </button>
          </div>
          {cards(personal)}
          {!personal.length && (
            <p className="text-sm text-muted-foreground">Пока нет личных счетов.</p>
          )}
        </>
      )}
      {data && view === "prop" && !selectedFirm && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Проп-фирмы</h2>
            <button disabled={busy} className={button} onClick={() => void createFirm()}>
              <Plus className="mr-1 inline size-4" />
              Добавить фирму
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.firms
              .filter((f) => !f.archived)
              .map((f) => (
                <button
                  key={f.id}
                  onClick={() => navigate(`/accounts?view=prop&firm=${f.id}`)}
                  className="rounded-xl border bg-card p-4 text-left hover:border-foreground/30"
                >
                  <div className="flex items-center gap-3">
                    {f.logo ? (
                      <img alt="" src={f.logo} className="size-10 rounded-full object-contain" />
                    ) : (
                      <Building2 className="size-8 text-muted-foreground" />
                    )}
                    <h3 className="font-semibold">{f.name}</h3>
                  </div>
                  <p className="mt-3 text-sm">
                    {f.accountCount} аккаунтов · {f.trades} сделок
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Challenge {f.challenge} · Funded {f.funded}
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Расходы</p>
                      {money(f.cost)}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Выплаты</p>
                      {money(f.received)}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Чистый результат выплат</p>
                      <span className={tone(f.profit)}>{money(f.profit)}</span>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">ROI</p>
                      <span className={tone(f.profit)}>{roi(f.roi)}</span>
                    </div>
                  </div>
                </button>
              ))}
          </div>
        </>
      )}
      {data && view === "prop" && selectedFirm && (
        <>
          <button
            className="flex items-center gap-2 text-sm text-muted-foreground"
            onClick={() => navigate("/accounts?view=prop")}
          >
            <ArrowLeft className="size-4" />
            Все фирмы
          </button>
          <FirmEditor key={selectedFirm.id} firm={selectedFirm} refresh={refresh} />
          <button
            className="text-sm text-rose-400"
            onClick={async () => {
              try {
                await postJson("/api/personal-accounts", {
                  action: "firm-remove",
                  id: selectedFirm.id,
                });
                setUndo({ id: selectedFirm.id, kind: "firm" });
                refresh();
                navigate("/accounts?view=prop");
              } catch (e) {
                setError(String(e));
              }
            }}
          >
            Убрать фирму
          </button>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Аккаунты / сделки"
              value={`${selectedFirm.accountCount} / ${selectedFirm.trades}`}
            />
            <Metric label="Расходы" value={money(selectedFirm.cost)} />
            <Metric label="Получено payout" value={money(selectedFirm.received)} />
            <Metric label="ROI" value={roi(selectedFirm.roi)} color={tone(selectedFirm.profit)} />
          </div>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Аккаунты фирмы</h2>
            <button
              disabled={busy}
              className={button}
              onClick={() => void create("prop", selectedFirm.id)}
            >
              <Plus className="mr-1 inline size-4" />
              Добавить аккаунт
            </button>
          </div>
          {cards(props.filter((a) => a.profile?.firmId === selectedFirm.id))}
        </>
      )}
      {data && unconfigured.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold">Не настроены / без фирмы</h2>
          <p className="text-xs text-muted-foreground">
            Это существующие аккаунты из Journal. Настрой их — связи со сделками сохранятся.
          </p>
          {cards(unconfigured)}
        </section>
      )}
      {undo && (
        <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg border bg-card p-3 text-sm">
          Убрано{" "}
          <button
            className="text-sky-400"
            onClick={async () => {
              try {
                await postJson(
                  undo.kind === "account" ? "/api/personal-journal" : "/api/personal-accounts",
                  undo.kind === "account"
                    ? { action: "term-update", id: undo.id, changes: { archived: false } }
                    : {
                        action: undo.kind === "firm" ? "firm-remove" : "movement-remove",
                        id: undo.id,
                        restore: true,
                      },
                );
                setUndo(null);
                refresh();
              } catch (e) {
                setError(String(e));
              }
            }}
          >
            Отменить
          </button>
        </div>
      )}
      {selected && (
        <div
          className="fixed inset-x-0 bottom-0 z-40 flex justify-end bg-black/40"
          style={{ top: "var(--journal-header-offset,56px)" }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) navigate(base);
          }}
        >
          <section className="h-full w-full max-w-2xl overflow-y-auto border-l bg-background">
            <div
              className="sticky z-10 flex items-center justify-between border-b bg-background px-5 py-3"
              style={{ top: 0 }}
            >
              <span>Карточка аккаунта</span>
              <button aria-label="Закрыть аккаунт" onClick={() => navigate(base)}>
                <X className="size-5" />
              </button>
            </div>
            <AccountEditor
              key={selected.id}
              account={selected}
              firms={data?.firms ?? []}
              refresh={refresh}
              createFirm={() => createFirm(false)}
              archive={() => archive(selected)}
              removed={(id) => setUndo({ id, kind: "movement" })}
            />
          </section>
        </div>
      )}
    </div>
  );
}
function FirmEditor({ firm, refresh }: { firm: Firm; refresh: () => void }) {
  const key = `account-firm-draft:${firm.id}`;
  const [draft, setDraft] = useState(() =>
    accountDraft(key, { action: "firm", id: firm.id, name: firm.name, logo: firm.logo }),
  );
  const [error, setError] = useState("");
  const save = useAccountAutosave(key, draft, refresh);
  return (
    <div className="space-y-3 rounded-xl border p-4" onBlurCapture={save.flush}>
      <input
        aria-label="Название фирмы"
        className="w-full bg-transparent text-xl font-semibold outline-none"
        value={draft.name}
        onChange={(e) => setDraft((old) => ({ ...old, name: e.target.value }))}
      />
      <Logo
        value={draft.logo}
        onChange={(logo) => setDraft((old) => ({ ...old, logo }))}
        onError={setError}
      />
      {error && (
        <p role="alert" className="text-sm text-rose-400">
          {error}
        </p>
      )}
      <SaveStatus save={save} />
    </div>
  );
}
function AccountEditor({
  account,
  firms,
  refresh,
  createFirm,
  archive,
  removed,
}: {
  account: Account;
  firms: Firm[];
  refresh: () => void;
  createFirm: () => Promise<string | null>;
  archive: () => Promise<void>;
  removed: (id: string) => void;
}) {
  const key = `account-editor-draft:${account.id}`;
  const [draft, setDraft] = useState(() =>
    accountDraft(key, {
      action: "save",
      id: account.id,
      name: account.name,
      logo: account.logo ?? "",
      profile: account.profile ?? { ...defaultProfile(), startDate: today() },
      draft: true,
    }),
  );
  const p = draft.profile;
  const [error, setError] = useState(""),
    [adding, setAdding] = useState(false);
  const save = useAccountAutosave(key, draft, refresh);
  const change = <K extends keyof AccountProfile>(k: K, v: AccountProfile[K]) =>
    setDraft((old) => ({ ...old, profile: { ...old.profile, [k]: v } }));
  const firm = firms.find((f) => f.id === p.firmId);
  const locked = account.movements.some((m) => m.amount > 0);
  const movementLock = useRef(false);
  async function movement(kind: AccountMovement["kind"]) {
    if (movementLock.current) return;
    movementLock.current = true;
    setAdding(true);
    try {
      await save.flush();
      await postJson("/api/personal-accounts", {
        action: "movement",
        id: crypto.randomUUID(),
        accountId: account.id,
        kind,
        date: today(),
        amount: 0,
        received: 0,
        draft: true,
      });
      refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      movementLock.current = false;
      setAdding(false);
    }
  }
  return (
    <div className="space-y-5 p-5" onBlurCapture={save.flush}>
      <SaveStatus save={save} />
      {error && (
        <p role="alert" className="text-sm text-rose-400">
          {error}
        </p>
      )}
      <label className="grid gap-1 text-sm">
        Название / номер аккаунта
        <input
          aria-label="Название аккаунта"
          className={field}
          value={draft.name}
          onChange={(e) => setDraft((old) => ({ ...old, name: e.target.value }))}
        />
      </label>
      <Logo
        value={draft.logo || (p.kind === "prop" ? (firm?.logo ?? "") : "")}
        onChange={(logo) => setDraft((old) => ({ ...old, logo }))}
        onError={setError}
      />
      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-1 text-sm">
          Тип счёта
          <select
            aria-label="Тип счёта"
            className={field}
            value={p.kind}
            onChange={(e) => change("kind", e.target.value as AccountProfile["kind"])}
          >
            <option value="personal">Личный депозит</option>
            <option value="prop">Проп-аккаунт</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Категория
          <select
            aria-label="Категория"
            className={field}
            value={p.market}
            onChange={(e) => change("market", e.target.value as AccountProfile["market"])}
          >
            <option>Futures</option>
            <option>Forex</option>
            <option>CFD</option>
          </select>
        </label>
      </div>
      {p.market !== "Futures" && <label className="grid gap-1 text-sm">
        Плечо аккаунта
        <div className="flex items-center rounded-md border bg-background px-3">
          <span className="shrink-0 text-muted-foreground">1:</span>
          <input aria-label="Плечо аккаунта" type="number" min={1} step={1} value={p.leverage ?? ""} placeholder="100"
            className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm outline-none"
            onChange={event => { const raw=event.currentTarget.value; const value=raw===""?null:Number(raw); if(value===null||(Number.isSafeInteger(value)&&value>=1))change("leverage",value); }} />
        </div>
      </label>}
      {p.kind === "prop" && (
        <>
          <div className="flex items-end gap-2">
            <label className="grid min-w-0 flex-1 gap-1 text-sm">
              Фирма
              <select
                aria-label="Фирма"
                className={field}
                value={p.firmId}
                onChange={(e) => change("firmId", e.target.value)}
              >
                <option value="">Выбрать фирму</option>
                {firms
                  .filter((f) => !f.archived || f.id === p.firmId)
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
              </select>
            </label>
            <button
              className={button}
              onClick={async () => {
                const id = await createFirm();
                if (id) change("firmId", id);
              }}
            >
              + Фирма
            </button>
          </div>
          {firm && (
            <button
              className="text-left text-sm text-sky-400"
              onClick={() => navigate(`/accounts?view=prop&firm=${firm.id}`)}
            >
              Настройки фирмы «{firm.name}» ↗
            </button>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Num
              label="Размер аккаунта, $"
              value={p.accountSize}
              onChange={(n) =>
                setDraft((old) => ({
                  ...old,
                  profile: {
                    ...old.profile,
                    accountSize: n ?? 0,
                    openingBalance:
                      !locked && old.profile.openingBalance === old.profile.accountSize
                        ? (n ?? 0)
                        : old.profile.openingBalance,
                  },
                }))
              }
            />
            <Num
              label="Цена покупки аккаунта, $"
              value={p.purchasePrice ?? 0}
              onChange={(n) => change("purchasePrice", n ?? 0)}
            />
            <label className="grid gap-1 text-sm">
              Тип / этап
              <select
                aria-label="Тип / этап"
                className={field}
                value={p.stage}
                onChange={(e) => change("stage", e.target.value as AccountProfile["stage"])}
              >
                <option value="Phase 1">Challenge · Phase 1</option>
                <option value="Phase 2">Challenge · Phase 2</option>
                <option value="Funded">Funded</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              Drawdown
              <select
                aria-label="Drawdown"
                className={field}
                value={p.drawdownType}
                onChange={(e) =>
                  change("drawdownType", e.target.value as AccountProfile["drawdownType"])
                }
              >
                <option>Static</option>
                <option>EOD Trailing</option>
              </select>
            </label>
            <Num
              label="Drawdown, $"
              value={p.drawdown}
              onChange={(n) => change("drawdown", n ?? 0)}
            />
            <Num
              label="Дневной лимит, $"
              optional
              value={p.dailyLimit}
              onChange={(n) => change("dailyLimit", n)}
            />
          </div>
          {p.stage !== "Funded" && (
            <div className="grid grid-cols-2 gap-3">
              {(["phase1Target", "phase2Target"] as const).map((k, i) => (
                <div key={k} className="space-y-2">
                  <Num
                    label={`Profit target Phase ${i + 1}, $`}
                    value={p[k]}
                    onChange={(n) => change(k, n ?? 0)}
                  />
                  <Num
                    label={`Profit target Phase ${i + 1}, %`}
                    value={p.accountSize ? Math.round((p[k] / p.accountSize) * 10000) / 100 : 0}
                    onChange={(n) => change(k, Math.round(p.accountSize * (n ?? 0)) / 100)}
                  />
                </div>
              ))}
            </div>
          )}
          {p.stage === "Funded" && (
            <Num
              label="Доля трейдера, %"
              value={p.traderShare}
              onChange={(n) => change("traderShare", n ?? 0)}
            />
          )}
        </>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Num
          label="Баланс на начало учёта, $"
          value={p.openingBalance}
          disabled={locked}
          onChange={(n) => change("openingBalance", n ?? 0)}
        />
        <label className="grid gap-1 text-sm">
          Дата начала учёта
          <input
            type="date"
            aria-label="Дата начала учёта"
            className={field}
            disabled={locked}
            value={p.startDate}
            onChange={(e) => change("startDate", e.target.value)}
          />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        Начальный баланс — до первой переносимой сделки. После движений денег он фиксируется. Этапы
        меняются вручную, баланс при переходе автоматически не сбрасывается. EOD Trailing пока
        хранится как правило, не вычисляется.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Metric
          label={`Баланс${account.missingPnl ? " · неполный" : ""}`}
          value={account.balance === null ? "—" : money(account.balance)}
        />
        <Metric label="Торговый PnL" value={money(account.pnl)} color={tone(account.pnl)} />
        {p.kind === "prop" && (
          <>
            <Metric label="Расходы" value={money(account.cost)} />
            <Metric label="ROI выплат" value={roi(account.roi)} />
          </>
        )}
      </div>
      {account.potential&&<section className="space-y-2 rounded-lg border p-4" aria-label="Недобор аккаунта">
        <h3 className="font-semibold">Реализация и упущенный потенциал · Live</h3>
        <p className="text-sm">Реализовано {money(account.pnl)} · Недобрано {account.potential.missedCash===null?'не оценено':money(account.potential.missedCash)}</p>
        <p className="text-sm">Реализованный RR: {account.potential.actualRR??'—'}R · Недобранный RR: {account.potential.missedRR??'—'}R</p>
        <p className="text-xs text-muted-foreground">Деньги оценены по {account.potential.cashCompared} из {account.trades} сделок; RR — по {account.potential.rrCompared}. Это оценки, не доход и не баланс. RR один раз на идею; не суммируй его между аккаунтами.</p>
        {!!account.potential.scenarios?.length&&<div className="rounded border p-3"><p className="text-sm">Неоткрытые идеи · {account.potential.scenarios.length}<PotentialRRHint value={account.potential.scenarioRR}/></p><p className="text-xs text-muted-foreground">Модельный PNL: {account.potential.scenarioCash===null?'не оценено':money(account.potential.scenarioCash)} · не влияет на баланс</p>{account.potential.scenarios.map(row=><Link key={row.id} className="block text-xs" href={'/trades?entry='+row.id}>#{row.tradeNo} · {row.date}<PotentialRRHint value={row.rr}/></Link>)}</div>}
        {account.potential.rows.map(row=><Link key={row.id} href={`/trades?entry=${row.id}`} className="block rounded px-2 py-1 text-xs hover:bg-accent">#{row.tradeNo} · {row.date} · потенциал {row.cash===null?'—':money(row.cash)} · недобрано {row.missed===null?'—':money(row.missed)}</Link>)}
      </section>}
      <h3 className="font-semibold">Движение денег</h3>
      {!!account.volumes?.length && <div className="rounded-lg border p-3">
        <h3 className="mb-2 text-sm font-semibold">Проторгованный объём · Live</h3>
        {account.volumes.map(v => <div key={`${v.asset}:${v.unit}`} className="flex justify-between gap-3 text-sm">
          <span>{v.asset}</span><b>{new Intl.NumberFormat("ru-RU",{maximumFractionDigits:8}).format(v.quantity)} {volumeLabels[v.unit]}</b>
        </div>)}
        <p className="mt-2 text-xs text-muted-foreground">Сумма объёмов входа по сделкам этого аккаунта, без удвоения на выходе.</p>
      </div>}
      <div className="flex flex-wrap gap-2">
        {(p.kind === "personal"
          ? ["deposit", "withdrawal"]
          : p.stage === "Funded"
            ? ["payout", "expense"]
            : ["expense"]
        ).map((k) => (
          <button
            key={k}
            disabled={adding || !account.profile}
            className={button}
            onClick={() => void movement(k as AccountMovement["kind"])}
          >
            {k === "deposit"
              ? "Пополнение"
              : k === "withdrawal"
                ? "Вывод"
                : k === "payout"
                  ? "Payout"
                  : "Добавить расход"}
          </button>
        ))}
      </div>
      {account.movements.map((m) => (
        <MovementEditor
          key={m.id}
          movement={m}
          share={p.traderShare}
          refresh={refresh}
          removed={removed}
        />
      ))}
      {!account.movements.length && (
        <p className="text-sm text-muted-foreground">Операций пока нет.</p>
      )}
      <h3 className="font-semibold">История этапов</h3>
      {account.phases.map((h, i) => (
        <p key={i} className="text-sm text-muted-foreground">
          {h.date.slice(0, 10)} · {h.stage}
        </p>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/catalogs?kind=account&term=${account.id}`}
          className="text-sm text-sky-400 hover:underline"
        >
          Связанные сделки ↗
        </Link>
        <button
          className="text-sm text-rose-400"
          onClick={() => void save.flush().then(() => archive())}
        >
          <Trash2 className="mr-1 inline size-4" />
          Убрать аккаунт
        </button>
      </div>
    </div>
  );
}
function MovementEditor({
  movement,
  share,
  refresh,
  removed,
}: {
  movement: AccountMovement;
  share: number;
  refresh: () => void;
  removed: (id: string) => void;
}) {
  const key = `account-movement-draft:${movement.id}`;
  const [draft, setDraft] = useState(() =>
    accountDraft(key, { action: "movement", ...movement, draft: true }),
  );
  const save = useAccountAutosave(key, draft, refresh);
  const [error, setError] = useState("");
  return (
    <div className="space-y-3 rounded-lg border p-3" onBlurCapture={save.flush}>
      <div className="flex justify-between">
        <b className="text-sm">
          {draft.kind === "deposit"
            ? "Пополнение"
            : draft.kind === "withdrawal"
              ? "Вывод"
              : draft.kind === "expense"
                ? "Расход"
                : "Payout"}
        </b>
        <button
          aria-label="Убрать операцию"
          onClick={async () => {
            await save.flush();
            try {
              await postJson("/api/personal-accounts", { action: "movement-remove", id: draft.id });
              removed(draft.id);
              refresh();
            } catch (e) {
              setError(String(e));
            }
          }}
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-1 text-sm">
          Дата
          <input
            aria-label="Дата операции"
            type="date"
            className={field}
            value={draft.date}
            onChange={(e) => setDraft((old) => ({ ...old, date: e.target.value }))}
          />
        </label>
        <Num
          label={
            draft.kind === "expense"
              ? "Сумма расхода, $"
              : draft.kind === "deposit"
                ? "Пополнение, $"
                : "Списано с баланса, $"
          }
          value={draft.amount}
          onChange={(n) =>
            setDraft((old) => ({
              ...old,
              amount: n ?? 0,
              received: (n ?? 0) * (draft.kind === "payout" ? share / 100 : 1),
            }))
          }
        />
        {draft.kind === "payout" && (
          <Num
            label="Получено мной, $"
            value={draft.received}
            onChange={(n) => setDraft((old) => ({ ...old, received: n ?? 0 }))}
          />
        )}
      </div>
      {draft.kind === "payout" && (
        <p className="text-xs text-muted-foreground">
          Фирме / удержано: {money(draft.amount - draft.received)}
        </p>
      )}
      <input
        aria-label="Заметка операции"
        className={field}
        placeholder="Заметка"
        value={draft.note}
        onChange={(e) => setDraft((old) => ({ ...old, note: e.target.value }))}
      />
      {draft.amount === 0 && (
        <p className="text-xs text-muted-foreground">
          Укажи сумму — пока операция не влияет на итоги.
        </p>
      )}
      <SaveStatus save={save} />
      {error && <p className="text-sm text-rose-400">{error}</p>}
    </div>
  );
}
