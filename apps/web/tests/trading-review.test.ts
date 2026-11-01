import { expect, it } from "vitest";
import { monthWeeks, reviewStats, addDays, weekDayStatus } from "../src/lib/trading-review";
import type { JournalEntry, Term } from "../src/server/personal-journal";

const terms = ["Win", "Loss", "BE", "Missed", "Hypothesis"].map((name) => ({
  id: name,
  name,
  kind: "result",
  archived: false,
  description: "",
})) as Term[];
function entry(changes: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: "one",
    tradeNo: 1,
    date: "2026-10-09",
    mode: "Forward",
    direction: "Long",
    type: "",
    openedAt: "",
    closedAt: "",
    riskTicks: null,
    realisedTicks: null,
    realisedR: null,
    mfe: null,
    mae: null,
    quickNote: "",
    bodyTitle: "",
    bodyText: "",
    terms: {},
    accounts: [],
    ...changes,
  };
}
it("generates five weekday cards for every calendar week, including month boundaries", () => {
  const weeks = monthWeeks("2026-10");
  expect(weeks).toHaveLength(4);
  expect(weeks[0]?.key).toBe("2026-10-05");
  expect(monthWeeks('2026-09').at(-1)?.key).toBe('2026-09-28');
  expect(weeks[0]?.days).toHaveLength(5);
  expect(weeks.at(-1)?.end).toBe("2026-11-01");
  expect(monthWeeks("2026-03")).toHaveLength(4);
  expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
});
it("assigns boundary weeks once by the majority of Monday–Friday", () => {
  expect(monthWeeks("2026-11")).toHaveLength(4);
  expect(monthWeeks("2026-12")[0]?.key).toBe("2026-11-30");
  const keys: string[] = [];
  for (let month = 1; month <= 12; month++) {
    const owner = `2026-${String(month).padStart(2, "0")}`;
    const weeks = monthWeeks(owner);
    expect([4, 5]).toContain(weeks.length);
    weeks.forEach((week) => {
      expect(addDays(week.key, 2).slice(0, 7)).toBe(owner);
      expect(week.days.filter(day=>day.startsWith(owner)).length).toBeGreaterThanOrEqual(3);
    });
    keys.push(...weeks.map((week) => week.key));
  }
  expect(new Set(keys).size).toBe(keys.length);
});
it("colors a week by marked day majority without treating missing days as losses", () => {
  expect(weekDayStatus(["Win Day", "Win Day", "Win Day", "Loss Day", "Loss Day"])).toBe("Win Day");
  expect(weekDayStatus(["Win Day", "Loss Day", "Loss Day", "BE", undefined])).toBe("Loss Day");
  expect(weekDayStatus(["Win Day", "Loss Day"])).toBe("BE");
  expect(weekDayStatus(["BE", "Nothing Day"])).toBe("BE");
  expect(weekDayStatus(["Nothing Day", undefined])).toBe("Nothing Day");
  expect(weekDayStatus([undefined, ""])).toBe("");
});
it("counts an idea once and sums four accounts cash without multiplying RR", () => {
  const trade = entry({
    realisedR: 2,
    terms: { result: ["Win", "BE"] },
    accounts: Array.from({ length: 4 }, (_, i) => ({
      accountId: String(i),
      riskPct: 1,
      pnlCash: 1000,
      pnlPct: 1,
    })),
  });
  const stats = reviewStats([trade, trade], terms);
  expect(stats).toMatchObject({ trades: 1, accounts: 4, rr: 2, cash: 4000, outcome: "Победа" });
});
it("does not count unexecuted observations as trades and distinguishes missing RR from BE", () => {
  expect(reviewStats([entry({ terms: { result: ["Missed"] } })], terms)).toMatchObject({
    records: 1,
    trades: 0,
    rr: null,
    outcome: "Без сделок",
  });
  expect(reviewStats([entry({ terms: { result: ["Loss"] } })], terms).outcome).toBe("Не заполнено");
  expect(reviewStats([entry({ realisedR: 0, terms: { result: ["BE"] } })], terms).outcome).toBe(
    "БУ",
  );
});
it('excludes scenario money and RR even when populated or mixed with a legacy Win result',()=>{
  for(const name of ['Missed','Hypothesis']){
    const scenario=entry({realisedR:20,realisedTicks:1000,terms:{result:[name,'Win']},accounts:[{accountId:'qa',pnlCash:10000,pnlPct:10,riskPct:1}]});
    expect(reviewStats([scenario],terms)).toMatchObject({records:1,trades:0,accounts:0,rr:null,cash:null,outcome:'Без сделок'});
  }
});
it("marks incomplete aggregates instead of presenting partial RR as a final day result", () => {
  const stats = reviewStats(
    [entry({ realisedR: 2 }), entry({ id: "two", terms: { result: ["Loss"] } })],
    terms,
  );
  expect(stats).toMatchObject({ trades: 2, rr: 2, rrMissing: 1, outcome: "Не заполнено" });
});
