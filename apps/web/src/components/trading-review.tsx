"use client";
import {uploadAttachment} from './video-upload';
import {PotentialRRHint} from './potential-rr-hint';
import { SlashTextarea } from "@/components/slash-textarea";
import {DAILY_REFLECTION_QUESTIONS,dailyReflectionText} from '@/lib/daily-reflection';
import {ProcessReportCard} from './process-report-card';

import Link from "next/link";
import { useEffect, useMemo, useState, useRef } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ChevronDown,
  Check,
  X,
  RefreshCw,
  ArrowUpRight,
  ArrowUp,
  ArrowDown,
  Moon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { JournalPopover, JournalChoicePicker } from "@/components/journal-popover";
import { REVIEW_CONTEXT, dayTone, statusTone, dayStatusLabel } from "@/lib/review-context";
import { SessionTimeline } from "@/components/session-timeline";
import { SessionExtracts } from "@/components/session-extracts";
import {RelatedReviewTrades} from './related-review-trades';
import {ScenarioAnalytics} from './scenario-analytics';
import { ReviewCalendar } from './review-calendar';
import { ReviewMonthPicker } from './review-month-picker';
import {filterReviewAccounts,type ReviewAccountScope} from '@/lib/review-account-filter';
import { useSearchParams } from "next/navigation";
import { postJson, useApi } from "@/lib/use-api";
import {
  addDays,
  emptyReview,
  localToday,
  monthWeeks,
  reviewStats,
  russianDate,
  hasReviewContent,
  weekDayStatus,
  type ReviewRecord,
} from "@/lib/trading-review";
import type { JournalEntry, Term } from "@/server/personal-journal";

type ReviewData = { reviews: ReviewRecord[]; entries: JournalEntry[]; terms: Term[];accountScopes:ReviewAccountScope[];firms:{id:string;name:string}[] };
const number = (value: number | null, suffix = "", neutral = false) =>
  value === null ? (
    "—"
  ) : (
    <span
      className={neutral ? "text-foreground" : value > 0 ? "text-emerald-500" : value < 0 ? "text-rose-500" : "text-blue-400"}
    >{`${value > 0 ? "+" : ""}${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value)}${suffix || " $"}`}</span>
  );
const input =
  "w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm outline-none focus:border-ring";
const narrativeTone = (value: string) =>
  value === "Long"
    ? "text-foreground"
    : value === "Short"
      ? "text-foreground"
      : "text-muted-foreground";
const narrativeOptions = ["Long", "Short", "Neutral"].map((value) => ({
  value,
  label: value,
  icon:
    value === "Long" ? (
      <ArrowUp className="size-4 text-emerald-500" />
    ) : value === "Short" ? (
      <ArrowDown className="size-4 text-rose-500" />
    ) : (
      <RefreshCw className="size-4 text-muted-foreground" />
    ),
  chipClassName: narrativeTone(value),
}));

function ReviewAccounts({ entries, terms }: { entries: JournalEntry[]; terms: Term[] }) {
  const ids = [
    ...new Set(entries.flatMap((entry) => entry.accounts.map((account) => account.accountId))),
  ];
  const names = ids.map((id) => terms.find((term) => term.id === id)?.name ?? "Аккаунт");
  return (
    <span
      className="inline-flex items-center gap-1.5"
      aria-label={`Аккаунты: ${names.join(", ") || "нет"}`}
    >
      {names.length ? (
        names.slice(0, 5).map((name, i) => (
          <span
            key={ids[i]}
            title={name}
            className="grid size-7 shrink-0 place-items-center rounded-full bg-foreground/10 text-[10px] font-semibold text-foreground"
          >
            {terms.find((term) => term.id === ids[i])?.logo ? (
              <img
                src={terms.find((term) => term.id === ids[i])!.logo}
                alt={name}
                className="size-7 rounded-full object-contain"
              />
            ) : (
              name.slice(0, 1).toUpperCase()
            )}
          </span>
        ))
      ) : (
        <span className="text-muted-foreground">—</span>
      )}
      {names.length > 5 && (
        <span
          title={names.slice(5).join("\n")}
          className="grid size-7 shrink-0 place-items-center rounded-full bg-white text-[10px] font-semibold text-zinc-950"
        >
          +{names.length - 5}
        </span>
      )}
    </span>
  );
}

