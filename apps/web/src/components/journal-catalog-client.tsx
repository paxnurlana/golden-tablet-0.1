"use client";
import { SlashTextarea } from "@/components/slash-textarea";
import { JournalAccountAvatar } from "@/components/journal-account-avatar";
import { readApiSnapshot, writeApiSnapshot, clearApiSnapshots } from "@/lib/use-api";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Plus, Search, Trash2, X } from "lucide-react";
import type { JournalEntry, Term, TermKind } from "@/server/personal-journal";
import { JOURNAL_CATALOGS, catalogStats, relatedJournalEntries } from "@/lib/journal-catalogs";
import { formatJournalDate, MODE_LABELS } from "@/lib/journal-filters";
import { classificationStats, DETAILS, EXECUTION_TAGS } from "@/lib/trade-classification";
import {isScenarioEntry} from '@/lib/trade-accounting';
import {ScenarioAnalytics} from './scenario-analytics';

const input = "rounded border bg-transparent px-3 py-2 text-sm outline-none focus:border-sky-500";
const number = (value: number | null) =>
  value === null ? "—" : new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value);
export function JournalCatalogClient() {
  const router = useRouter(),
    search = useSearchParams();
  const requested = search.get("kind");
  const via = search.get("via") === "relation" ? "&via=relation" : "";
  const kind = JOURNAL_CATALOGS.some((item) => item.kind === requested)
    ? (requested as TermKind)
    : "type";
  const label = JOURNAL_CATALOGS.find((item) => item.kind === kind)!.label;
  const [data, setData] = useState<{ entries: JournalEntry[]; terms: Term[] }>({
    entries: [],
    terms: [],
  });
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [detailFilter, setDetailFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [name, setName] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [mode, setMode] = useState<"All" | "Forward" | "Back">("All");
  const [undo, setUndo] = useState<Term | null>(null);
  const [busy, setBusy] = useState(false);
  const selected = data.terms.find((term) => term.id === search.get("term") && term.kind === kind);
  const load = useCallback(async () => {
    const cached = readApiSnapshot<{ entries: JournalEntry[]; terms: Term[] }>(
      "/api/personal-journal",
    );
    if (cached) setData(cached);
    try {
      const response = await fetch("/api/personal-journal", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error);
      setData(json);
      writeApiSnapshot("/api/personal-journal", json);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось загрузить справочник");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const changeKind = (next: TermKind) => {
    setQuery("");
    setName("");
    setShowArchived(false);
    window.history.pushState(null, "", `/catalogs?kind=${next}${via}`);
  };
  const close = () => window.history.replaceState(null, "", `/catalogs?kind=${kind}${via}`);
  const mutate = async (body: Record<string, unknown>) => {
    const response = await fetch("/api/personal-journal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error);
    clearApiSnapshots();
    return json;
  };
  const create = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      await mutate({ action: "term", kind, name });
      setName("");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось создать значение");
    } finally {
      setBusy(false);
    }
  };
  const update = async (term: Term, changes: Record<string, unknown>) => {
    try {
      const json = await mutate({ action: "term-update", id: term.id, changes });
      setData((old) => ({
        ...old,
        terms: old.terms.map((item) => (item.id === term.id ? json.term : item)),
      }));
      setError("");
      if (changes.archived === true) {
        setUndo(term);
        if (selected?.id === term.id) close();
      }
      if (changes.archived === false) setUndo(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось изменить значение");
    }
  };
  const filteredEntries = useMemo(
    () => data.entries.filter((entry) => mode === "All" || entry.mode === mode),
    [data.entries, mode],
  );
  const rows = data.terms.filter(
    (term) =>
      term.kind === kind &&
      !!term.archived === showArchived &&
      term.name.toLowerCase().includes(query.toLowerCase()),
  );
  const matching = selected
    ? relatedJournalEntries(filteredEntries, kind, selected.id).filter(
        (e) =>
          kind !== "setup" ||
          ((!detailFilter || e.classification?.detail === detailFilter) &&
            (!tagFilter || e.classification?.tags?.includes(tagFilter))),
      )
    : [];
  const detailStats = classificationStats(matching, new Map(data.terms.map((t) => [t.id, t.name])));
  const executedCount = detailStats.reduce((sum, row) => sum + row.count, 0);
  const accountingNames=new Map(data.terms.map(t=>[t.id,t.name]));
  const stats = selected ? catalogStats(matching.filter(e=>!isScenarioEntry(e,accountingNames))) : null;
  return (
    <main className="min-w-0 flex-1">
      <div className="flex h-14 items-center border-b px-5">
        <h1 className="text-xl font-semibold">Trade Library</h1>
      </div>
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap gap-1">
          {JOURNAL_CATALOGS.map((item) => (
            <button
              key={item.kind}
              type="button"
              onClick={() => changeKind(item.kind)}
              className={`rounded-md px-3 py-1.5 text-sm ${kind === item.kind ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent/50"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-3 text-lg font-semibold">{label}</h2>
          <div className="flex items-center gap-1 rounded border px-2">
            <Search className="size-3.5 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Поиск в справочнике"
              placeholder="Поиск…"
              className="h-8 bg-transparent text-sm outline-none"
            />
          </div>
          <div className="flex gap-1">
            {(["All", "Forward", "Back"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={`rounded px-2 py-1 text-xs ${mode === value ? "bg-accent" : "text-muted-foreground"}`}
              >
                {value === "All" ? "Все" : MODE_LABELS[value]}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowArchived(!showArchived)}
            className={`ml-auto flex items-center gap-1 rounded px-2 py-1 text-xs ${showArchived ? "bg-accent" : "text-muted-foreground"}`}
          >
            <Trash2 className="size-3.5" />
            {showArchived ? "Вернуться к списку" : "Корзина"}
          </button>
        </div>
        {!showArchived && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void create();
            }}
            className="flex gap-2"
          >
            <input
              aria-label="Новое значение"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={`Новое значение ${label}`}
              className={`${input} max-w-80 flex-1`}
            />
            <button
              disabled={!name.trim() || busy}
              className="flex items-center gap-1 rounded bg-primary px-3 text-sm text-primary-foreground disabled:opacity-40"
            >
              <Plus className="size-4" />
              Добавить
            </button>
          </form>
        )}
        {error && (
          <p role="alert" className="text-sm text-rose-400">
            {error}
          </p>
        )}
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[700px] border-collapse text-left text-sm">
            <thead className="bg-card text-xs text-muted-foreground">
              <tr>
                {["Название", "Записи", "Live", "Historical", "С RR", "Net R", "Avg R", ""].map(
                  (title, index) => (
                    <th key={index} className="border-b border-r px-3 py-2 font-medium">
                      {title}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((term) => {
                const values = catalogStats(relatedJournalEntries(filteredEntries, kind, term.id).filter(e=>!isScenarioEntry(e,accountingNames)));
                return (
                  <tr key={term.id} className="hover:bg-accent/30">
                    <td className="border-b border-r px-3 py-2">
                      <Link
                        href={`/catalogs?kind=${kind}&term=${term.id}${via}`}
                        onClick={(event) => {
                          if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
                            return;
                          event.preventDefault();
                          window.history.pushState(
                            null,
                            "",
                            `/catalogs?kind=${kind}&term=${term.id}${via}`,
                          );
                        }}
                        className="flex items-center gap-2 font-medium hover:underline"
                      >
                        {term.name}
                        {kind === "account" && <JournalAccountAvatar term={term} />}
                        <ArrowUpRight className="size-3 text-muted-foreground" />
                      </Link>
                    </td>
                    {[
                      values.count,
                      values.live,
                      values.historical,
                      values.measured,
                      number(values.netR),
                      number(values.avgR),
                    ].map((value, index) => (
                      <td key={index} className="border-b border-r px-3 py-2 tabular-nums">
                        {value}
                      </td>
                    ))}
                    <td className="border-b px-3 py-2">
                      {term.archived ? (
                        <button
                          type="button"
                          onClick={() => void update(term, { archived: false })}
                          className="text-xs text-sky-400"
                        >
                          Восстановить
                        </button>
                      ) : (
                        <button
                          type="button"
                          aria-label={`Удалить ${term.name}`}
                          title="Убрать из списка выбора"
                          onClick={() => void update(term, { archived: true })}
                          className="rounded p-1 text-muted-foreground hover:text-rose-400"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Здесь пока нет значений.
            </p>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Связанные записи считаются один раз. Net R и Avg R — по записям с заполненным RR в
          выбранном режиме.
        </p>
      </div>
      {selected && (
        <div
          className="fixed inset-x-0 bottom-0 z-40 flex justify-end bg-black/40"
          style={{ top: "var(--journal-header-offset, 56px)" }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <section className="h-full w-full max-w-[780px] overflow-y-auto border-l bg-background shadow-2xl">
            <div
              className="sticky z-10 flex items-center justify-between border-b bg-background px-5 py-3"
              style={{ top: 0 }}
            >
              <span className="text-sm text-muted-foreground">{label}</span>
              <button type="button" onClick={close} aria-label="Закрыть справочник">
                <X className="size-5" />
              </button>
            </div>
            <div className="space-y-5 p-6">
              {kind === "account" && (
                <Link
                  href={`/accounts?account=${selected.id}`}
                  className="inline-block text-sm text-sky-400 hover:underline"
                >
                  Настройки аккаунта: баланс, фирма, лимиты и выплаты ↗
                </Link>
              )}
              {error && (
                <p role="alert" className="text-sm text-rose-400">
                  {error}
                </p>
              )}
              {kind === "account" && (
                <div className="flex flex-wrap items-center gap-3">
                  <JournalAccountAvatar term={selected} size="size-16" />
                  <label className={`${input} cursor-pointer`}>
                    Загрузить логотип
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="sr-only"
                      aria-label="Загрузить логотип аккаунта"
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        if (!file) return;
                        if (
                          !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
                          file.size > 512 * 1024
                        ) {
                          setError("Выберите PNG, JPEG или WebP до 512 КБ");
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = () => void update(selected, { logo: reader.result });
                        reader.onerror = () => setError("Не удалось прочитать изображение");
                        reader.readAsDataURL(file);
                      }}
                    />
                  </label>
                  {selected.logo && (
                    <button
                      type="button"
                      className="text-sm text-muted-foreground"
                      onClick={() => void update(selected, { logo: "" })}
                    >
                      Убрать логотип
                    </button>
                  )}
                  <span className="text-xs text-muted-foreground">PNG, JPEG, WebP · до 512 КБ</span>
                </div>
              )}
              <input
                key={`${selected.id}-${selected.name}`}
                aria-label="Название значения"
                defaultValue={selected.name}
                onBlur={(event) => {
                  if (event.target.value !== selected.name)
                    void update(selected, { name: event.target.value });
                }}
                className="w-full bg-transparent text-2xl font-bold outline-none"
              />
              <SlashTextarea
                key={`${selected.id}-description`}
                aria-label="Описание значения"
                defaultValue={selected.description}
                rows={5}
                placeholder="Описание, правила и заметки"
                onBlur={(event) => {
                  if (event.target.value !== selected.description)
                    void update(selected, { description: event.target.value });
                }}
                className={`${input} w-full resize-y`}
              />
              <ScenarioAnalytics entries={matching} terms={data.terms}/>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded border p-3 text-sm">
                  <span className="text-xs text-muted-foreground">Записи</span>
                  <p className="mt-1 text-xl font-semibold">{stats?.count}</p>
                </div>
                <div className="rounded border p-3 text-sm">
                  <span className="text-xs text-muted-foreground">Net R</span>
                  <p className="mt-1 text-xl font-semibold">{number(stats?.netR ?? null)}</p>
                </div>
                <div className="rounded border p-3 text-sm">
                  <span className="text-xs text-muted-foreground">Avg R</span>
                  <p className="mt-1 text-xl font-semibold">{number(stats?.avgR ?? null)}</p>
                </div>
              </div>
              {kind === "setup" && (
                <div className="space-y-3 rounded-lg border p-3">
                  <h3 className="text-sm font-semibold">Анализ результатов сетапа</h3>
                  <p className="text-xs text-muted-foreground">
                    Исполненных сделок: {executedCount} · Win rate:{" "}
                    {executedCount
                      ? number(
                          (detailStats.reduce((sum, row) => sum + row.wins, 0) / executedCount) *
                            100,
                        ) + "%"
                      : "—"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <select
                      aria-label="Фильтр уточнения результата"
                      value={detailFilter}
                      onChange={(e) => setDetailFilter(e.target.value)}
                      className={input}
                    >
                      <option value="">Все уточнения</option>
                      {DETAILS.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="Фильтр меток сделки"
                      value={tagFilter}
                      onChange={(e) => setTagFilter(e.target.value)}
                      className={input}
                    >
                      <option value="">Все метки</option>
                      {EXECUTION_TAGS.map((tag) => (
                        <option key={tag} value={tag}>
                          {tag}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr>
                          {[
                            "Уточнение",
                            "Asset",
                            "Сделки",
                            "Доля по Asset",
                            "Avg R",
                            "MAE · ticks",
                            "MFE · ticks",
                          ].map((label) => (
                            <th key={label} className="p-2">
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {detailStats.map((row) => (
                          <tr key={row.key} className="border-t">
                            <td className="p-2">{row.label}</td>
                            <td className="p-2">{row.asset}</td>
                            <td className="p-2">{row.count}</td>
                            <td className="p-2">
                              {number(
                                (row.count /
                                  detailStats
                                    .filter((r) => r.asset === row.asset)
                                    .reduce((sum, r) => sum + r.count, 0)) *
                                  100,
                              )}
                              %
                            </td>
                            <td className="p-2">{number(row.avgR)}</td>
                            <td className="p-2">{number(row.mae)}</td>
                            <td className="p-2">{number(row.mfe)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {mode === "All" ? "Live + Historical" : MODE_LABELS[mode]} · Уточнение не меняет
                    фактический результат. MAE/MFE — за время открытой сделки. Неизвестные значения
                    не считаются нулём.
                  </p>
                </div>
              )}
              <h3 className="font-semibold">Связанные записи журнала</h3>
              <div className="overflow-x-auto rounded border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-card text-xs text-muted-foreground">
                    <tr>
                      <th className="p-2">Trade</th>
                      <th className="p-2">Дата</th>
                      <th className="p-2">Режим</th>
                      <th className="p-2">RR</th>
                      <th className="p-2">Заметка</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matching.map((entry) => (
                      <tr key={entry.id} className="border-t">
                        <td className="p-2">
                          <Link
                            href={`/trades?entry=${entry.id}`}
                            className="text-sky-400 hover:underline"
                          >
                            #{entry.tradeNo}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap p-2">{formatJournalDate(entry.date)}</td>
                        <td className="p-2">{MODE_LABELS[entry.mode]}</td>
                        <td className="p-2">{number(entry.realisedR)}</td>
                        <td className="max-w-56 truncate p-2">{entry.quickNote || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {selected.archived ? (
                <button
                  type="button"
                  onClick={() => void update(selected, { archived: false })}
                  className="text-sm text-sky-400"
                >
                  Восстановить значение
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void update(selected, { archived: true })}
                  className="flex items-center gap-1 text-sm text-rose-400"
                >
                  <Trash2 className="size-4" />
                  Убрать из справочника
                </button>
              )}
            </div>
          </section>
        </div>
      )}
      {undo && (
        <div
          role="status"
          className="fixed bottom-4 left-1/2 z-[80] flex -translate-x-1/2 items-center gap-3 rounded-lg border bg-card px-4 py-3 text-sm shadow-xl"
        >
          <span>«{undo.name}» убрано из списка</span>
          <button
            type="button"
            onClick={() => void update(undo, { archived: false })}
            className="text-sky-400"
          >
            Отменить
          </button>
          <button type="button" aria-label="Закрыть уведомление" onClick={() => setUndo(null)}>
            <X className="size-3.5" />
          </button>
        </div>
      )}
    </main>
  );
}
