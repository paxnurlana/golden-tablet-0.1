"use client";
import {uploadAttachment} from './video-upload';
import { SlashTextarea } from "@/components/slash-textarea";
import { journalNumberConflictIds } from "@/lib/journal-number-conflicts";
import {sortJournalEntries,type JournalSort} from '@/lib/journal-row-order';
import { readApiSnapshot, writeApiSnapshot, clearApiSnapshots, useApi } from "@/lib/use-api";
import { AccountMoneyFields } from "./account-money-fields";
import { volumeUnit, volumeLabels } from "@/lib/trade-volume";
import { leadingDecimalZero, parseDecimalInput } from "@/lib/decimal-input";
import { DETAILS } from "@/lib/trade-classification";
import type { AccountProfile } from "@/lib/personal-accounts";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { JournalTradeSummary } from "./journal-trade-summary";
import {TradePotentialEditor,AccountPotentialField} from './trade-potential-editor';
import {PotentialRRHint} from './potential-rr-hint';
import {opportunityRR} from '@/lib/trade-potential';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Trash2, X, Circle, Plus } from "lucide-react";
import { JournalBodyEditor } from "@/components/journal-body-editor";
import {JournalMetrics} from './journal-metrics';
import {JournalPnlCell} from './journal-pnl-cell';
import {matchesTradeScope,type JournalTradeScope} from '@/lib/journal-trade-scope';
import {isScenarioEntry} from '@/lib/trade-accounting';
import type { AccountResult, JournalEntry, Term, TermKind } from "@/server/personal-journal";
import { JournalChoicePicker, JournalPopover } from "@/components/journal-popover";
import { JournalToolbar } from "@/components/journal-toolbar";
import { JournalDatePicker } from "@/components/journal-date-picker";
import { JournalCardProperties } from "@/components/journal-card-properties";
import { useJournalReorder } from "@/components/use-journal-reorder";
import {
  JournalResultIcon,
  JournalFieldIcon,
  JournalTermIcon,
  JournalResultBadge,
} from "@/components/journal-icons";
import { coverForResult } from "@/lib/journal-covers";
import {
  DEFAULT_PERIOD,
  EMPTY_FILTER,
  matchesFilters,
  periodBounds,
  RESULT_ORDER,
  formatJournalDate,
  MODE_LABELS,
  type FilterGroup,
  type Period,
} from "@/lib/journal-filters";

type Data = { entries: JournalEntry[]; terms: Term[]; trashed: JournalEntry[] };
type Column =
  | "tradeNo"
  | "date"
  | "mode"
  | "result"
  | "type"
  | "direction"
  | "instrument"
  | "setup"
  | "storyline"
  | "account"
  | "realisedR"
  | "pnlCash"
  | "mfe"
  | "mae"
  | "quickNote";
const initialColumns: Column[] = [
  "tradeNo",
  "date",
  "mode",
  "result",
  "type",
  "direction",
  "instrument",
  "setup",
  "storyline",
  "account",
  "realisedR",
  "pnlCash",
  "mfe",
  "mae",
  "quickNote",
];
const initialWidths: Record<Column, number> = {
  tradeNo: 100,
  date: 126,
  mode: 120,
  result: 160,
  type: 160,
  direction: 115,
  instrument: 140,
  setup: 200,
  storyline: 200,
  account: 120,
  realisedR: 126,
  pnlCash: 140,
  mfe: 95,
  mae: 95,
  quickNote: 300,
};
const names: Record<Column, string> = {
  tradeNo: "Trade",
  date: "Дата",
  mode: "Режим",
  result: "Результат",
  type: "Type",
  direction: "Позиция",
  instrument: "Asset",
  setup: "Setup",
  storyline: "Storyline",
  account: "Аккаунты",
  realisedR: "Realised RR",
  pnlCash: "PNL · $",
  mfe: "MFE",
  mae: "MAE",
  quickNote: "Заметка",
};
const kindNames: Record<TermKind, string> = {
  result: "Результат",
  account: "Аккаунт",
  instrument: "Asset",
  setup: "Setup",
  storyline: "Storyline",
  trigger: "Trigger",
  vp: "VP Context",
  vwap: "VWAP Context",
  type: "Type",
};
const relationKinds: TermKind[] = [
  "result",
  "instrument",
  "setup",
  "storyline",
  "trigger",
  "vp",
  "vwap",
];
const fieldStyle =
  "w-full min-h-9 rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus:border-sky-500";
const resultSymbol: Record<string, string> = {
  Win: "🏆",
  Loss: "↓",
  BE: "=",
  Missed: "◎",
  НЛО: "?",
  Hypothesis: "◇",
};

