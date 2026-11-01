import seed from "./generated/demo-data.json";
import {
  computeOverview,
  computeEdgeScore,
  calendarMonthFromDays,
  dailyCumulativeFromDays,
  readFilters,
  matchesFilters,
  bySymbol,
  byTag,
  byMistake,
  byPlaybook,
  byWeekday,
  byHour,
  byDuration,
  byDirection,
  analyzeAdherence,
  analyzeGroups,
  summarizeGroup,
  DIMENSIONS,
} from "@golden-tablet/journal-core";
import { calendarRunningPnl } from "@/lib/calendar-insights";
import { performanceTrends } from "@/lib/performance-trends";
import { workflowCommands } from "@/lib/workflow";
import { emptyProcessReport } from "@/lib/process-equity";
import { accountPotentialSummary } from "@/lib/trade-potential";
import { defaultProfile, accountBalance, payoutRoi } from "@/lib/personal-accounts";
import { tradeExplorerPoints } from "@/lib/trade-explorer";

type Row = Record<string, any>;
const PREFIX = "golden-tablet-demo:" + (import.meta.env.BASE_URL ?? "/") + ":";
const STORAGE = PREFIX + "data-v1";
const nativeStorage = window.localStorage;
(window as any).__goldenDemoStorage = {
  getItem: (key: string) => nativeStorage.getItem(PREFIX + "ui:" + key),
  setItem: (key: string, value: string) => nativeStorage.setItem(PREFIX + "ui:" + key, value),
  removeItem: (key: string) => nativeStorage.removeItem(PREFIX + "ui:" + key),
};
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
let state: Row = clone(seed);
try {
  const saved = localStorage.getItem(STORAGE);
  if (saved) state = JSON.parse(saved);
} catch {
  /* A fresh demo also works when browser storage is unavailable. */
}
const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const journal = () => state["/api/personal-journal"];
const accounts = () => state["/api/personal-accounts"];
const persist = () => localStorage.setItem(STORAGE, JSON.stringify(state));
const response = (value: any, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
export function resetDemo() {
  for (let i = nativeStorage.length - 1; i >= 0; i--) {
    const key = nativeStorage.key(i)!;
    if (key.startsWith(PREFIX)) nativeStorage.removeItem(key);
  }
  location.href = import.meta.env.BASE_URL;
}

function projectedTrades() {
  const prior = new Map(state["/api/trades"].trades.map((t: Row) => [t.key, t]));
  const names = new Map(journal().terms.map((t: Row) => [t.id, t.name]));
  return journal()
    .entries.filter((e: Row) => e.mode === "Forward")
    .flatMap((e: Row) => {
      const result = names.get(e.terms.result?.[0]);
      if (!["Win", "Loss", "BE", "Breakeven"].includes(result as string)) return [];
      return e.accounts
        .filter((a: Row) => a.pnlCash != null)
        .map((a: Row, index: number) => {
          const key = index ? e.id + "@" + a.accountId : e.id;
          const old = prior.get(key) as Row | undefined;
          const entryPrice = old?.avgEntry ?? 0;
          const parse = (value: any) => {
            try {
              return JSON.parse(value ?? "[]");
            } catch {
              return [];
            }
          };
          return {
            ...old,
            key,
            accountId: a.accountId,
            symbol: names.get(e.terms.instrument?.[0]) ?? "XAUUSD",
            assetClass: a.quantityUnit === "contracts" ? "futures" : "cfd",
            direction: e.direction === "Short" ? "short" : "long",
            status: result === "Win" ? "win" : result === "Loss" ? "loss" : "breakeven",
            openedAt: e.date + "T" + (e.openedAt || "12:00") + ":00+05:00",
            closedAt: e.date + "T" + (e.closedAt || e.openedAt || "12:00") + ":00+05:00",
            avgEntry: entryPrice,
            avgExit: old?.avgExit,
            quantity: a.quantity ?? 1,
            openQuantity: 0,
            contractMultiplier: 100,
            netPnl: a.pnlCash,
            grossPnl: a.pnlCash + (old?.fees ?? 0),
            fees: old?.fees ?? 0,
            durationMs: old?.durationMs ?? 0,
            executionIds: parse(old?.executionIdsJson),
            exits: parse(old?.exitsJson),
            executionCount: old?.executionCount ?? 0,
            annotations: {
              tags: (e.terms.setup ?? []).map((t: string) => names.get(t)),
              mistakes: parse(old?.mistakesJson),
              playbook: e.terms.setup?.[0],
              stopLoss: old?.stopLoss,
              profitTarget: old?.profitTarget,
              reviewed: true,
            },
          };
        });
    });
}
function selectedTrades(params: URLSearchParams) {
  const filters = readFilters(params);
  return projectedTrades().filter((t: Row) => matchesFilters(t as any, filters, "Asia/Almaty"));
}
function stats(params: URLSearchParams) {
  const trades = selectedTrades(params),
    selected = accounts().accounts.filter(
      (a: Row) => !params.get("accounts") || params.get("accounts")!.split(",").includes(a.id),
    );
  const initialBalance = selected.reduce(
    (s: number, a: Row) => s + (a.profile.openingBalance ?? a.profile.accountSize ?? 0),
    0,
  );
  const { metrics, days, equity } = computeOverview(trades, {
    timeZone: "Asia/Almaty",
    initialBalance,
  });
  return {
    ...state["/api/stats"],
    metrics,
    days,
    equity,
    edgeScore: computeEdgeScore(metrics),
    initialBalance,
    dailyCumulative: dailyCumulativeFromDays(days),
    accounts: accounts().accounts.map((a: Row) => ({ id: a.id, name: a.name })),
    playbooks: state["/api/playbooks"].playbooks,
    calendar: calendarMonthFromDays(
      days,
      Number(params.get("calYear") ?? 2026),
      Number(params.get("calMonth") ?? 10),
    ),
    runningPnl: calendarRunningPnl(trades, "Asia/Almaty"),
    buckets: {
      symbol: bySymbol(trades),
      tag: byTag(trades),
      mistake: byMistake(trades),
      playbook: byPlaybook(trades),
      weekday: byWeekday(trades, "Asia/Almaty"),
      hour: byHour(trades, "Asia/Almaty"),
      duration: byDuration(trades),
      direction: byDirection(trades),
    },
    openPositions: [],
    recentTrades: [...trades]
      .sort((a: Row, b: Row) => b.closedAt.localeCompare(a.closedAt))
      .slice(0, 10)
      .map((t: Row) => ({ ...t, currency: "USD" })),
  };
}
function accountData() {
  const data = clone(accounts());
  for (const account of data.accounts) {
    const entries = journal().entries.filter(
      (e: Row) =>
        e.mode === "Forward" &&
        ["Win", "Loss", "BE", "Breakeven"].includes(
          journal().terms.find((t: Row) => t.id === e.terms.result?.[0])?.name,
        ),
    );
    const results = entries.flatMap((e: Row) =>
      e.accounts.filter((a: Row) => a.accountId === account.id),
    );
    account.pnl = results.reduce((s: number, a: Row) => s + (a.pnlCash ?? 0), 0);
    account.trades = results.length;
    account.balance = accountBalance(
      account.profile.openingBalance ?? 0,
      account.pnl,
      account.movements ?? [],
    );
    account.tradeIds = entries
      .filter((e: Row) => e.accounts.some((a: Row) => a.accountId === account.id))
      .map((e: Row) => e.id);
    account.received = (account.movements ?? [])
      .filter((m: Row) => m.kind === "payout")
      .reduce((s: number, m: Row) => s + (m.received ?? 0), 0);
    account.cost =
      (account.profile.purchasePrice ?? 0) +
      (account.movements ?? [])
        .filter((m: Row) => m.kind === "expense")
        .reduce((s: number, m: Row) => s + m.amount, 0);
    account.roi = payoutRoi(account.cost, account.received);
    account.potential = accountPotentialSummary(journal().entries, account.id, journal().terms);
    account.name = journal().terms.find((t: Row) => t.id === account.id)?.name ?? account.name;
  }
  return data;
}
function get(path: string, params: URLSearchParams): any {
  if (path === "/api/stats") return stats(params);
  if (path === "/api/personal-accounts") return accountData();
  if (path === "/api/trading-review")
    return {
      ...state[path],
      entries: journal().entries.filter((e: Row) => e.mode === "Forward"),
      terms: journal().terms,
    };
  if (path === "/api/accounts")
    return {
      accounts: accountData().accounts.map((a: Row) => ({
        id: a.id,
        name: a.name,
        currency: "USD",
        initialBalance: a.profile.openingBalance,
        kind: "manual",
      })),
    };
  if (path === "/api/workflow") return { cards: state[path].cards.filter((c: Row) => !c.deleted) };
  if (path === "/api/session-entries")
    return {
      entries: state.sessions.filter(
        (e: Row) =>
          !e.deleted &&
          e.dayKey === params.get("date") &&
          (e.reviewKind ?? "day") === (params.get("kind") ?? "day"),
      ),
    };
  if (path === "/api/notes") {
    let notes = state[path].notes.filter((n: Row) => !n.deleted);
    const folder = params.get("folder"),
      q = params.get("q")?.toLowerCase();
    if (folder && folder !== "all") notes = notes.filter((n: Row) => n.folderId === folder);
    if (q) notes = notes.filter((n: Row) => (n.title + " " + n.content).toLowerCase().includes(q));
    return { ...state[path], notes };
  }
  if (path === "/api/analysis") {
    const trades = selectedTrades(params),
      primary = params.get("primary") ?? "symbol",
      secondary = params.get("secondary");
    return {
      ...state[path],
      summary: summarizeGroup(trades),
      groups: analyzeGroups(
        trades,
        (Object.hasOwn(DIMENSIONS, primary) ? primary : "symbol") as any,
        secondary as any,
        "Asia/Almaty",
      ),
    };
  }
  if (path === "/api/performance-trends")
    return { ...state[path], trends: performanceTrends(selectedTrades(params)) };
  if (path === "/api/adherence")
    return {
      books: analyzeAdherence(
        selectedTrades(params),
        state["/api/playbooks"].playbooks,
        state.ruleChecks ?? [],
      ).map((book: any) => ({ ...book, currencies: ["USD"] })),
    };
  if (path === "/api/trade-explorer")
    return { ...state[path], points: tradeExplorerPoints(selectedTrades(params), "Asia/Almaty") };
  if (path === "/api/trades") return { ...state[path], trades: selectedTrades(params) };
  if (path === "/api/attachments") return { attachments: [] };
  if (path === "/api/folders") return { folders: state["/api/notes"].folders };
  if (path === "/api/playbooks")
    return {
      playbooks: state[path].playbooks.map((p: Row) => ({
        ...p,
        tradeCount: projectedTrades().filter((t: Row) => t.annotations.playbook === p.id).length,
      })),
    };
  if (state[path]) return state[path];
  throw Error(
    "Этот инструмент доступен в полной локальной версии. Основные разделы демо работают без сервера.",
  );
}
function write(path: string, b: Row, method: string) {
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  if (base && typeof b.url === "string" && b.url.startsWith(base + "/"))
    b.url = b.url.slice(base.length);
  if (path === "/api/personal-journal") {
    const data = journal();
    let entry = data.entries.find((e: Row) => e.id === b.id);
    if (b.action === "create") {
      entry = {
        ...clone(seed["/api/personal-journal"].entries[0]),
        id: id(),
        tradeNo: Math.max(0, ...data.entries.map((e: Row) => e.tradeNo)) + 1,
        date: "2026-10-30",
        direction: "",
        openedAt: "",
        closedAt: "",
        riskTicks: null,
        realisedTicks: null,
        realisedR: null,
        mfe: null,
        mae: null,
        quickNote: "",
        bodyTitle: "Новая сделка",
        bodyText: "",
        bodyBlocks: [],
        terms: {},
        accounts: [],
        classification: {},
        potential: {
          enabled: false,
          rr: null,
          ticks: null,
          basis: "",
          comment: "",
          accountCash: {},
        },
      };
      data.entries.push(entry);
    } else if (b.action === "update") {
      if (!entry) throw Error("Сделка не найдена");
      Object.assign(entry, b.changes);
    } else if (b.action === "delete") {
      data.entries = data.entries.filter((e: Row) => e.id !== b.id);
      data.trashed.push(entry);
    } else if (b.action === "restore") {
      entry = data.trashed.find((e: Row) => e.id === b.id);
      data.trashed = data.trashed.filter((e: Row) => e.id !== b.id);
      if (entry) data.entries.push(entry);
    } else if (b.action === "term") {
      const term = {
        id: id(),
        kind: b.kind,
        name: b.name,
        description: "",
        logo: "",
        archived: false,
      };
      data.terms.push(term);
      return { term };
    } else if (b.action === "term-update") {
      const term = data.terms.find((t: Row) => t.id === b.id);
      Object.assign(term, b.changes);
      return { term };
    }
    return {
      entry,
      numbers: data.entries.map((e: Row) => ({
        id: e.id,
        tradeNo: e.tradeNo,
        numberSeries: e.numberSeries,
      })),
    };
  }
  if (path === "/api/trading-review") {
    const reviews = state[path].reviews;
    let review = reviews.find((r: Row) => r.key === b.key && r.kind === b.kind);
    if (!review) {
      review = { ...b };
      reviews.push(review);
    } else Object.assign(review, b);
    return { review };
  }
  if (path === "/api/session-entries") {
    let entry = state.sessions.find((e: Row) => e.id === b.id);
    if (b.action === "create") {
      entry = {
        id: id(),
        dayKey: b.date,
        createdAt: now(),
        reviewKind: b.kind ?? "day",
        blocks: [{ id: id(), kind: "text", text: "" }],
      };
      state.sessions.push(entry);
    } else if (entry) {
      if (b.action === "update") entry.blocks = b.blocks;
      else entry.deleted = b.action === "delete";
    }
    return { entry, saved: true };
  }
  if (path === "/api/workflow") {
    const cards = state[path].cards;
    let card = cards.find((c: Row) => c.id === b.id);
    const create = (input: Row) => {
      const card = {
        id: id(),
        source: "manual:demo",
        url: "/workflow",
        label: "Запись демо",
        slot: 0,
        text: "",
        category: "задача",
        status: "inbox",
        detached: false,
        blocks: [],
        sourceImages: [],
        created_at: now(),
        updated_at: now(),
        status_changed_at: now(),
        ...input,
      };
      cards.push(card);
      return card;
    };
    if (b.action === "create") card = create(b);
    else if (b.action === "duplicate")
      card = create({
        ...clone(card),
        id: id(),
        created_at: now(),
        updated_at: now(),
        status_changed_at: now(),
      });
    else if (b.action === "delete" || b.action === "restore") card.deleted = b.action === "delete";
    else if (b.action === "category") card.category = b.category;
    else if (b.action === "move") {
      card.status = b.status;
      card.status_changed_at = now();
    } else if (b.action === "update") {
      if (b.text !== undefined) card.text = b.text;
      if (b.blocks) card.blocks = b.blocks;
      card.updated_at = now();
    } else if (b.source) {
      for (const previous of cards.filter((c: Row) => c.source === b.source))
        previous.detached = true;
      for (const command of workflowCommands(b.text ?? "")) {
        const old = cards.find((c: Row) => c.source === b.source && c.slot === command.slot);
        if (old) Object.assign(old, command, { detached: false });
        else create({ ...command, source: b.source, url: b.url, label: b.label });
      }
    }
    return { id: card?.id, ok: true };
  }
  if (path === "/api/process-progress") {
    const reports = state[path].reports;
    let report = reports.find((r: Row) => r.date === b.date);
    if (!report) {
      report = emptyProcessReport(b.date);
      reports.push(report);
    }
    if (b.op === "item") {
      const item = report.items.find((i: Row) => i.id === b.id);
      for (const key of ["text", "name", "score"]) if (b[key] !== undefined) item[key] = b[key];
    }
    if (b.op === "add") report.items.push({ id: id(), name: b.name, text: "", score: null });
    if (b.op === "remove") report.items = report.items.filter((i: Row) => i.id !== b.id);
    if (b.op === "weekly")
      for (const key of ["text", "score"]) if (b[key] !== undefined) report.weekly[key] = b[key];
    report.revision = (report.revision ?? 0) + 1;
    report.updatedAt = now();
    return { report };
  }
  if (path === "/api/notes") {
    const row = {
      id: id(),
      folderId: b.folderId ?? "my-notes",
      title: b.title ?? "",
      content: b.content ?? "",
      tagsJson: JSON.stringify(b.tags ?? []),
      createdAt: now(),
      updatedAt: now(),
    };
    state[path].notes.push(row);
    return { id: row.id };
  }
  if (path.startsWith("/api/notes/")) {
    const row = state["/api/notes"].notes.find((n: Row) => n.id === path.split("/").at(-1));
    if (method === "DELETE") row.deleted = true;
    else Object.assign(row, b, { updatedAt: now() });
    return { updated: true };
  }
  if (path === "/api/folders") {
    const folder = { id: id(), name: b.name, kind: "custom", createdAt: now() };
    state["/api/notes"].folders.push(folder);
    return { id: folder.id };
  }
  if (path === "/api/playbooks") {
    const row = {
      id: id(),
      name: b.name,
      description: b.description ?? "",
      rules: b.rules ?? [],
      tradeCount: 0,
    };
    state[path].playbooks.push(row);
    return { id: row.id };
  }
  if (path.startsWith("/api/playbooks/")) {
    const key = path.split("/").at(-1);
    const rows = state["/api/playbooks"].playbooks;
    if (method === "DELETE")
      state["/api/playbooks"].playbooks = rows.filter((p: Row) => p.id !== key);
    else
      Object.assign(
        rows.find((p: Row) => p.id === key),
        b,
      );
    return { updated: true };
  }
  if (path === "/api/personal-accounts") {
    const data = accounts();
    if (b.action === "account-create") {
      const key = id(),
        name = b.kind === "prop" ? "Новый проп-счёт" : "Личный счёт";
      const term = { id: key, kind: "account", name, description: "", logo: "", archived: false };
      journal().terms.push(term);
      data.accounts.push({
        ...term,
        profile: { ...defaultProfile(), kind: b.kind, firmId: b.firmId ?? "", market: "CFD" },
        movements: [],
        phases: [],
        volumes: [],
        tradeIds: [],
        pnl: 0,
        trades: 0,
        balance: 0,
        cost: 0,
        received: 0,
        roi: null,
      });
      return { id: key };
    }
    if (b.action === "firm-create") {
      const firm = {
        id: id(),
        name: "Новая фирма",
        logo: "",
        archived: false,
        accountCount: 0,
        cost: 0,
        received: 0,
        profit: 0,
        trades: 0,
      };
      data.firms.push(firm);
      return { id: firm.id };
    }
    if (b.action === "firm") {
      let firm = data.firms.find((f: Row) => f.id === b.id);
      if (!firm) {
        firm = { id: b.id ?? id(), accountCount: 0, cost: 0, received: 0, profit: 0, trades: 0 };
        data.firms.push(firm);
      }
      Object.assign(firm, { name: b.name, logo: b.logo ?? firm.logo ?? "" });
      return { id: firm.id };
    }
    if (b.action === "firm-remove") {
      const firm = data.firms.find((f: Row) => f.id === b.id);
      if (firm) firm.archived = true;
      return { ok: true };
    }
    if (b.action === "save") {
      const account = data.accounts.find((a: Row) => a.id === b.id);
      if (account) {
        if (b.profile) account.profile = b.profile;
        if (b.name) {
          account.name = b.name;
          const term = journal().terms.find((t: Row) => t.id === b.id);
          if (term) term.name = b.name;
        }
      }
      return { id: b.id };
    }
    if (b.action === "movement") {
      const account = data.accounts.find((a: Row) => a.id === b.accountId);
      const movement = { ...b, id: b.id ?? id() };
      account.movements = (account.movements ?? []).filter((m: Row) => m.id !== movement.id);
      account.movements.push(movement);
      return { id: movement.id };
    }
    if (b.action === "movement-remove") {
      for (const a of data.accounts) a.movements = a.movements.filter((m: Row) => m.id !== b.id);
      return { ok: true };
    }
  }
  throw Error(
    "Этот инструмент требует полной локальной версии. В демо доступны сделки, разборы, Workflow, заметки и оценки.",
  );
}
export function installDemoApi() {
  const original = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = new URL(
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
      location.origin,
    );
    if (!url.pathname.startsWith("/api/")) return original(input, init);
    const method = init?.method ?? "GET";
    if (method === "GET") {
      try {
        return response(get(url.pathname, url.searchParams));
      } catch (error) {
        return response({ error: (error as Error).message }, 501);
      }
    }
    const before = clone(state);
    try {
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
      const result = write(url.pathname, body, method);
      persist();
      return response(result);
    } catch (error) {
      state = before;
      return response(
        {
          error:
            (error as Error).name === "QuotaExceededError"
              ? "Хранилище браузера заполнено. Сбрось демо, чтобы начать заново."
              : (error as Error).message,
        },
        400,
      );
    }
  };
}
