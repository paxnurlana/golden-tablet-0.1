import { describe, expect, it } from "vitest";
import {
  matchesFilters,
  parseJournalDate,
  formatJournalDate,
  periodBounds,
  type FilterGroup,
  type FilterRule,
} from "../src/lib/journal-filters";
import type { JournalEntry } from "../src/server/personal-journal";

const entry: JournalEntry = {
  id: "sample",
  tradeNo: 1,
  date: "2026-10-08",
  mode: "Forward",
  direction: "Long",
  type: "Clear",
  openedAt: "15:30",
  closedAt: "16:00",
  riskTicks: 20,
  realisedTicks: 40,
  realisedR: 2,
  mfe: 0,
  mae: null,
  quickNote: "VAH retest",
  bodyTitle: "",
  bodyText: "",
  terms: { setup: ["orb", "retest"], result: ["win", "hypothesis"] },
  accounts: [
    { accountId: "a", riskPct: 1, pnlCash: 100, pnlPct: 0.5 },
    { accountId: "b", riskPct: 2, pnlCash: 200, pnlPct: 1 },
  ],
};
const rule = (
  property: string,
  operator: string,
  value = "",
  values: string[] = [],
  end = "",
): FilterRule => ({ kind: "rule", id: property, property, operator, value, values, end });
const group = (
  children: FilterGroup["children"],
  conjunction: "and" | "or" = "and",
): FilterGroup => ({ kind: "group", id: "root", conjunction, children });

describe("journal filter combinations", () => {
  it("combines shared trade fields and multiple relations without duplicating entries", () => {
    expect(
      matchesFilters(
        entry,
        group([rule("setup", "all", "", ["orb", "retest"]), rule("realisedR", "gte", "2")]),
      ),
    ).toBe(true);
    expect(matchesFilters(entry, group([rule("setup", "none", "", ["orb"])]))).toBe(false);
    expect(matchesFilters(entry, group([rule("account", "any", "", ["b"])]))).toBe(true);
  });
  it("handles nested OR groups and ignores incomplete conditions", () => {
    expect(
      matchesFilters(
        entry,
        group(
          [
            rule("mode", "eq", "Back"),
            group([rule("direction", "eq", "Long"), rule("direction", "eq", "")], "or"),
          ],
          "or",
        ),
      ),
    ).toBe(true);
    expect(
      matchesFilters(entry, group([rule("mode", "eq", "Back"), rule("direction", "eq", "")], "or")),
    ).toBe(false);
  });
  it("treats zero as a number and null as empty", () => {
    expect(matchesFilters(entry, group([rule("mfe", "eq", "0"), rule("mae", "empty")]))).toBe(true);
    expect(matchesFilters(entry, group([rule("mae", "eq", "0")]))).toBe(false);
  });
  it("sums cash but never sums account percentages", () => {
    expect(matchesFilters(entry, group([rule("pnlCash", "eq", "300")]))).toBe(true);
    expect(matchesFilters(entry, group([rule("pnlPct", "eq", "1.5")]))).toBe(false);
    expect(matchesFilters(entry, group([rule("pnlPct", "eq", "1")]))).toBe(true);
  });
  it("filters dates and time ranges inclusively", () => {
    expect(
      matchesFilters(
        entry,
        group([
          rule("date", "between", "2026-10-08", [], "2026-10-09"),
          rule("openedAt", "between", "15:00", [], "15:30"),
        ]),
      ),
    ).toBe(true);
    expect(matchesFilters(entry, group([rule("openedAt", "gt", "15:30")]))).toBe(false);
  });
});

describe("journal dates", () => {
  it("converts dotted day-month-year dates and rejects impossible dates", () => {
    expect(formatJournalDate("2026-10-08")).toBe("08.10.2026");
    expect(parseJournalDate("8.10.2026")).toBe("2026-10-08");
    expect(parseJournalDate("31.02.2026")).toBeNull();
    expect(parseJournalDate("29.02.2024")).toBe("2024-02-29");
  });
  it("uses Kazakhstan date at the UTC day boundary", () => {
    expect(
      periodBounds({ preset: "today", from: "", to: "" }, new Date("2026-10-07T20:00:00Z")),
    ).toEqual({ from: "2026-10-08", to: "2026-10-08" });
  });
});