async function api(body: Record<string, unknown>) {
  const response = await fetch("/api/personal-journal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.error || "Не удалось сохранить");
  clearApiSnapshots();
  return json;
}
function linked(entry: JournalEntry, kind: TermKind, terms: Term[]) {
  const values = (entry.terms[kind] ?? []).map(
    (id) => terms.find((term) => term.id === id)?.name ?? "?",
  );
  return kind === "result"
    ? values.sort(
        (a, b) =>
          (RESULT_ORDER.indexOf(a) < 0 ? 99 : RESULT_ORDER.indexOf(a)) -
          (RESULT_ORDER.indexOf(b) < 0 ? 99 : RESULT_ORDER.indexOf(b)),
      )
    : values;
}
function Field({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-2 py-1 max-sm:grid-cols-1">
      <span className="pt-1.5 text-sm text-muted-foreground">{name}</span>
      <div>{children}</div>
    </div>
  );
}

export function PersonalJournalClient() {
  const navigationQuery = useSearchParams().toString();
  const [data, setData] = useState<Data>({ entries: [], terms: [], trashed: [] });
  const [ready, setReady] = useState(false);
  const [creating,setCreating]=useState(false);
  const creatingRef=useRef(false);
  const [error, setError] = useState("");
  const [selectedId, setSelectedIdState] = useState<string | null>(null);
  const setSelectedId = (id: string | null) => {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("entry", id);
    else url.searchParams.delete("entry");
    window.history.pushState(null, "", url.pathname + url.search + url.hash);
    setSelectedIdState(id);
  };
  const panelRef = useRef<HTMLElement>(null);
  const bodyImagePaste = useRef<((file:File)=>Promise<void>) | null>(null);
  const selectionRef = useRef(selectedId);
  selectionRef.current = selectedId;
  const [propertyMenuContainer, setPropertyMenuContainer] = useState<HTMLDivElement | null>(null);
  const [undoEntry, setUndoEntry] = useState<{ id: string; tradeNo: number } | null>(null);
  const [mode, setMode] = useState<"All" | "Forward" | "Back">("All");
  const [tradeScope,setTradeScope]=useState<JournalTradeScope>('All');
  const [period, setPeriod] = useState<Period>(DEFAULT_PERIOD);
  const [filters, setFilters] = useState<FilterGroup>(EMPTY_FILTER);
  const [viewReady, setViewReady] = useState(false);
  const [query, setQuery] = useState("");
  const [rowSort,setRowSort]=useState<JournalSort>({key:'date',direction:'asc'});
  const [manualRows,setManualRows]=useState<string[]>([]);
  const [rowOrderReady,setRowOrderReady]=useState(false);
  const suppressRowClick=useRef(false);
  useEffect(()=>{try{const saved=JSON.parse(localStorage.getItem('journal-row-order-v1')||'null');if(saved){if(saved.sort===null||(initialColumns.includes(saved.sort?.key)&&['asc','desc'].includes(saved.sort?.direction)))setRowSort(saved.sort);if(Array.isArray(saved.manual))setManualRows(saved.manual.filter((id:unknown)=>typeof id==='string'));}}catch{}setRowOrderReady(true);},[]);
  useEffect(()=>{if(rowOrderReady)try{localStorage.setItem('journal-row-order-v1',JSON.stringify({sort:rowSort,manual:manualRows}));}catch{}},[rowSort,manualRows,rowOrderReady]);
  const [columns, setColumns] = useState<Column[]>(initialColumns);
  const [hidden, setHidden] = useState<Column[]>(["mode"]);
  const tableRef = useRef<HTMLTableElement | null>(null);
  const {
    dragged,
    target: dropTarget,
    bind: bindColumn,
    cancel: cancelColumn,
  } = useJournalReorder(setColumns, tableRef, "data-column-id", "x");
  const [widths, setWidths] = useState<Record<Column, number>>(initialWidths);
  const [columnsReady, setColumnsReady] = useState(false);
  const [resizing, setResizing] = useState<Column | null>(null);
  const resizeStart = useRef<{ id: Column; x: number; width: number } | null>(null);
  const [attachments, setAttachments] = useState<{ id: string; name: string; mime: string }[]>([]);
  const saveQueue = useRef<Record<string, Promise<void>>>({});
  const saveVersion = useRef<Record<string, number>>({});

  const load = useCallback(async () => {
    const journalSnapshot = readApiSnapshot<Data>("/api/personal-journal");
    if (journalSnapshot) {
      setData(journalSnapshot);
      setReady(true);
    }
    try {
      const response = await fetch("/api/personal-journal", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error);
      writeApiSnapshot("/api/personal-journal", json);
      setData(json);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ошибка загрузки");
    } finally {
      setReady(true);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("entry");
    setSelectedIdState(id);
  }, [navigationQuery]);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("journal-columns-v1") || "null");
      if (Array.isArray(saved?.columns)) {
        const merged: Column[] = Array.from(
          new Set((saved.columns as Column[]).filter((id) => initialColumns.includes(id))),
        );
        for (const id of initialColumns)
          if (!merged.includes(id)) {
            const preceding = initialColumns[initialColumns.indexOf(id) - 1];
            merged.splice(preceding ? merged.indexOf(preceding) + 1 : 0, 0, id);
          }
        setColumns(merged);
      }
      if (Array.isArray(saved?.hidden))
        setHidden(
          saved.modeHiddenDefaultApplied
            ? saved.hidden
            : Array.from(new Set([...saved.hidden, "mode"])),
        );
      if (saved?.widths && typeof saved.widths === "object")
        setWidths((old) => ({
          ...old,
          ...Object.fromEntries(
            initialColumns
              .filter(
                (id) =>
                  Number.isFinite(saved.widths[id]) &&
                  saved.widths[id] >= 64 &&
                  saved.widths[id] <= 1200,
              )
              .map((id) => [id, saved.widths[id]]),
          ),
        }));
    } catch {
    } finally {
      setColumnsReady(true);
    }
  }, []);
  useEffect(() => {
    if (!columnsReady) return;
    try {
      localStorage.setItem(
        "journal-columns-v1",
        JSON.stringify({ columns, hidden, widths, modeHiddenDefaultApplied: true }),
      );
    } catch {}
  }, [columns, hidden, widths, columnsReady]);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("portfolio-journal-filter-view-v1") || "null");
      if (saved?.filters?.kind === "group" && Array.isArray(saved.filters.children))
        setFilters(saved.filters);
      if (
        saved?.period &&
        ["all", "today", "week", "month", "year", "custom"].includes(saved.period.preset)
      )
        setPeriod(saved.period);
      if (typeof saved?.query === "string") setQuery(saved.query);
      if(['All','Forward','Back'].includes(saved?.mode))setMode(saved.mode);
      if(['All','Realised','Unrealised'].includes(saved?.tradeScope))setTradeScope(saved.tradeScope);
    } catch {
    } finally {
      setViewReady(true);
    }
  }, []);
  useEffect(() => {
    if (viewReady)
      try {
        localStorage.setItem("portfolio-journal-filter-view-v1", JSON.stringify({ filters, period, query,mode,tradeScope }));
      } catch {}
  }, [filters, period, query,mode,tradeScope, viewReady]);

  const duplicateNumbers = journalNumberConflictIds(data.entries);
  const orderedEntries=useMemo(()=>sortJournalEntries(data.entries,data.terms,rowSort,manualRows,filters),[data.entries,data.terms,rowSort,manualRows,filters]);
  const rowsDrag=useJournalReorder<string>((update)=>{
    const ids=orderedEntries.map(e=>e.id);
    setManualRows(typeof update==='function'?update(ids):update);
    setRowSort(null);
  },tableRef,'data-entry-id','y');
  const selected = data.entries.find((entry) => entry.id === selectedId) ?? null;
  useEffect(() => {
    if (!selected) return;
    try {
      if (panelRef.current)
        panelRef.current.scrollTop = Number(
          sessionStorage.getItem(`journal-card-scroll:${selected.id}`) || 0,
        );
    } catch {
      /* optional scroll restoration */
    }
  }, [selected?.id]);
  const visible = useMemo(
    () =>
      orderedEntries.filter((entry) => {
        if (mode !== "All" && entry.mode !== mode) return false;
        if(!matchesTradeScope(entry,new Map(data.terms.map(t=>[t.id,t.name])),tradeScope))return false;
        const bounds = periodBounds(period);
        if ((bounds.from && entry.date < bounds.from) || (bounds.to && entry.date > bounds.to))
          return false;
        if (!matchesFilters(entry, filters)) return false;
        if (query) {
          const text = [
            entry.tradeNo,
            entry.quickNote,
            entry.bodyTitle,
            entry.bodyText,
            ...Object.values(entry.terms)
              .flat()
              .map((id) => data.terms.find((term) => term.id === id)?.name ?? ""),
          ]
            .join(" ")
            .toLowerCase();
          if (!text.includes(query.toLowerCase())) return false;
        }
        return true;
      }),
    [data, orderedEntries, mode,tradeScope, period, filters, query],
  );
  const save = async (entry: JournalEntry, changes: Record<string, unknown>) => {
    const version = (saveVersion.current[entry.id] ?? 0) + 1;
    saveVersion.current[entry.id] = version;
    setData((old) => ({
      ...old,
      entries: old.entries.map((item) => (item.id === entry.id ? { ...item, ...changes } : item)),
    }));
    const pending = (saveQueue.current[entry.id] ?? Promise.resolve())
      .catch(() => {})
      .then(async () => {
        try {
          const json = await api({ action: "update", id: entry.id, changes });
          if (saveVersion.current[entry.id] === version)
            setData((old) => ({
              ...old,
              entries: old.entries.map((item) => {
                if(item.id===entry.id)return json.entry;
                const number=json.numbers?.find((n:{id:string})=>n.id===item.id);
                return number?{...item,tradeNo:number.tradeNo,numberSeries:number.numberSeries}:item;
              }),
            }));
          setError("");
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : "Ошибка сохранения");
          await load();
        }
      });
    saveQueue.current[entry.id] = pending;
    await pending;
  };
  const create = async () => {
    if(creatingRef.current)return;
    creatingRef.current=true;
    setCreating(true);
    try {
      const json = await api({ action: "create" });
      setData((old) => ({ ...old, entries: [...old.entries, json.entry] }));
      setSelectedId(json.entry.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ошибка создания");
    } finally {
      creatingRef.current=false;
      setCreating(false);
    }
  };
  const removeEntry = async (entry: JournalEntry) => {
    try {
      await saveQueue.current[entry.id];
      await api({ action: "delete", id: entry.id });
      setSelectedId(null);
      setUndoEntry({ id: entry.id, tradeNo: entry.tradeNo });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось удалить запись");
    }
  };
  const restoreEntry = async (id: string) => {
    try {
      await api({ action: "restore", id });
      setUndoEntry(null);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось восстановить запись");
    }
  };
  const addTerm = async (entry: JournalEntry, kind: TermKind, name: string) => {
    try {
      const json = await api({ action: "term", kind, name });
      setData((old) => ({
        ...old,
        terms: old.terms.some((term) => term.id === json.term.id)
          ? old.terms.map((term) => (term.id === json.term.id ? json.term : term))
          : [...old.terms, json.term],
      }));
      if (kind === "account")
        await save(entry, {
          accounts: entry.accounts.some((account) => account.accountId === json.term.id)
            ? entry.accounts
            : [
                ...entry.accounts,
                { accountId: json.term.id, riskPct: null, pnlCash: null, pnlPct: null },
              ],
        });
      else
        await save(entry, {
          terms: {
            ...entry.terms,
            [kind]: Array.from(new Set([...(entry.terms[kind] ?? []), json.term.id])),
          },
        });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ошибка создания значения");
    }
  };
  const loadAttachments = useCallback(async (id: string) => {
    const response = await fetch(
      `/api/attachments?type=personal-journal&id=${encodeURIComponent(id)}`,
    );
    if (response.ok) {
      const files = (await response.json()).attachments;
      if (selectionRef.current === id) setAttachments(files);
    }
  }, []);
  useEffect(() => {
    setAttachments([]);
    if (selectedId) void loadAttachments(selectedId);
    else setAttachments([]);
  }, [selectedId, loadAttachments]);
  const upload = async (file: File) => {
    if (!selected) return;
    const form = new FormData();
    form.set("type", "personal-journal");
    form.set("id", selected.id);
    form.set("file", file);
    try {
      const response = await uploadAttachment(form);
      const json = await response.json();
      if (!response.ok) throw new Error(json.error);
      await loadAttachments(selected.id);
      return { id: json.id as string, name: file.name };
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ошибка загрузки файла");
    }
  };

  const cell = (entry: JournalEntry, id: Column) => {
    if(id==='pnlCash'){
      return <JournalPnlCell entry={entry} names={new Map(data.terms.map(t=>[t.id,t.name]))} filters={filters}/>;
    }
    if (id === "mode") return MODE_LABELS[entry.mode];
    if (id === "date") return formatJournalDate(entry.date);
    if (id === "tradeNo")
      return (
        <span className="flex items-center gap-2 leading-none" data-trade-number-content="true">
          <span className="inline-flex size-7 shrink-0 items-center justify-center">
            {!linked(entry,"result",data.terms).length && <Circle aria-label="Результат не выбран" className="size-5 text-white" strokeWidth={1.7}/>}
            {linked(entry, "result", data.terms).slice(0,1).map((name, index) => (
              <span key={index} title={name} className="flex items-center justify-center leading-none">
                <JournalResultIcon name={name} detail={entry.classification?.detail} missed={opportunityRR(entry,new Map(data.terms.map(t=>[t.id,t.name])))}/>
              </span>
            ))}
          </span>
          <b className="tabular-nums">{entry.tradeNo}</b>
          {duplicateNumbers.has(entry.id)&&<span role="img" aria-label={`Повторяющийся номер ${entry.tradeNo}`} title="Этот номер есть у другой сделки. Обе записи сохранены." className="inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-rose-500/10 text-[11px] font-bold text-rose-400">!</span>}
        </span>
      );
    if (id === "result")
      return linked(entry, "result", data.terms).length ? (
        <span className="flex gap-1.5">
          {linked(entry, "result", data.terms).map((name) => (
            <JournalResultBadge key={name} name={name} />
          ))}
        </span>
      ) : (
        "—"
      );
    if (id === "direction")
      return entry.direction === "Long" ? (
        <span className="inline-flex items-center gap-1 text-foreground">
          <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4 shrink-0 text-emerald-400" fill="currentColor"><path d="M8 1 15 8H11V15H5V8H1L8 1Z"/></svg>
          Long
        </span>
      ) : entry.direction === "Short" ? (
        <span className="inline-flex items-center gap-1 text-foreground">
          <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4 shrink-0 text-rose-400" fill="currentColor"><path d="M5 1H11V8H15L8 15 1 8H5V1Z"/></svg>
          Short
        </span>
      ) : (
        "—"
      );
    if (id === "instrument" || id === "setup" || id === "storyline" || id === "type") {
      const ids = entry.terms[id] ?? [];
      return ids.length ? (
        <span className="flex items-center gap-2">
          {ids.map((termId) => {
            const term = data.terms.find((item) => item.id === termId);
            return (
              <Link
                key={termId}
                href={`/catalogs?kind=${id}&term=${termId}`}
                onClick={(event) => event.stopPropagation()}
                className="inline-flex shrink-0 items-center gap-1.5 hover:underline"
              >
                <JournalTermIcon kind={id} name={term?.name ?? ""} />
                {term?.name ?? "?"}
              </Link>
            );
          })}
        </span>
      ) : (
        "—"
      );
    }
    if (id === "account")
      return entry.accounts.length ? (
        <span className="flex items-center gap-1">
          {entry.accounts.slice(0, 2).map((account) => {
            const name = data.terms.find((term) => term.id === account.accountId)?.name ?? "?";
            return (
              <span
                key={account.accountId}
                title={name}
                className="grid h-5 w-5 place-items-center rounded bg-sky-950 text-[10px] text-sky-300"
              >
                {data.terms.find((term) => term.id === account.accountId)?.logo ? (
                  <img
                    src={data.terms.find((term) => term.id === account.accountId)!.logo}
                    alt={name}
                    className="h-full w-full rounded object-contain"
                  />
                ) : (
                  name[0]?.toUpperCase()
                )}
              </span>
            );
          })}
          {entry.accounts.length > 2 && <span>+{entry.accounts.length - 2}</span>}
        </span>
      ) : (
        "—"
      );
    if (id === "quickNote") return <span className="block truncate">{entry.quickNote || "—"}</span>;
    if (id === "realisedR" && isScenarioEntry(entry,new Map(data.terms.map(t=>[t.id,t.name]))))
      return <PotentialRRHint value={opportunityRR(entry,new Map(data.terms.map(t=>[t.id,t.name])))}/>;
    if (id === "realisedR" && entry.realisedR === null)
      return <span>—<PotentialRRHint value={opportunityRR(entry,new Map(data.terms.map(t=>[t.id,t.name])))}/></span>;
    if (id === "realisedR" && entry.realisedR !== null)
      return (
        <span
          className={
            isScenarioEntry(entry,new Map(data.terms.map(t=>[t.id,t.name]))) ? "text-muted-foreground" : entry.realisedR > 0
              ? "text-emerald-500"
              : entry.realisedR < 0
                ? "text-rose-500"
                : "text-blue-400"
          }
        >
          {entry.realisedR > 0 ? "+" : ""}
          {entry.realisedR}R
          <PotentialRRHint value={opportunityRR(entry,new Map(data.terms.map(t=>[t.id,t.name])))}/>
        </span>
      );
    return entry[id] ?? "—";
  };
  const show = columns.filter((id) => !hidden.includes(id));
  const tableWidth = show.reduce((sum, id) => sum + widths[id], 0);
  const dropX = dropTarget
    ? show.slice(0, show.indexOf(dropTarget.id)).reduce((sum, id) => sum + widths[id], 0) +
      (dropTarget.edge === "after" ? widths[dropTarget.id] : 0)
    : null;
  const resizeX = resizing
    ? show.slice(0, show.indexOf(resizing) + 1).reduce((sum, id) => sum + widths[id], 0)
    : null;
  return (
    <main className="min-w-0 flex-1 overflow-hidden">
      <div className="flex h-14 shrink-0 items-center justify-between border-b px-5">
        <h1 className="text-xl font-semibold">Journal</h1>
        {data.trashed.length > 0 && (
          <JournalPopover
            label="Корзина журнала"
            align="end"
            className="w-80"
            trigger={
              <button
                type="button"
                className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
              >
                <Trash2 className="size-3.5" />
                Корзина · {data.trashed.length}
              </button>
            }
          >
            <p className="border-b px-2 py-2 text-sm font-medium">Удалённые записи</p>
            {data.trashed.map((entry) => (
              <div key={entry.id} className="flex items-center gap-2 px-2 py-2 text-sm">
                <span className="flex-1">
                  #{entry.tradeNo} · {formatJournalDate(entry.date)}
                </span>
                <button
                  type="button"
                  onClick={() => void restoreEntry(entry.id)}
                  className="rounded px-2 py-1 text-xs text-sky-400 hover:bg-accent"
                >
                  Восстановить
                </button>
              </div>
            ))}
          </JournalPopover>
        )}
      </div>
      <div className="flex min-h-[calc(100dvh-72px)] flex-col gap-3 p-4">
        <JournalToolbar
          period={period}
          onPeriod={setPeriod}
          mode={mode}
          onMode={setMode}
          tradeScope={tradeScope}
          onTradeScope={setTradeScope}
          filters={filters}
          onFilters={setFilters}
          query={query}
          onQuery={setQuery}
          terms={data.terms}
          columns={columns.map((id) => ({ id, label: names[id] }))}
          hidden={hidden}
          onHidden={(value) => setHidden(value as Column[])}
          onCreate={() => void create()}
        />
        <div className="flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
          <span>{rowSort?`Порядок: ${names[rowSort.key as Column]} ${rowSort.direction==='asc'?'↑':'↓'}`:'Ручной порядок'}</span>
          {rowSort&&manualRows.length>0&&<button type="button" onClick={()=>setRowSort(null)} className="hover:text-foreground">Вернуть ручной</button>}
          <span className="ml-auto">Строки можно перетаскивать</span>
        </div>
        <JournalMetrics entries={visible} terms={data.terms} filters={filters}/>
        {error && (
          <div
            role="alert"
            className="rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300"
          >
            {error}
          </div>
        )}
        <div
          data-journal-scroll="horizontal"
          className="min-h-0 flex-1 overflow-auto rounded-xl border"
        >
          <div className="relative" style={{ width: tableWidth, minWidth: tableWidth }}>
            <table
              ref={tableRef}
              className="table-fixed border-collapse text-left text-sm"
              style={{ width: tableWidth }}
            >
              <colgroup>
                {show.map((id) => (
                  <col key={id} style={{ width: widths[id] }} />
                ))}
              </colgroup>
              <thead className="sticky z-10 bg-card" style={{ top: 0 }}>
                <tr>
                  {show.map((id) => (
                    <th
                      key={id}
                      data-column-id={id}
                      aria-sort={rowSort?.key===id?(rowSort.direction==='asc'?'ascending':'descending'):undefined}
                      {...bindColumn(id)}
                      className={`relative touch-none select-none cursor-grab border-b border-r px-3 py-2 text-xs font-medium text-muted-foreground ${dragged === id ? "opacity-40" : ""}`}
                    >
                      <button type="button" onPointerDown={event=>event.stopPropagation()} onClick={()=>setRowSort(old=>({key:id,direction:old?.key===id?(old.direction==='asc'?'desc':'asc'):(['date','tradeNo','realisedR','mfe','mae'].includes(id)?'desc':'asc')}))} title="Нажми для сортировки · повторный клик меняет направление" className="flex w-full items-center gap-1.5 truncate text-left hover:text-foreground">
                        <JournalFieldIcon field={id} />
                        {names[id]}
                        {rowSort?.key===id&&<span aria-hidden="true">{rowSort.direction==='asc'?'↑':'↓'}</span>}
                      </button>
                      <div
                        role="separator"
                        aria-orientation="vertical"
                        aria-label={`Изменить ширину: ${names[id]}`}
                        aria-valuemin={64}
                        aria-valuemax={1200}
                        aria-valuenow={widths[id]}
                        tabIndex={0}
                        title="Потяни границу столбца · двойной клик сбрасывает ширину"
                        className="absolute inset-y-0 -right-1 z-20 w-2 cursor-col-resize touch-none hover:bg-sky-500/40 focus:bg-sky-500/40 focus:outline-none"
                        onDragStart={(event) => event.preventDefault()}
                        onPointerDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          resizeStart.current = { id, x: event.clientX, width: widths[id] };
                          setResizing(id);
                          cancelColumn();
                          event.currentTarget.setPointerCapture(event.pointerId);
                        }}
                        onPointerMove={(event) => {
                          const start = resizeStart.current;
                          if (!start || start.id !== id) return;
                          setWidths((old) => ({
                            ...old,
                            [id]: Math.max(
                              64,
                              Math.min(1200, Math.round(start.width + event.clientX - start.x)),
                            ),
                          }));
                        }}
                        onPointerUp={(event) => {
                          resizeStart.current = null;
                          setResizing(null);
                          if (event.currentTarget.hasPointerCapture(event.pointerId))
                            event.currentTarget.releasePointerCapture(event.pointerId);
                        }}
                        onLostPointerCapture={() => {
                          resizeStart.current = null;
                          setResizing(null);
                        }}
                        onDoubleClick={(event) => {
                          event.stopPropagation();
                          setWidths((old) => ({ ...old, [id]: initialWidths[id] }));
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                            event.preventDefault();
                            setWidths((old) => ({
                              ...old,
                              [id]: Math.max(
                                64,
                                Math.min(1200, old[id] + (event.key === "ArrowRight" ? 10 : -10)),
                              ),
                            }));
                          }
                        }}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((entry) => (
                  <tr
                    key={entry.id}
                    data-entry-id={entry.id}
                    {...rowsDrag.bind(entry.id)}
                    onPointerDown={event=>{if((event.target as HTMLElement).closest('a,button,input,textarea,select'))return;suppressRowClick.current=false;rowsDrag.bind(entry.id).onPointerDown(event);}}
                    onPointerUp={event=>{suppressRowClick.current=!!rowsDrag.dragged;rowsDrag.bind(entry.id).onPointerUp(event);}}
                    onClick={() => {if(suppressRowClick.current){suppressRowClick.current=false;return;}setSelectedId(entry.id);}}
                    className={`cursor-grab hover:bg-accent/40 ${rowsDrag.dragged===entry.id?'opacity-40':''} ${rowsDrag.target?.id===entry.id?(rowsDrag.target.edge==='before'?'shadow-[inset_0_2px_0_#38bdf8]':'shadow-[inset_0_-2px_0_#38bdf8]'):''}`}
                  >
                    {show.map((id) => (
                      <td
                        key={id}
                        className="overflow-hidden whitespace-nowrap border-b border-r px-3 py-2 align-middle"
                      >
                        <div className={id==='tradeNo'?'flex min-h-7 items-center overflow-visible':'truncate'}>{cell(entry, id)}</div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={show.length} className="p-0">
                    <button type="button" onClick={()=>void create()} disabled={creating||!ready} aria-label="Создать новую запись под таблицей" className="group block min-h-12 w-full border-b bg-transparent text-left text-sm text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-400 disabled:cursor-wait disabled:opacity-50">
                      <span className="sticky left-0 inline-flex items-center gap-2 px-4 py-3"><Plus className="size-4" strokeWidth={1.8}/>{creating?'Создаём запись…':'Новая запись'}</span>
                    </button>
                  </td>
                </tr>
              </tfoot>
            </table>
            {dropX !== null && dragged && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 z-30 w-0.5 bg-sky-400"
                style={{ left: dropX - 1 }}
              >
                <span className="absolute -top-1 -left-1 size-2.5 rounded-full bg-sky-400" />
              </div>
            )}
            {resizeX !== null && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 z-30 w-px bg-sky-400"
                style={{ left: resizeX - 1 }}
              />
            )}
          </div>
          {ready && visible.length === 0 && (
            <p className="p-8 text-center text-sm text-muted-foreground">
              Записей пока нет. Нажми «Новая запись».
            </p>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {visible.length} записей · данные хранятся только в этой копии
        </p>
      </div>
      {selected && (
        <div
          className="fixed inset-x-0 bottom-0 z-40 flex justify-end bg-black/50"
          style={{ top: "var(--journal-header-offset)" }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSelectedId(null);
          }}
        >
          <section
            ref={panelRef}
            onScroll={(event) => {
              try {
                sessionStorage.setItem(
                  `journal-card-scroll:${selected.id}`,
                  String(event.currentTarget.scrollTop),
                );
              } catch {
                /* optional scroll persistence */
              }
            }}
            data-journal-scroll="vertical"
            className="h-full w-full overflow-y-auto border-l bg-background shadow-2xl md:w-[60vw] md:min-w-[640px] md:max-w-[1200px]"
          >
            <div
              className="sticky z-10 flex h-12 items-center justify-between border-b bg-background/95 px-5"
              style={{ top: 0 }}
            >
              <span className="text-sm text-muted-foreground">
                Журнал / Сделка #{selected.tradeNo}
              </span>
              <div className="flex items-center gap-2">
                <div ref={setPropertyMenuContainer} />
                <button
                  type="button"
                  onClick={() => void removeEntry(selected)}
                  aria-label="Удалить сделку"
                  title="Удалить сделку"
                  className="grid size-7 place-items-center rounded-[10px] border border-white/5 bg-white/5 text-muted-foreground transition-colors hover:bg-rose-500/10 hover:text-rose-400"
                >
                  <Trash2 className="size-3.5" />
                </button>
                <button
                  onClick={() => setSelectedId(null)}
                  aria-label="Закрыть"
                  title="Закрыть карточку"
                  className="grid size-7 place-items-center rounded-[10px] border border-white/5 bg-white/5 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            </div>
            <div
              className="h-32 shrink-0 bg-slate-900 bg-cover bg-center"
              style={{
                backgroundColor: DETAILS.find(d=>d.id===selected.classification?.detail)?.color || (linked(selected,"result",data.terms).includes("Breakeven")?"#2563eb":undefined),
                backgroundBlendMode: "soft-light",
                backgroundImage: selected.classification?.detail
                  ? `linear-gradient(135deg,${DETAILS.find(d=>d.id===selected.classification?.detail)?.color ?? "#334155"},#17202e)`
                  : linked(selected,"result",data.terms).includes("Breakeven")
                    ? "linear-gradient(135deg,#2563eb,#172554)"
                    : `linear-gradient(rgba(0,0,0,.08),rgba(0,0,0,.08)),url('${coverForResult(linked(selected, "result", data.terms)[0] ?? "НЛО")}')`,
              }}
            />
            <div className="mx-auto max-w-[1080px] px-6 pb-16 pt-7 lg:px-10">
              <JournalTradeSummary
                tradeNo={selected.tradeNo}
                onNumberChange={tradeNo=>void save(selected,{tradeNo})}
                duplicateNumber={duplicateNumbers.has(selected.id)}
                results={linked(selected, "result", data.terms)}
                rr={selected.realisedR}
                missed={opportunityRR(selected,new Map(data.terms.map(t=>[t.id,t.name])))}
                detail={selected.classification?.detail}
                scenario={isScenarioEntry(selected,new Map(data.terms.map(t=>[t.id,t.name])))}
              />
              {isScenarioEntry(selected,new Map(data.terms.map(t=>[t.id,t.name]))) && <p role="note" className="mb-5 rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">Сценарий, не открытая сделка. RR и PNL сохраняются для исследования, но не влияют на фактические итоги и баланс аккаунта.</p>}
              {selected.classification?.detail && <p className="mb-4 text-sm font-medium" style={{color:DETAILS.find(d=>d.id===selected.classification?.detail)?.color}}>{DETAILS.find(d=>d.id===selected.classification?.detail)?.label}</p>}
              <JournalCardProperties
                entry={selected}
                terms={data.terms}
                save={save}
                create={addTerm}
                settingsContainer={propertyMenuContainer}
                accounts={
                  <><TradePotentialEditor key={selected.id} entry={selected} terms={data.terms} onSave={potential=>void save(selected,{potential})}/><Accounts entry={selected} terms={data.terms} save={save} create={addTerm} /></>
                }
              />
              <div className="mt-10 border-t pt-8">
                <JournalHeading
                  key={`${selected.id}-heading`}
                  value={selected.bodyTitle}
                  onImagePaste={async files=>{for(const file of files)await bodyImagePaste.current?.(file);}}
                  onCommit={(value) => {
                    if (value !== selected.bodyTitle) void save(selected, { bodyTitle: value });
                  }}
                />
                <div role="separator" aria-label="Начало основного текста" className="my-5 border-t border-border/70" />
                <JournalBodyEditor
                  imagePasteRef={bodyImagePaste}
                  workflowLabel={`Journal · Trade #${selected.tradeNo} · ${selected.date}`}
                  key={`${selected.id}-body`}
                  entry={selected}
                  attachments={attachments}
                  onCommit={(bodyBlocks) => void save(selected, { bodyBlocks })}
                  onUpload={upload}
                />
                {attachments
                  .filter((file) => !file.mime.startsWith("image/"))
                  .map((file) => (
                    <a
                      key={file.id}
                      href={`/api/attachments/${file.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 block text-xs text-muted-foreground underline"
                    >
                      {file.name}
                    </a>
                  ))}
              </div>
            </div>
          </section>
        </div>
      )}
      {undoEntry && (
        <div
          role="status"
          className="fixed bottom-5 left-1/2 z-[80] flex -translate-x-1/2 items-center gap-4 rounded-lg border bg-card px-4 py-3 text-sm shadow-xl"
        >
          <span>Сделка #{undoEntry.tradeNo} удалена</span>
          <button
            type="button"
            onClick={() => void restoreEntry(undoEntry.id)}
            className="font-medium text-sky-400"
          >
            Отменить
          </button>
          <button type="button" aria-label="Закрыть уведомление" onClick={() => setUndoEntry(null)}>
            <X className="size-3.5" />
          </button>
        </div>
      )}
    </main>
  );
}

export function JournalHeading({ value, onCommit, onImagePaste }: { value: string; onCommit: (value: string) => void; onImagePaste?: (files:File[])=>Promise<void> }) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const grow = () => {
    const element = ref.current;
    if (element) {
      element.style.height = "auto";
      element.style.height = `${element.scrollHeight}px`;
    }
  };
  useEffect(grow, [value]);
  return (
    <SlashTextarea
      data-no-slash
      ref={ref}
      rows={1}
      defaultValue={value}
      aria-label="Заголовок разбора"
      placeholder="Заголовок"
      onInput={grow}
      onBlur={(event) => onCommit(event.target.value)}
      onPaste={event=>{
        const images=Array.from(event.clipboardData.files).filter(file=>file.type.startsWith('image/')||file.type.startsWith('video/')||/\.(mp4|webm)$/i.test(file.name));
        if(!images.length)return;
        event.preventDefault();event.stopPropagation();
        onCommit(event.currentTarget.value);
        void onImagePaste?.(images);
      }}
      className="min-h-9 w-full resize-none overflow-hidden whitespace-pre-wrap break-words bg-transparent text-xl font-bold leading-snug outline-none placeholder:text-muted-foreground/60 [overflow-wrap:anywhere]"
    />
  );
}

function RelationPicker({
  entry,
  kind,
  terms,
  save,
  create,
}: {
  entry: JournalEntry;
  kind: TermKind;
  terms: Term[];
  save: (entry: JournalEntry, changes: Record<string, unknown>) => Promise<void>;
  create: (entry: JournalEntry, kind: TermKind, name: string) => Promise<void>;
}) {
  return (
    <JournalChoicePicker
      label={`Выбор: ${kindNames[kind]}`}
      values={entry.terms[kind] ?? []}
      options={terms
        .filter((term) => term.kind === kind)
        .map((term) => ({ value: term.id, label: term.name }))}
      onValuesChange={(values) => void save(entry, { terms: { ...entry.terms, [kind]: values } })}
      onCreate={(name) => void create(entry, kind, name)}
    />
  );
}

function Accounts({
  entry,
  terms,
  save,
  create,
}: {
  entry: JournalEntry;
  terms: Term[];
  save: (entry: JournalEntry, changes: Record<string, unknown>) => Promise<void>;
  create: (entry: JournalEntry, kind: TermKind, name: string) => Promise<void>;
}) {
  const options = terms.filter((term) => term.kind === "account");
  const { data: balances,refresh:refreshBalances } = useApi<{
    accounts: {
      id: string;
      profile: AccountProfile | null;
      balance: number | null;
    }[];
  }>("/api/personal-accounts");
  const balanceEntry=useRef(entry.id);
  useEffect(()=>{if(balanceEntry.current!==entry.id){balanceEntry.current=entry.id;refreshBalances();}},[entry.id,refreshBalances]);
  const update = (accountId: string, changes: Partial<AccountResult> & { editedField?: string }) =>
    void save(entry, {
      accounts: entry.accounts.map((account) =>
        account.accountId === accountId ? { ...account, ...changes } : account,
      ),
    });
  return (
    <div className="space-y-3">
      {entry.accounts.map((account) => {
        const term = options.find((item) => item.id === account.accountId);
        const asset = linked(entry, "instrument", terms)[0] ?? "";
        const unit = volumeUnit(asset, balances?.accounts.find(a=>a.id===account.accountId)?.profile?.market);
        return (
          <div key={account.accountId} className="rounded-lg border p-3">
            <div className="mb-3 flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded bg-sky-950 text-xs text-sky-300">
                {term?.logo ? (
                  <img
                    src={term.logo}
                    alt={term.name}
                    className="h-full w-full rounded object-contain"
                  />
                ) : (
                  (term?.name[0]?.toUpperCase() ?? "?")
                )}
              </span>
              <b className="text-sm">{term?.name ?? "Аккаунт"}</b>
              <button
                onClick={() =>
                  void save(entry, {
                    accounts: entry.accounts.filter((item) => item.accountId !== account.accountId),
                  })
                }
                className="ml-auto"
                aria-label="Убрать аккаунт"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <label className="mb-3 block text-sm text-muted-foreground">
              Объём · {volumeLabels[unit]}
              <input key={`${entry.id}:${account.accountId}:${unit}:${account.quantity ?? ""}`} type="text" inputMode={unit === "contracts" ? "numeric" : "decimal"}
                aria-label={`Объём: ${term?.name ?? "Аккаунт"}`} defaultValue={account.quantity ?? ""}
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-base text-foreground"
                onBlur={event => { const quantity = parseDecimalInput(event.currentTarget.value);
                  if (event.currentTarget.validity.badInput || (quantity !== null && (!Number.isFinite(quantity) || quantity <= 0 || (unit === "contracts" && !Number.isInteger(quantity))))) { event.currentTarget.setCustomValidity("Введите положительный объём; контракты — целое число"); event.currentTarget.reportValidity(); return; }
                  if (quantity !== (account.quantity ?? null)) update(account.accountId, { quantity });
                  event.currentTarget.value = quantity === null ? "" : String(quantity);
                }} onInput={event => { event.currentTarget.setCustomValidity(""); event.currentTarget.value = leadingDecimalZero(event.currentTarget.value); }} />
            </label>
            <AccountMoneyFields
              key={`${entry.id}:${account.accountId}`}
              account={account}
              base={(() => {
                const info = balances?.accounts.find((a) => a.id === account.accountId);
                const profile = info?.profile;
                if (!profile) return account.baseBalance ?? null;
                if (profile.kind === "prop")
                  return (profile.accountSize || profile.openingBalance) > 0
                    ? profile.accountSize || profile.openingBalance
                    : null;
                return (
                  account.baseBalance ??
                  (info.balance !== null && info.balance !== undefined
                    ? info.balance -
                      (entry.mode === "Forward" && entry.date >= profile.startDate
                        ? (account.pnlCash ?? 0)
                        : 0)
                    : null)
                );
              })()}
              onCommit={(values) => update(account.accountId, values)}
            />
            <AccountPotentialField entry={entry} accountId={account.accountId} terms={terms} onSave={potential=>void save(entry,{potential})}/>
          </div>
        );
      })}
      <div className="flex flex-wrap gap-2">
        <JournalChoicePicker
          compact
          label="Добавить аккаунт"
          placeholder="+ Добавить аккаунт"
          options={options
            .filter(
              (term) =>
                !term.archived && !entry.accounts.some((account) => account.accountId === term.id),
            )
            .map((term) => ({ value: term.id, label: term.name }))}
          onChange={(id) =>
            void save(entry, {
              accounts: [
                ...entry.accounts,
                { accountId: id, riskPct: null, pnlCash: null, pnlPct: null },
              ],
            })
          }
          onCreate={(value) => void create(entry, "account", value)}
          catalogHref="/catalogs?kind=account"
          optionHref={(id) => `/catalogs?kind=account&term=${id}`}
        />
      </div>
    </div>
  );
}
