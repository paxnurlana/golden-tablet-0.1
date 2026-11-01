import type { JournalEntry, Term } from "@/server/personal-journal";
import {isScenarioEntry} from './trade-accounting';
import {missedRR,scenarioPotentialRR} from './trade-potential';

export type ReviewRecord = {
  key: string;
  kind: "day" | "week" | "month";
  preNarrative: string;
  preAtr: number | null;
  preText: string;
  mindsetText?: string;
  sessionText: string;
  nyNarrative: string;
  nyAtr: number | null;
  postText: string;
  complete: boolean;
  vpOpen?: string[];
  vwapOpen?: string[];
  vpShape?: string[];
  preSessionVpOpen?: string[];
  preSessionVpShape?: string[];
  dayStatus?: "" | "Win Day" | "Loss Day" | "BE" | "Nothing Day" | "Missed";
};
export function emptyReview(key: string, kind: ReviewRecord["kind"]): ReviewRecord {
  return {
    key,
    kind,
    preNarrative: "",
    preAtr: null,
    preText: "",
    sessionText: "",
    nyNarrative: "",
    nyAtr: null,
    postText: "",
    complete: false,
  };
}
export function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}
export function hasReviewContent(record?: ReviewRecord) {
  return (
    !!record &&
    !!(
      record.dayStatus ||
      record.preNarrative ||
      record.preAtr !== null ||
      record.preText ||
      record.sessionText ||
      record.nyNarrative ||
      record.nyAtr !== null ||
      record.postText ||
      record.vpOpen?.length ||
      record.vwapOpen?.length ||
      record.vpShape?.length ||
      record.preSessionVpOpen?.length ||
      record.preSessionVpShape?.length
    )
  );
}
export function addDays(key: string, days: number) {
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return dateKey(date);
}
export function monthWeeks(month: string) {
  const first = `${month}-01`;
  const endDate = new Date(`${first}T12:00:00Z`);
  endDate.setUTCMonth(endDate.getUTCMonth() + 1, 0);
  const last = dateKey(endDate);
  const weekday = new Date(`${first}T12:00:00Z`).getUTCDay();
  let monday = addDays(first, -((weekday + 6) % 7));
  const weeks: { key: string; days: string[]; end: string }[] = [];
  while (monday <= last) {
    // The majority of Monday–Friday belongs to the month of Wednesday.
    if (addDays(monday, 2).slice(0, 7) === month)
      weeks.push({
        key: monday,
        days: Array.from({ length: 5 }, (_, i) => addDays(monday, i)),
        end: addDays(monday, 6),
      });
    monday = addDays(monday, 7);
  }
  return weeks;
}
export function weekDayStatus(statuses: ReviewRecord["dayStatus"][]): ReviewRecord["dayStatus"] {
  const wins = statuses.filter((status) => status === "Win Day").length;
  const losses = statuses.filter((status) => status === "Loss Day").length;
  if (wins > losses) return "Win Day";
  if (losses > wins) return "Loss Day";
  if (wins || statuses.includes("BE")) return "BE";
  if(statuses.includes('Missed'))return 'Missed';
  return statuses.includes("Nothing Day") ? "Nothing Day" : "";
}
export function localToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Qyzylorda",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function russianDate(key: string, weekday = false) {
  return new Intl.DateTimeFormat(
    "ru-RU",
    weekday
      ? { weekday: "long", timeZone: "UTC" }
      : { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" },
  ).format(new Date(`${key}T12:00:00Z`));
}
export function reviewStats(entries: JournalEntry[], terms: Term[]) {
  const unique = [...new Map(entries.map((entry) => [entry.id, entry])).values()];
  const names = new Map(terms.map((term) => [term.id, term.name]));
  // Count ideas once, regardless of how many accounts executed each idea.
  const executed = unique.filter(
    (entry) =>
      !isScenarioEntry(entry,names) && ((entry.terms.result ?? []).some((id) =>
        ["Win", "Loss", "BE", "Breakeven"].includes(names.get(id) ?? ""),
      ) ||
      entry.realisedR !== null ||
      entry.realisedTicks !== null ||
      entry.accounts.some((account) => account.pnlCash !== null || account.pnlPct !== null)),
  );
  const rrValues = executed.flatMap((entry) => (entry.realisedR === null ? [] : [entry.realisedR]));
  const cashValues = executed.flatMap((entry) =>
    entry.accounts.flatMap((account) => (account.pnlCash === null ? [] : [account.pnlCash])),
  );
  const rr = rrValues.length ? rrValues.reduce((sum, value) => sum + value, 0) : null;
  const potentialValues=executed.flatMap(e=>{const value=missedRR(e);return value===null?[]:[value];});
  const scenarios=unique.filter(e=>isScenarioEntry(e,names));
  const scenarioValues=scenarios.flatMap(e=>{const value=scenarioPotentialRR(e);return value===null?[]:[Math.max(0,value)];});
  const allPotential=[...potentialValues,...scenarioValues];
  return {
    missedRR:allPotential.length?allPotential.reduce((a,b)=>a+b,0):null,
    executionMissedRR:potentialValues.length?potentialValues.reduce((a,b)=>a+b,0):null,
    scenarioRR:scenarioValues.length?scenarioValues.reduce((a,b)=>a+b,0):null,
    scenarioCount:scenarios.length,
    potentialEvaluated:allPotential.length,
    records: unique.length,
    trades: executed.length,
    accounts: new Set(
      executed.flatMap((entry) => entry.accounts.map((account) => account.accountId)),
    ).size,
    rr,
    cash: cashValues.length ? cashValues.reduce((sum, value) => sum + value, 0) : null,
    rrMissing: executed.length - rrValues.length,
    cashMissing: executed.reduce(
      (sum, entry) =>
        sum +
        (entry.accounts.length
          ? entry.accounts.filter((account) => account.pnlCash === null).length
          : 1),
      0,
    ),
    outcome: !executed.length
      ? "Без сделок"
      : rr === null || rrValues.length !== executed.length
        ? "Не заполнено"
        : rr > 0
          ? "Победа"
          : rr < 0
            ? "Проигрыш"
            : "БУ",
  };
}
