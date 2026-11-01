import type { JournalEntry } from "@/server/personal-journal";
export const RESULT_ORDER = ["Win", "Loss", "Breakeven", "BE", "Missed", "НЛО", "Hypothesis"];
export const MODE_LABELS: Record<"Forward" | "Back", string> = {
  Forward: "Live",
  Back: "Historical",
};

export type FilterProperty = {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "time" | "choice" | "relation";
  options?: string[];
};
export const FILTER_PROPERTIES: FilterProperty[] = [
  { key: "tradeNo", label: "Trade", type: "number" },
  { key: "date", label: "Дата", type: "date" },
  { key: "mode", label: "Live / Historical", type: "choice", options: ["Forward", "Back"] },
  { key: "direction", label: "Позиция", type: "choice", options: ["Long", "Short"] },
  { key: "type", label: "Type", type: "relation" },
  ...(
    [
      ["result", "Результат"],
      ["instrument", "Asset"],
      ["setup", "Setup"],
      ["storyline", "Storyline"],
      ["trigger", "Trigger"],
      ["vp", "VP Context"],
      ["vwap", "VWAP Context"],
      ["account", "Аккаунты"],
    ] as const
  ).map(([key, label]) => ({ key, label, type: "relation" as const })),
  { key: "quickNote", label: "Заметка", type: "text" },
  { key: "openedAt", label: "Open Time", type: "time" },
  { key: "closedAt", label: "Close Time", type: "time" },
  ...(
    [
      ["riskTicks", "Risk Ticks"],
      ["realisedTicks", "Realised Ticks"],
      ["realisedR", "Realised RR"],
      ["mfe", "MFE"],
      ["mae", "MAE"],
      ["pnlCash", "PNL Cash · сумма"],
      ["pnlPct", "P&L % · аккаунта"],
      ["riskPct", "Risk % · аккаунта"],
    ] as const
  ).map(([key, label]) => ({ key, label, type: "number" as const })),
  { key: "bodyTitle", label: "Заголовок", type: "text" },
  { key: "bodyText", label: "Основной текст", type: "text" },
];
export type FilterRule = {
  kind: "rule";
  id: string;
  property: string;
  operator: string;
  value: string;
  values: string[];
  end: string;
};
export type FilterGroup = {
  kind: "group";
  id: string;
  conjunction: "and" | "or";
  children: FilterNode[];
};
export type FilterNode = FilterRule | FilterGroup;
export type Period = {
  preset: "all" | "today" | "week" | "month" | "year" | "custom";
  from: string;
  to: string;
};
export const EMPTY_FILTER: FilterGroup = {
  kind: "group",
  id: "root",
  conjunction: "and",
  children: [],
};
export const DEFAULT_PERIOD: Period = { preset: "all", from: "", to: "" };

