// @vitest-environment jsdom
import { beforeEach, afterEach, it, expect, vi } from "vitest";
const originalFetch = window.fetch;
beforeEach(async () => {
  localStorage.clear();
  vi.resetModules();
  const api = await import("../src/demo-api");
  api.installDemoApi();
});
afterEach(() => {
  window.fetch = originalFetch;
  localStorage.clear();
});
const get = async (path: string) => {
  const response = await fetch(path);
  expect(response.ok).toBe(true);
  return response.json();
};
const post = async (path: string, body: unknown, method = "POST") => {
  const response = await fetch(path, { method, body: JSON.stringify(body) });
  expect(response.ok).toBe(true);
  return response.json();
};
it("shows the same forty fictional trades and filtered account financials without a server", async () => {
  const stats = await get("/api/stats");
  expect(stats.metrics.closedTrades).toBe(40);
  expect(stats.metrics.netPnl).toBeCloseTo(6715.5);
  expect(stats.metrics.tradingDays).toBe(22);
  const reviews=(await get('/api/trading-review')).reviews;
  const day=reviews.find((r:any)=>r.kind==='day'&&r.key==='2026-10-01');
  expect(day.postText).toContain('1) Что я сделал сегодня хорошо');
  expect(day.postText).not.toMatch(/^Что я сделал сегодня хорошо$/m);
  const selected = await get("/api/stats?accounts=portfolio-atlas");
  expect(selected.metrics.closedTrades).toBe(10);
  expect(selected.metrics.netPnl).toBeCloseTo(3630);
  const journal = await get("/api/personal-journal");
  expect(journal.entries.every((e: any) => e.id.startsWith("portfolio-trade-"))).toBe(true);
  expect(
    [...journal.entries]
      .sort((a: any, b: any) => (a.date + a.openedAt).localeCompare(b.date + b.openedAt))
      .map((e: any) => e.tradeNo),
  ).toEqual(Array.from({ length: 40 }, (_, i) => i + 1));
});
it("recomputes Dashboard after editing, deleting and restoring journal entries", async () => {
  const journal = await get("/api/personal-journal"),
    entry = journal.entries[0],
    old = entry.accounts[0].pnlCash;
  entry.accounts[0].pnlCash += 100;
  await post("/api/personal-journal", {
    action: "update",
    id: entry.id,
    changes: { accounts: entry.accounts },
  });
  expect((await get("/api/stats")).metrics.netPnl).toBeCloseTo(6815.5);
  await post("/api/personal-journal", { action: "delete", id: entry.id });
  expect((await get("/api/stats")).metrics.closedTrades).toBe(39);
  expect((await get("/api/stats")).metrics.netPnl).toBeCloseTo(6715.5 - old);
  await post("/api/personal-journal", { action: "restore", id: entry.id });
  expect((await get("/api/stats")).metrics.closedTrades).toBe(40);
});
it("persists workflow edits and review text locally across a fresh module load", async () => {
  const card = await post("/api/workflow", {
    action: "create",
    category: "задача",
    text: "Проверить сценарий",
    status: "inbox",
  });
  await post("/api/workflow", { action: "move", id: card.id, status: "doing" });
  await post("/api/trading-review", { key: "2026-10-01", kind: "day", postText: "Текст проверки" });
  window.fetch = originalFetch;
  vi.resetModules();
  (await import("../src/demo-api")).installDemoApi();
  expect((await get("/api/workflow")).cards.find((c: any) => c.id === card.id)).toMatchObject({
    text: "Проверить сценарий",
    status: "doing",
  });
  expect(
    (await get("/api/trading-review")).reviews.find(
      (r: any) => r.key === "2026-10-01" && r.kind === "day",
    ).postText,
  ).toBe("Текст проверки");
});
it("saves notes and report scores without changing the initial fixture", async () => {
  const note = await post("/api/notes", { title: "Мой разбор", content: "Наблюдение" });
  await post("/api/notes/" + note.id, { content: "Уточнение" }, "PATCH");
  expect((await get("/api/notes")).notes.find((n: any) => n.id === note.id).content).toBe(
    "Уточнение",
  );
  await post("/api/process-progress", {
    op: "item",
    date: "2026-10-01",
    id: "preparation",
    score: -1,
    text: "Нужно улучшить подготовку",
  });
  expect(
    (await get("/api/process-progress")).reports.find((r: any) => r.date === "2026-10-01").items[0]
      .score,
  ).toBe(-1);
});