function Metrics({
  entries,
  terms,
  large = false,
  neutral = false,
}: {
  entries: JournalEntry[];
  terms: Term[];
  large?: boolean;
  neutral?: boolean;
}) {
  const stats = reviewStats(entries, terms);
  return (
    <div
      className={`grid grid-cols-2 gap-x-5 gap-y-3 ${large ? "sm:grid-cols-4" : "sm:grid-cols-4"}`}
    >
      {[
        [
          "Net RR",
          number(stats.rr, "R", neutral),
          stats.rrMissing ? `${stats.rrMissing} без RR · сумма неполная` : "Результат идей",
        ],
        [
          "PNL Cash",
          number(stats.cash, "", neutral),
          stats.cashMissing
            ? `${stats.cashMissing} без PNL · сумма неполная`
            : "Сумма по аккаунтам",
        ],
        ["Сделки", String(stats.trades), `${stats.records} записей в Journal`],
        ["Аккаунты", String(stats.accounts), "Уникальные аккаунты"],
      ].map(([label, value, hint], i) => (
        <div key={i}>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
          <div
            className={`${large ? "text-2xl" : "text-lg"} mt-1 font-semibold tabular-nums ${!neutral && i === 0 && stats.rr !== null ? (stats.rr > 0 ? "text-emerald-500" : stats.rr < 0 ? "text-rose-500" : "") : ""}`}
          >
            {value}
            {i===0&&<PotentialRRHint value={stats.missedRR} coverage={`оценено ${stats.potentialEvaluated} из ${stats.records}`}/>}
          </div>
          {large && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
        </div>
      ))}
    </div>
  );
}

export function TradingReview() {
  const navigationSearch = useSearchParams().toString();
  const api = useApi<ReviewData>("/api/trading-review");
  const [today, setToday] = useState("");
  const [month, setMonth] = useState("");
  const [openWeeks, setOpenWeeks] = useState<string[]>([]);
  const [selected, setSelected] = useState<{ key: string; kind: ReviewRecord["kind"] } | null>(
    null,
  );
  const [monthOpen, setMonthOpen] = useState(false);
  const [accountSelection,setAccountSelection]=useState<string[]>([]);
  useEffect(()=>{try{const value=JSON.parse(localStorage.getItem('review-account-scope-v1')||'[]');if(Array.isArray(value)&&value.every(v=>typeof v==='string'&&/^(account|firm):/.test(v)))setAccountSelection(value);}catch{}},[]);
  const changeAccountScope=(values:string[])=>{setAccountSelection(values);try{localStorage.setItem('review-account-scope-v1',JSON.stringify(values));}catch{}};
  const [returnScroll, setReturnScroll] = useState(0);
  function openReport(key: string, kind: ReviewRecord["kind"]) {
    setReturnScroll(window.scrollY);
    window.history.pushState({ review: true }, "", `/journal?review=${kind}&date=${key}`);
    setSelected({ key, kind });
    window.scrollTo(0, 0);
  }
  function closeReport() {
    window.history.replaceState(null, "", "/journal");
    setSelected(null);
    requestAnimationFrame(() => window.scrollTo(0, returnScroll));
  }
  useEffect(() => {
    const read = () => {
      const query = new URLSearchParams(window.location.search);
      const kind = query.get("review");
      const key = query.get("date");
      if (
        (kind === "day" || kind === "week" || kind === "month") &&
        key &&
        /^\d{4}-\d{2}-\d{2}$/.test(key) &&
        !Number.isNaN(Date.parse(`${key}T12:00:00Z`))
      )
        setSelected({ key, kind });
      else {
        setSelected(null);
        requestAnimationFrame(() => window.scrollTo(0, returnScroll));
      }
    };
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, [returnScroll, navigationSearch]);
  useEffect(() => {
    const date = localToday();
    setToday(date);
    const requested=new URLSearchParams(window.location.search).get('date');
    setMonth(requested && /^\d{4}-\d{2}-\d{2}$/.test(requested)?requested.slice(0,7):'2026-10');
    setOpenWeeks([]);
  }, []);
  useEffect(() => {
    const syncDate = () => setToday(localToday());
    const timer = setInterval(syncDate, 30_000);
    window.addEventListener('focus', syncDate);
    document.addEventListener('visibilitychange', syncDate);
    return () => { clearInterval(timer); window.removeEventListener('focus',syncDate); document.removeEventListener('visibilitychange',syncDate); };
  }, []);
  useEffect(() => {
    const refresh = () => api.refresh();
    window.addEventListener("focus", refresh);
    const visible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [api.refresh]);
  const weeks = useMemo(() => (month ? monthWeeks(month) : []), [month]);
  const records = useMemo(
    () =>
      new Map((api.data?.reviews ?? []).map((review) => [`${review.kind}:${review.key}`, review])),
    [api.data],
  );
  const entries = filterReviewAccounts(api.data?.entries ?? [],accountSelection,api.data?.accountScopes??[]);
  const terms = api.data?.terms ?? [];
  const monthEntries = entries.filter((entry) => entry.date.startsWith(month));
  const monthStats = reviewStats(monthEntries, terms);
  const completed = (api.data?.reviews ?? []).filter(
    (record) => record.kind === "day" && record.key.startsWith(month) && hasReviewContent(record),
  ).length;
  const monthLabel = month
    ? new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric", timeZone: "UTC" }).format(
        new Date(`${month}-01T12:00:00Z`),
      )
    : "";
  function changeMonth(value: string) {
    if (
      !/^\d{4}-\d{2}$/.test(value) ||
      Number(value.slice(0, 4)) < 1900 ||
      Number(value.slice(0, 4)) > 2200 ||
      Number(value.slice(5)) < 1 ||
      Number(value.slice(5)) > 12
    )
      return;
    setMonth(value);
    setMonthOpen(false);
    setOpenWeeks([]);
  }
  function shiftMonth(amount: number) {
    const date = new Date(`${month}-01T12:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() + amount);
    changeMonth(date.toISOString().slice(0, 7));
  }
  return (
    <div className="min-w-0">
      <div className={selected ? "hidden" : ""}>
        <header className="flex items-center justify-end px-4 py-2">
          <h1 className="sr-only">Trading Review</h1>
          <Link
            href="/journal/archive"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Архив старых заметок
          </Link>
        </header>
        <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                disabled={!month || month === "1900-01"}
                onClick={() => shiftMonth(-1)}
                aria-label="Предыдущий месяц"
              >
                <ArrowLeft className="size-4" />
              </Button>
              <JournalPopover
                label="Выбор месяца"
                open={monthOpen}
                onOpenChange={setMonthOpen}
                className="w-[380px] max-w-[calc(100vw-32px)]"
                trigger={
                  <Button variant="outline" className="capitalize">
                    <CalendarDays className="size-4" />
                    {monthLabel || "Загрузка…"}
                    <ChevronDown className="size-3" />
                  </Button>
                }
              >
                <ReviewMonthPicker value={month} today={today} open={monthOpen} onChange={changeMonth}/>
              </JournalPopover>
              <Button
                variant="outline"
                size="icon"
                disabled={!month || month === "2200-12"}
                onClick={() => shiftMonth(1)}
                aria-label="Следующий месяц"
              >
                <ArrowRight className="size-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setOpenWeeks(
                    openWeeks.length === weeks.length ? [] : weeks.map((week) => week.key),
                  )
                }
              >
                {openWeeks.length === weeks.length ? "Свернуть недели" : "Раскрыть недели"}
              </Button>
              <Button variant="ghost" size="icon" onClick={api.refresh} aria-label="Обновить итоги">
                <RefreshCw className="size-4" />
              </Button>
            </div>
          </div>
          {api.error && (
            <div role="alert" className="text-sm text-destructive">
              {api.error}{" "}
              <Button variant="outline" size="sm" onClick={api.refresh}>
                Повторить
              </Button>
            </div>
          )}
          {!api.data && !api.error && (
            <div role="status" className="py-10 text-sm text-muted-foreground">
              Загружаем карточки…
            </div>
          )}
          {api.data && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 px-3 py-2">
              <span className="text-sm text-muted-foreground">Аккаунты и проп-фирмы</span>
              <JournalChoicePicker label="Аккаунты и проп-фирмы" className="min-w-64 flex-1 rounded-lg px-3 py-2 text-sm" placeholder="Все аккаунты" values={accountSelection} onValuesChange={changeAccountScope}
                options={[...(api.data.firms??[]).map(firm=>({value:`firm:${firm.id}`,label:`Фирма · ${firm.name}`})),...(api.data.accountScopes??[]).map(account=>({value:`account:${account.id}`,label:account.name}))]}/>
              {!!accountSelection.length&&<button className="rounded px-3 py-2 text-sm hover:bg-accent" onClick={()=>changeAccountScope([])}>Сбросить</button>}
            </div>
          )}
          {api.data && (
            <>
            <ReviewCalendar month={month} today={today} entries={entries} terms={terms} reviews={api.data.reviews} onDay={key=>openReport(key,'day')}/>
            <ScenarioAnalytics entries={monthEntries} terms={terms}/>
            </>
          )}
          {api.data && (
            <>
              <Card className="overflow-hidden">
                <CardContent className="px-4 py-5">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      <span
                        className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${statusTone(monthStats.rr === null ? "" : monthStats.rr > 0 ? "Win Day" : monthStats.rr < 0 ? "Loss Day" : "BE")}`}
                      >
                        <Moon className="size-4" />
                      </span>
                      Month Review · {monthLabel}
                    </div>
                    <span className="flex items-center gap-3 text-xs text-muted-foreground">
                      {completed} дней заполнено · Live
                      <button
                        onClick={() => openReport(`${month}-01`, "month")}
                        aria-label="Открыть месячный обзор"
                        title="Открыть месячный обзор"
                        className="rounded-lg border p-1.5 hover:bg-accent"
                      >
                        <ArrowUpRight className="size-4" />
                      </button>
                    </span>
                  </div>
                  <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        Итог месяца · RR
                      </div>
                      <div className="mt-2 text-4xl font-semibold tabular-nums">
                        {number(monthStats.rr, "R")}
                        {monthStats.rrMissing > 0 && "*"}
                        <PotentialRRHint value={monthStats.missedRR} coverage={`оценено ${monthStats.potentialEvaluated} из ${monthStats.records}`}/>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-x-8 gap-y-3 pb-1 text-sm">
                      <span>
                        <span className="block text-xs text-muted-foreground">PNL Cash</span>
                        <strong className="mt-1 block text-xl tabular-nums">
                          {number(monthStats.cash)}
                        </strong>
                      </span>
                      <span>
                        <span className="block text-xs text-muted-foreground">Сделки</span>
                        <strong className="mt-1 block text-xl">{monthStats.trades}</strong>
                      </span>
                      <span>
                        <span className="block text-xs text-muted-foreground">Торговые дни</span>
                        <strong className="mt-1 block text-xl">
                          {
                            new Set(
                              monthEntries
                                .filter((entry) => reviewStats([entry], terms).trades > 0)
                                .map((entry) => entry.date),
                            ).size
                          }
                        </strong>
                      </span>
                      <div>
                        <div className="mb-1 text-xs text-muted-foreground">Аккаунты</div>
                        <ReviewAccounts entries={monthEntries} terms={terms} />
                      </div>
                    </div>
                  </div>
                  <p className="mt-4 text-[11px] text-muted-foreground">
                    Итоги месяца — только даты выбранного месяца. PNL Cash указан в долларах США
                    ($).
                  </p>
                </CardContent>
              </Card>
              <div className="space-y-5">
                {weeks.map((week, index) => {
                  const weeklyEntries = entries.filter(
                    (entry) => entry.date >= week.key && entry.date <= week.end,
                  );
                  const weeklyRecord = records.get(`week:${week.key}`);
                  const weekStats = reviewStats(weeklyEntries, terms);
                  const open = openWeeks.includes(week.key);
                  const weekend = [addDays(week.key, 5), week.end].filter(
                    (date) =>
                      entries.some((entry) => entry.date === date) || records.has(`day:${date}`),
                  );
                  const days = [...week.days, ...weekend];
                  const weekStatus = weekDayStatus(
                    days.map((date) => records.get(`day:${date}`)?.dayStatus),
                  );
                  const toggleWeek = () =>
                    setOpenWeeks((current) =>
                      current.includes(week.key)
                        ? current.filter((key) => key !== week.key)
                        : [...current, week.key],
                    );
                  const filled = days.filter((date) =>
                    hasReviewContent(records.get(`day:${date}`)),
                  ).length;
                  return (
                    <section
                      key={week.key}
                      aria-label={`Неделя ${index + 1}`}
                      className="space-y-2"
                    >
                      <Card
                        className="cursor-pointer border-border/80"
                        onClick={(event) => {
                          if ((event.target as HTMLElement).closest("button,a,input,select"))
                            return;
                          toggleWeek();
                        }}
                      >
                        <CardContent className="px-4 py-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <button
                              type="button"
                              onClick={toggleWeek}
                              aria-expanded={open}
                              aria-controls={`week-${week.key}`}
                              className="flex min-w-0 items-center gap-3 text-left"
                            >
                              <span
                                className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${statusTone(weekStatus)}`}
                              >
                                <CalendarDays className="size-4" />
                              </span>
                              <span>
                                <span className="block text-base font-semibold">
                                  Week {index + 1}{" "}
                                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                                    {filled}/{days.length} дней заполнено
                                  </span>
                                </span>
                                <span className="mt-1 block text-xs text-muted-foreground">
                                  {russianDate(week.key)} — {russianDate(week.end)}
                                </span>
                              </span>
                            </button>
                            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                              <span>
                                RR{" "}
                                <strong className="ml-1 text-sm text-foreground">
                                  {number(weekStats.rr, "R")}
                                  {weekStats.rrMissing > 0 && "*"}
                                  <PotentialRRHint value={weekStats.missedRR} coverage={`оценено ${weekStats.potentialEvaluated} из ${weekStats.records}`}/>
                                </strong>
                              </span>
                              <span>
                                Cash{" "}
                                <strong className="ml-1 text-sm text-foreground">
                                  {number(weekStats.cash)}
                                </strong>
                              </span>
                              <span>
                                Сделки{" "}
                                <strong className="ml-1 text-sm text-foreground">
                                  {weekStats.trades}
                                </strong>
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>Аккаунты</span>
                              <ReviewAccounts entries={weeklyEntries} terms={terms} />
                            </div>
                            <div className="flex shrink-0 gap-2">
                              <button
                                aria-label={
                                  open
                                    ? `Свернуть неделю ${index + 1}`
                                    : `Раскрыть неделю ${index + 1}`
                                }
                                title={open ? "Свернуть дни" : "Раскрыть дни"}
                                aria-expanded={open}
                                aria-controls={`week-${week.key}`}
                                onClick={toggleWeek}
                                className="flex h-8 w-16 items-center justify-center rounded-lg border border-foreground/10 bg-foreground/[0.04] transition-colors hover:border-foreground/20 hover:bg-foreground/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                <ChevronDown
                                  className={`size-4 transition-transform ${open ? "rotate-180" : ""}`}
                                />
                              </button>
                              <button
                                aria-label={`Открыть недельный обзор ${index + 1}`}
                                title="Открыть недельный обзор"
                                onClick={() => openReport(week.key, "week")}
                                className="flex h-8 w-16 items-center justify-center rounded-lg border border-foreground/10 bg-foreground/[0.04] transition-colors hover:border-foreground/20 hover:bg-foreground/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                <ArrowUpRight className="size-4" />
                              </button>
                            </div>
                          </div>
                          {open && weeklyRecord?.postText && (
                            <p className="mt-4 line-clamp-2 whitespace-pre-wrap border-t pt-3 text-sm text-muted-foreground">
                              {weeklyRecord.postText}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                      {open && (
                        <div id={`week-${week.key}`} className="space-y-1.5">
                          {days.map((date) => {
                            const dayEntries = entries.filter((entry) => entry.date === date);
                            const day = records.get(`day:${date}`);
                            const stats = reviewStats(dayEntries, terms);
                            const future = date > today;
                            const state = hasReviewContent(day)
                              ? "Заполнено"
                              : day
                                ? "Черновик"
                                : date === today
                                  ? "Сегодня"
                                  : future
                                    ? "Впереди"
                                    : "Не заполнено";
                            return (
                              <button
                                key={date}
                                className="block w-full rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                onClick={() => openReport(date, "day")}
                                aria-label={`Открыть ${russianDate(date)}`}
                              >
                                <Card
                                  className={`transition-colors hover:border-ring ${dayTone(day?.dayStatus)} ${date === today && !day?.dayStatus ? "border-brand/40" : ""}`}
                                >
                                  <CardContent className="p-3">
                                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                                      <div className="w-40 shrink-0">
                                        <div className="font-semibold capitalize">
                                          {russianDate(date, true)}
                                        </div>
                                        <div className="mt-1 text-xs text-muted-foreground">
                                          {russianDate(date)}
                                        </div>
                                        <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                                          {hasReviewContent(day) && (
                                            <Check className="size-3 text-emerald-500" />
                                          )}
                                          {state}
                                          {!date.startsWith(month) && " · соседний месяц"}
                                        </div>
                                      </div>
                                      <span className="min-w-24 max-w-48 flex-1 text-xs text-muted-foreground">
                                        NY Narrative
                                        <span
                                          className="mt-1 block truncate text-sm text-foreground"
                                          title={day?.nyNarrative}
                                        >
                                          {day?.nyNarrative || "—"}
                                        </span>
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        NY ATR
                                        <span className="mt-1 block text-sm text-foreground">
                                          {day?.nyAtr ?? "—"}
                                        </span>
                                      </span>
                                      <span
                                        className={`w-fit shrink-0 rounded-md px-2.5 py-1 text-xs font-medium ${statusTone(day?.dayStatus)}`}
                                      >
                                        {dayStatusLabel(day?.dayStatus)}
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        RR
                                        <strong className="mt-1 block text-sm text-foreground">
                                          {number(stats.rr, "R")}
                                          {stats.rrMissing > 0 && "*"}
                                          <PotentialRRHint value={stats.missedRR} coverage={`оценено ${stats.potentialEvaluated} из ${stats.records}`}/>
                                        </strong>
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        Сделки
                                        <strong className="mt-1 block text-sm text-foreground">
                                          {stats.trades}
                                        </strong>
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        PNL Cash
                                        <strong className="mt-1 block text-sm text-foreground">
                                          {number(stats.cash)}
                                        </strong>
                                      </span>
                                    </div>
                                  </CardContent>
                                </Card>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
      {selected && api.data && (
        <ReviewEditor
          key={`${selected.kind}:${selected.key}`}
          selected={selected}
          record={
            records.get(`${selected.kind}:${selected.key}`) ??
            emptyReview(selected.key, selected.kind)
          }
          entries={entries.filter((entry) =>
            selected.kind === "day"
              ? entry.date === selected.key
              : selected.kind === "month"
                ? entry.date.startsWith(selected.key.slice(0, 7))
                : entry.date >= selected.key && entry.date <= addDays(selected.key, 6),
          )}
          terms={terms}
          onClose={closeReport}
          onSaved={api.refresh}
        />
      )}
    </div>
  );
}

function ReviewEditor({
  selected,
  record,
  entries,
  terms,
  onClose,
  onSaved,
}: {
  selected: { key: string; kind: ReviewRecord["kind"] };
  record: ReviewRecord;
  entries: JournalEntry[];
  terms: Term[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const backupKey = `review-draft:${record.kind}:${record.key}`;
  const [draft, setDraft] = useState(() => {
    try {
      const backup = localStorage.getItem(backupKey);
      return backup ? (JSON.parse(backup) as ReviewRecord) : record;
    } catch {
      return record;
    }
  });
  const [saved, setSaved] = useState(record);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const latest = useRef(draft);
  latest.current = draft;
  const queue = useRef(Promise.resolve(true));
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const daily = selected.kind === "day";
  const monthly = selected.kind === "month";
  const reviewTitle = daily ? "Daily Review" : monthly ? "Month Review" : "Weekly Review";
  useEffect(() => {
    const prevent = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty]);
  async function close() {
    if ((!dirty && !busy) || (await save())) onClose();
  }
  function field<K extends keyof ReviewRecord>(key: K, value: ReviewRecord[K]) {
    const next = { ...latest.current, [key]: value };
    latest.current = next;
    setDraft(next);
    localStorage.setItem(backupKey, JSON.stringify(next));
    setError("");
  }
  function save() {
    const snapshot = latest.current;
    queue.current = queue.current
      .catch(() => false)
      .then(async () => {
        setBusy(true);
        setError("");
        try {
          const result = await postJson<{ review: ReviewRecord }>("/api/trading-review", snapshot);
          setSaved(result.review);
          if (JSON.stringify(latest.current) === JSON.stringify(snapshot))
            localStorage.removeItem(backupKey);
          onSaved();
          return true;
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : "Не удалось сохранить");
          return false;
        } finally {
          setBusy(false);
        }
      });
    return queue.current;
  }
  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(() => void save(), 600);
    return () => clearTimeout(timer);
  }, [draft]);
  const textField = (
    key: "preText" | "mindsetText" | "sessionText" | "postText",
    label: string,
    placeholder: string,
  ) => (
    <label className="block space-y-2">
      <span className="text-sm font-medium">{label}</span>
      <GrowingText
        source={`review:${selected.kind}:${selected.key}:${key}`}
        value={draft[key] ?? ""}
        onChange={(value) => field(key, value)}
        placeholder={placeholder}
      />
    </label>
  );
  return (
    <article className="min-w-0">
      <div className="flex items-center justify-end px-5 py-2">
        <nav aria-label="Путь отчёта" className="sr-only">
          <button onClick={close} className="text-muted-foreground hover:text-foreground">
            Trading Review
          </button>
          <span className="text-muted-foreground">/</span>
          <span className="first-letter:uppercase">
            {monthly ? selected.key.slice(0, 7) : russianDate(selected.key)}
          </span>
          <span className="text-muted-foreground">/ {reviewTitle}</span>
        </nav>
        <button
          aria-label="Закрыть отчёт"
          onClick={close}
          className="rounded-lg border p-1.5 hover:bg-accent"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className={`mx-auto space-y-6 p-5 sm:p-8 ${daily ? "max-w-[1460px] lg:px-[70px]" : "max-w-5xl"}`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-2xl font-semibold first-letter:uppercase">
              {daily
                ? `${russianDate(selected.key, true)} · ${russianDate(selected.key)}`
                : reviewTitle}
            </h2>
            {!daily && (
              <p className="mt-2 text-sm text-muted-foreground">
                {russianDate(selected.key)}
                {!daily && !monthly && ` — ${russianDate(addDays(selected.key, 6))}`}
              </p>
            )}
          </div>
        </div>
        <Card>
          <CardContent className="p-4">
            <Metrics entries={entries} terms={terms} large neutral={daily} />
            <ScenarioAnalytics entries={entries} terms={terms}/>
          </CardContent>
        </Card>
        <fieldset className="space-y-10">
          {daily && <RelatedReviewTrades entries={entries} terms={terms} beforeOpen={dirty||busy?save:undefined}/>}
          {daily ? (
            <>
              <section className="space-y-4">
                <h3 className="text-2xl font-semibold">Pre-Market</h3>
                <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_6rem_minmax(0,1.8fr)_minmax(0,1fr)]">
                  <div className="grid items-center gap-2 text-sm sm:grid-cols-[10rem_minmax(0,1fr)] xl:block">
                    <div className="text-sm font-medium xl:mb-2">D Narrative</div>
                    <JournalChoicePicker
                      label="D Narrative"
                      value={draft.preNarrative}
                      options={narrativeOptions}
                      onChange={(value) => field("preNarrative", value)}
                      className={`min-h-10 rounded-lg border border-border/70 bg-background px-3 py-2 ${narrativeTone(draft.preNarrative)}`}
                    />
                  </div>
                  <label className="grid items-center gap-2 text-sm sm:grid-cols-[10rem_minmax(0,1fr)] xl:block">
                    <span className="text-sm font-medium xl:mb-2 xl:block">D ATR</span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={draft.preAtr ?? ""}
                      onChange={(event) =>
                        field(
                          "preAtr",
                          event.target.value === "" ? null : Number(event.target.value),
                        )
                      }
                      className={`${input} max-w-24`}
                    />
                  </label>
                  {(
                    [
                      ["vpOpen", "Volume Profile Daily · Open"],
                      ["vpShape", "D-VP Shape"],
                      ["preSessionVpOpen", "PRE Session Volume Profile · Open (с 18:00)"],
                      ["preSessionVpShape", "PRE Session VP · Shape"],
                    ] as const
                  ).map(([key, label]) => (
                    <div
                      key={key}
                      className={`grid items-center gap-2 sm:grid-cols-[10rem_minmax(0,1fr)] xl:block ${key==='preSessionVpOpen'?'xl:col-span-3':''}`}
                    >
                      <div className="text-sm font-medium xl:mb-2">{label}</div>
                      <JournalChoicePicker
                        label={label}
                        className="min-h-10 rounded-lg border border-border/70 bg-background px-3 py-2"
                        options={REVIEW_CONTEXT[key].map((value) => ({
                          value,
                          label:
                            key === "vpShape" || key === "preSessionVpShape"
                              ? value === "B (double distribution)"
                                ? "B shape (double distribution)"
                                : `${value} shape`
                              : value,
                        }))}
                        values={draft[key] ?? []}
                        onValuesChange={(values) => field(key, values)}
                      />
                    </div>
                  ))}
                </div>
                {textField(
                  "mindsetText",
                  "Моё состояние и мысли",
                  "Как себя чувствую, что сейчас думаю…",
                )}
                {textField("preText", "План и контекст", "Что ожидаю от дня, что важно учесть…")}
              </section>
              <section className="space-y-4">
                <h3 className="text-2xl font-semibold">Live Session</h3>
                {draft.sessionText && textField("sessionText", "Ранее записанные наблюдения", "")}
                <SessionTimeline key={`day:${selected.key}`} date={selected.key} />
              </section>
              <section className="space-y-4">
                <h3 className="text-2xl font-semibold">Post-Market</h3>
                <div className="grid grid-cols-[minmax(0,1fr)_6rem_minmax(0,1fr)] gap-3">
                  <label className="text-sm">
                    NY Narrative
                    <JournalChoicePicker
                      label="NY Narrative"
                      className={`mt-2 min-h-10 rounded-lg border border-border/70 bg-background px-3 py-2 ${narrativeTone(draft.nyNarrative)}`}
                      value={draft.nyNarrative}
                      options={narrativeOptions}
                      onChange={(value) => field("nyNarrative", value)}
                    />
                  </label>
                  <label className="text-sm">
                    NY ATR
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={draft.nyAtr ?? ""}
                      onChange={(event) =>
                        field(
                          "nyAtr",
                          event.target.value === "" ? null : Number(event.target.value),
                        )
                      }
                      className={`${input} mt-2`}
                    />
                  </label>
                  <div className="text-sm">
                    <div>Статус дня</div>
                    <JournalChoicePicker
                      label="Статус дня"
                      className={`mt-2 min-h-10 rounded-lg border px-3 py-2 ${statusTone(draft.dayStatus ?? "")}`}
                      value={draft.dayStatus ?? ""}
                      options={["", "Win Day", "Loss Day", "BE", "Missed", "Nothing Day"].map((status) => ({
                        value: status,
                        label: status === "" ? "Не выбран" : dayStatusLabel(status),
                        chipClassName: statusTone(status),
                      }))}
                      onChange={(value) => field("dayStatus", value as ReviewRecord["dayStatus"])}
                    />
                  </div>
                </div>
                {textField(
                  "postText",
                  "Итоги и выводы",
                  "Что получилось, что изменить, что проверить…",
                )}
                <ProcessReportCard key={`process:${selected.key}`} date={selected.key}/>
              </section>
            </>
          ) : (
            <>
              {textField(
                "preText",
                monthly ? "Фокус месяца" : "Фокус недели",
                "На чём сосредоточусь…",
              )}
              {!monthly && <section className="space-y-4"><h3 className="text-2xl font-semibold">Заметки</h3>
                {draft.sessionText&&textField("sessionText","Ранее записанные мысли","")}
                <SessionTimeline key={`week:${selected.key}`} date={selected.key} kind="week"/>
              </section>}
              {textField(
                "postText",
                monthly ? "Итоги месяца" : "Итоги недели",
                "Повторяющиеся ситуации, выводы и следующий шаг…",
              )}
            </>
          )}
        </fieldset>
        <SessionExtracts date={selected.key} kind={selected.kind} />
        <RelatedReviewTrades entries={entries} terms={terms} beforeOpen={dirty||busy?save:undefined}/>
      </div>
      {error && (
        <div role="alert" className="flex items-center gap-3 px-4 pb-4 text-sm text-destructive">
          <span>{error}</span>
          <button onClick={() => void save()} className="text-sm">
            Повторить
          </button>
        </div>
      )}
    </article>
  );
}

export function GrowingText({
  source,
  value,
  onChange,
  placeholder,
}: {
  source: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [uploading,setUploading]=useState(false);
  const [pasteError,setPasteError]=useState('');
  const reflection=/^review:day:[^:]+:postText(?:$|:)/.test(source);
  useEffect(() => {
    const el = ref.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.max(78, el.scrollHeight + 2)}px`;
    }
  }, [value]);
  return (
    <div className="rounded-lg border border-foreground/20 bg-card/30 px-3 py-2 transition-colors focus-within:border-ring focus-within:ring-1 focus-within:ring-ring/30">
    <SlashTextarea
      data-workflow-source={source}
      ref={ref}
      rows={3}
      value={reflection?dailyReflectionText(value):value}
      data-fixed-prompts={reflection?JSON.stringify(DAILY_REFLECTION_QUESTIONS):undefined}
      readOnly={uploading}
      onPaste={event=>{
        const images=Array.from(event.clipboardData.files).filter(f=>f.type.startsWith('image/')||f.type.startsWith('video/')||/\.(mp4|webm)$/i.test(f.name));if(!images.length||uploading)return;
        event.preventDefault();event.stopPropagation();
        const start=event.currentTarget.selectionStart,end=event.currentTarget.selectionEnd,text=event.currentTarget.value;
        setUploading(true);setPasteError('');
        void(async()=>{try{
          const [,kind,key]=source.split(':');
          await postJson('/api/trading-review',{key,kind});
          const ids:string[]=[];for(const image of images){const form=new FormData();form.set('type','review');form.set('id',source);form.set('file',image);
          const response=await uploadAttachment(form);const result=await response.json();if(!response.ok)throw new Error(result.error||'Не удалось вставить скриншот');ids.push(result.id);}
          const before=text.slice(0,start);const lines=before.split('\n');let line=lines.length-1;while(line>0&&lines[line]!.startsWith('\t'))line--;
          const command=/^\/[\p{L}\p{N}_-]{1,40}[ \t]/u.test(lines[line]!);
          const after=text.slice(end);
          const tail=after&&!after.startsWith('\n')?(command?'\n\t':'\n')+after:after;
          const next=command?before+(before.endsWith('\n\t')?'':before.endsWith('\n')?'\t':'\n\t')+ids.map(id=>`[[image:${id}]]`).join('\n\t')+tail:(before.endsWith('\n')?before:before+'\n')+ids.map(id=>`[[image:${id}]]`).join('\n')+tail;
          onChange(next);
        }catch(cause){setPasteError(cause instanceof Error?cause.message:'Ошибка вставки');}finally{setUploading(false);}})();
      }}
      onChange={(event) => onChange(event.target.value)}
      placeholder={reflection?'Итоги дня':placeholder}
      className="w-full resize-none overflow-hidden bg-transparent text-sm leading-5 outline-none"
    />
    {uploading&&<p role="status" className="text-xs text-muted-foreground">Вставляем скриншот…</p>}
    {pasteError&&<p role="alert" className="text-xs text-destructive">{pasteError}</p>}
    </div>
  );
}