export function formatJournalDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : value;
}
export function parseJournalDate(value: string): string | null {
  if (!value.trim()) return "";
  const match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const day = Number(match[1]),
    month = Number(match[2]),
    year = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day)
    return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function newRule(property = "result"): FilterRule {
  const type = FILTER_PROPERTIES.find((item) => item.key === property)?.type;
  return {
    kind: "rule",
    id: crypto.randomUUID(),
    property,
    operator: type === "relation" ? "any" : type === "text" ? "contains" : "eq",
    value: "",
    values: [],
    end: "",
  };
}
export function operators(type: FilterProperty["type"]): [string, string][] {
  const empty: [string, string][] = [
    ["empty", "Пусто"],
    ["notEmpty", "Не пусто"],
  ];
  if (type === "relation")
    return [["any", "Содержит"], ["none", "Не содержит"], ["all", "Содержит все"], ...empty];
  if (type === "number")
    return [
      ["eq", "Равно"],
      ["ne", "Не равно"],
      ["gt", "Больше"],
      ["gte", "Больше или равно"],
      ["lt", "Меньше"],
      ["lte", "Меньше или равно"],
      ...empty,
    ];
  if (type === "date" || type === "time")
    return [
      ["eq", "Совпадает с"],
      ["ne", "Не совпадает с"],
      ["lt", "Раньше"],
      ["gt", "Позже"],
      ["lte", "Не позже"],
      ["gte", "Не раньше"],
      ["between", "В диапазоне"],
      ...empty,
    ];
  if (type === "choice") return [["eq", "Равно"], ["ne", "Не равно"], ...empty];
  return [
    ["contains", "Содержит"],
    ["notContains", "Не содержит"],
    ["eq", "Равно"],
    ["ne", "Не равно"],
    ["starts", "Начинается с"],
    ["ends", "Заканчивается на"],
    ...empty,
  ];
}
function valueOf(entry: JournalEntry, property: string): unknown {
  if (property === "account") return entry.accounts.map((item) => item.accountId);
  if (property === "pnlCash") {
    const values = entry.accounts
      .map((item) => item.pnlCash)
      .filter((item): item is number => item !== null);
    return values.length ? values.reduce((sum, item) => sum + item, 0) : null;
  }
  if (property === "pnlPct" || property === "riskPct")
    return entry.accounts.map((item) => item[property]).filter((item) => item !== null);
  if (FILTER_PROPERTIES.find((item) => item.key === property)?.type === "relation")
    return entry.terms[property as keyof JournalEntry["terms"]] ?? [];
  return (entry as unknown as Record<string, unknown>)[property];
}
function compare(actual: string | number, expected: string | number, op: string) {
  if (op === "eq") return actual === expected;
  if (op === "ne") return actual !== expected;
  if (op === "gt") return actual > expected;
  if (op === "gte") return actual >= expected;
  if (op === "lt") return actual < expected;
  if (op === "lte") return actual <= expected;
  return false;
}
function evaluateNode(entry: JournalEntry, node: FilterNode): boolean | null {
  if (node.kind === "group") {
    const results = node.children
      .map((item) => evaluateNode(entry, item))
      .filter((item): item is boolean => item !== null);
    return results.length
      ? node.conjunction === "and"
        ? results.every(Boolean)
        : results.some(Boolean)
      : null;
  }
  const property = FILTER_PROPERTIES.find((item) => item.key === node.property);
  if (!property) return null;
  const actual = valueOf(entry, node.property);
  const empty =
    actual === null ||
    actual === undefined ||
    actual === "" ||
    (Array.isArray(actual) && actual.length === 0);
  if (node.operator === "empty") return empty;
  if (node.operator === "notEmpty") return !empty;
  if (property.type === "relation") {
    if (!node.values.length) return null;
    const ids = Array.isArray(actual) ? actual : [];
    if (node.operator === "none") return node.values.every((id) => !ids.includes(id));
    if (node.operator === "all") return node.values.every((id) => ids.includes(id));
    return node.values.some((id) => ids.includes(id));
  }
  if (node.value === "") return null;
  if (empty) return false;
  if (property.type === "number") {
    const expected = Number(node.value);
    if (!Number.isFinite(expected)) return null;
    return (Array.isArray(actual) ? actual : [actual]).some(
      (item) => typeof item === "number" && compare(item, expected, node.operator),
    );
  }
  const text = String(actual).toLowerCase();
  const expected = node.value.toLowerCase();
  if (node.operator === "contains") return text.includes(expected);
  if (node.operator === "notContains") return !text.includes(expected);
  if (node.operator === "starts") return text.startsWith(expected);
  if (node.operator === "ends") return text.endsWith(expected);
  if (node.operator === "between") return node.end ? text >= expected && text <= node.end : null;
  return compare(text, expected, node.operator);
}
export const matchesFilters = (entry: JournalEntry, group: FilterGroup) =>
  evaluateNode(entry, group) ?? true;
export function activeFilterCount(node: FilterNode): number {
  return node.kind === "group"
    ? node.children.reduce((count, child) => count + activeFilterCount(child), 0)
    : node.operator === "empty" ||
        node.operator === "notEmpty" ||
        node.value !== "" ||
        node.values.length > 0
      ? 1
      : 0;
}
export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function periodBounds(period: Period, now = new Date()): { from: string; to: string } {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Qyzylorda",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const date = new Date(`${today}T12:00:00`);
  if (period.preset === "all") return { from: "", to: "" };
  if (period.preset === "custom") return { from: period.from, to: period.to };
  if (period.preset === "today") return { from: today, to: today };
  if (period.preset === "week") {
    const start = new Date(date);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { from: localDateKey(start), to: localDateKey(end) };
  }
  if (period.preset === "year")
    return { from: `${date.getFullYear()}-01-01`, to: `${date.getFullYear()}-12-31` };
  return {
    from: localDateKey(new Date(date.getFullYear(), date.getMonth(), 1)),
    to: localDateKey(new Date(date.getFullYear(), date.getMonth() + 1, 0)),
  };
}
