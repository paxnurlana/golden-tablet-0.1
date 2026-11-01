import { beforeAll, afterAll, it, expect, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, basename } from "node:path";
import type Database from "better-sqlite3";
let directory = "";
vi.mock("@/db", () => ({ dataDir: () => directory }));
import {
  saveFirm,
  savePersonalAccount,
  addMovement,
  listPersonalAccounts,
  createAccountDraft,
  createFirmDraft,
  removeMovement,
} from "../src/server/personal-accounts";
import {
  createPersonalJournalEntry,
  updatePersonalJournalEntry,
  listPersonalJournal,
  archivePersonalJournalEntry,
  updatePersonalJournalTerm,
} from "../src/server/personal-journal";
import { defaultProfile } from "../src/lib/personal-accounts";
import { randomUUID } from "node:crypto";
it('links potential to account summaries without adding it to balances',()=>{
 const {id}=savePersonalAccount({name:'Potential linked account',profile:{...defaultProfile(),openingBalance:1000,startDate:'2026-01-01'}});
 const e=createPersonalJournalEntry();
 updatePersonalJournalEntry(e.id,{date:'2026-10-07',riskTicks:50,realisedTicks:50,realisedR:1,accounts:[{accountId:id,riskCash:100,riskPct:null,pnlCash:100,pnlPct:null,editedField:'riskCash'}]});
 updatePersonalJournalEntry(e.id,{potential:{enabled:true,rr:3,ticks:150,basis:'planned',comment:'',accountCash:{}}});
 const a=listPersonalAccounts().accounts.find(a=>a.id===id)!;
 expect(a).toMatchObject({balance:1100,pnl:100,trades:1,potential:{missedCash:200,missedRR:2,cashCompared:1,rrCompared:1}});
 updatePersonalJournalEntry(e.id,{potential:{enabled:false,rr:3,ticks:150,basis:'planned',comment:'',accountCash:{}}});
 expect(listPersonalAccounts().accounts.find(a=>a.id===id)).toMatchObject({balance:1100,pnl:100,potential:{missedCash:null,cashCompared:0}});
});
it('keeps populated scenario records out of account balance and volume',()=>{
  const {id}=savePersonalAccount({name:'Scenario exclusion',profile:{...defaultProfile(),openingBalance:1000,startDate:'2026-01-01'}});
  const actual=createPersonalJournalEntry();
  updatePersonalJournalEntry(actual.id,{date:'2026-01-02',accounts:[{accountId:id,pnlCash:200,riskPct:null,pnlPct:null}]});
  const terms=listPersonalJournal().terms;
  for(const name of ['Missed','Hypothesis','Неопознанный трейд']){
    const result=terms.find(t=>t.kind==='result'&&t.name===name)!;
    expect(result).toBeDefined();
    const scenario=createPersonalJournalEntry();
    updatePersonalJournalEntry(scenario.id,{date:'2026-01-03',terms:{result:[result.id]},realisedR:10,accounts:[{accountId:id,pnlCash:5000,riskPct:null,pnlPct:null}]});
  }
  expect(listPersonalAccounts().accounts.find(a=>a.id===id)).toMatchObject({pnl:200,balance:1200,trades:1,tradeIds:[actual.id]});
  const next=createPersonalJournalEntry();
  const result=updatePersonalJournalEntry(next.id,{date:'2026-01-04',accounts:[{accountId:id,riskPct:1,pnlCash:null,pnlPct:null,editedField:'riskPct'}]}).accounts[0]!;
  expect(result.baseBalance).toBe(1200);
  expect(result.riskCash).toBe(12);
});
beforeAll(() => {
  directory = mkdtempSync(join(tmpdir(), "account-cards-test-"));
});
it("persists CFD leverage and rejects zero or fractional ratios",()=>{
  const account=createAccountDraft({requestId:randomUUID(),kind:"personal"});
  const profile={...defaultProfile(),market:"CFD" as const,openingBalance:1000,leverage:50};
  savePersonalAccount({id:account.id,name:"CFD leverage",profile,draft:true});
  expect(listPersonalAccounts().accounts.find(a=>a.id===account.id)?.profile?.leverage).toBe(50);
  for(const leverage of [0,-1,1.5])expect(()=>savePersonalAccount({id:account.id,name:"CFD leverage",profile:{...profile,leverage},draft:true})).toThrow();
});
it("creates each firm and account only once per request and allows incremental autosave", () => {
  const requestId = randomUUID();
  const firm = createFirmDraft({ requestId });
  expect(createFirmDraft({ requestId }).id).toBe(firm.id);
  const accountRequest = randomUUID();
  const account = createAccountDraft({ requestId: accountRequest, kind: "prop", firmId: firm.id });
  expect(createAccountDraft({ requestId: accountRequest, kind: "prop", firmId: firm.id }).id).toBe(
    account.id,
  );
  const row = listPersonalAccounts().accounts.find((a) => a.id === account.id)!;
  expect(row.profile?.firmId).toBe(firm.id);
  savePersonalAccount({
    id: account.id,
    name: "Draft edited",
    profile: { ...row.profile!, purchasePrice: 100 },
    draft: true,
  });
  expect(listPersonalJournal().terms.find((t) => t.id === account.id)?.name).toBe("Draft edited");
});
it("updates one payout, computes ROI after costs, deduplicates firm trades and recovers removals", () => {
  const firm = saveFirm({ name: "ROI firm" });
  const profile = {
    ...defaultProfile(),
    kind: "prop" as const,
    firmId: firm.id,
    stage: "Funded" as const,
    accountSize: 100000,
    openingBalance: 100000,
    drawdown: 10000,
    startDate: "2026-01-01",
    purchasePrice: 100,
  };
  const a = savePersonalAccount({ name: "ROI #1", profile }),
    b = savePersonalAccount({ name: "ROI #2", profile });
  const entry = createPersonalJournalEntry();
  updatePersonalJournalEntry(entry.id, {
    date: "2026-01-02",
    accounts: [
      { accountId: a.id, pnlCash: 1000, riskPct: null, pnlPct: null },
      { accountId: b.id, pnlCash: 1000, riskPct: null, pnlPct: null },
    ],
  });
  const id = randomUUID();
  addMovement({
    id,
    accountId: a.id,
    kind: "payout",
    date: "2026-01-03",
    amount: 0,
    received: 0,
    draft: true,
  });
  addMovement({
    id,
    accountId: a.id,
    kind: "payout",
    date: "2026-01-03",
    amount: 1000,
    received: 800,
  });
  addMovement({
    id,
    accountId: a.id,
    kind: "payout",
    date: "2026-01-03",
    amount: 1000,
    received: 800,
  });
  const expense = addMovement({
    accountId: a.id,
    kind: "expense",
    date: "2026-01-03",
    amount: 50,
    received: 50,
  });
  const data = listPersonalAccounts(),
    stats = data.firms.find((f) => f.id === firm.id)!;
  expect(stats.trades).toBe(1);
  expect(stats.cost).toBe(250);
  expect(stats.received).toBe(800);
  expect(stats.roi).toBeCloseTo(220);
  expect(data.accounts.find((x) => x.id === a.id)?.balance).toBe(100000);
  expect(
    data.accounts.find((x) => x.id === a.id)?.movements.filter((m) => m.kind === "payout"),
  ).toHaveLength(1);
  removeMovement({ id: expense.id });
  expect(listPersonalAccounts().firms.find((f) => f.id === firm.id)?.cost).toBe(200);
  removeMovement({ id: expense.id, restore: true });
  expect(listPersonalAccounts().firms.find((f) => f.id === firm.id)?.cost).toBe(250);
  updatePersonalJournalTerm(a.id, { archived: true });
  expect(listPersonalAccounts().firms.find((f) => f.id === firm.id)?.cost).toBe(250);
});
afterAll(() => {
  const state = globalThis as unknown as { __personalJournalSqlite?: Database.Database };
  state.__personalJournalSqlite?.close();
  delete state.__personalJournalSqlite;
  if (
    resolve(directory).startsWith(resolve(tmpdir()) + "\\") &&
    basename(directory).startsWith("account-cards-test-")
  )
    rmSync(directory, { recursive: true, force: true });
});
it("uses Journal account IDs and separates withdrawals from trading PnL", () => {
  const profile = { ...defaultProfile(), openingBalance: 1000, startDate: "2026-01-01" };
  const { id } = savePersonalAccount({ name: "Personal", profile });
  expect(listPersonalJournal().terms.some((t) => t.id === id && t.kind === "account")).toBe(true);
  const trade = createPersonalJournalEntry();
  updatePersonalJournalEntry(trade.id, {
    date: "2026-01-02",
    accounts: [{ accountId: id, pnlCash: 200, riskPct: null, pnlPct: null }],
  });
  addMovement({ accountId: id, kind: "deposit", date: "2026-01-03", amount: 100, received: 100 });
  addMovement({ accountId: id, kind: "withdrawal", date: "2026-01-04", amount: 50, received: 50 });
  const account = listPersonalAccounts().accounts.find((a) => a.id === id)!;
  expect(account.balance).toBe(1250);
  expect(account.pnl).toBe(200);
  expect(account.received).toBe(50);
  expect(() =>
    savePersonalAccount({ id, name: "Personal", profile: { ...profile, openingBalance: 2000 } }),
  ).toThrow();
  expect(listPersonalAccounts().accounts.find((a) => a.id === id)?.profile?.openingBalance).toBe(
    1000,
  );
  archivePersonalJournalEntry(trade.id);
  expect(listPersonalAccounts().accounts.find((a) => a.id === id)?.balance).toBe(1050);
});
it("supports multiple accounts per firm, retains phase history and gross/net payout", () => {
  const logo =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
  const firm = saveFirm({ name: "Firm", logo });
  const profile = {
    ...defaultProfile(),
    kind: "prop" as const,
    firmId: firm.id,
    accountSize: 100000,
    openingBalance: 100000,
    drawdown: 10000,
    drawdownType: "EOD Trailing" as const,
    phase1Target: 8000,
    phase2Target: 5000,
    startDate: "2026-01-01",
  };
  const first = savePersonalAccount({ name: "Firm #1", profile });
  savePersonalAccount({ name: "Firm #2", profile });
  expect(listPersonalAccounts().accounts.filter((a) => a.profile?.firmId === firm.id)).toHaveLength(
    2,
  );
  expect(listPersonalJournal().terms.find((t) => t.id === first.id)?.logo).toBe(logo);
  expect(() =>
    addMovement({
      accountId: first.id,
      kind: "payout",
      date: "2026-01-02",
      amount: 1000,
      received: 800,
    }),
  ).toThrow();
  savePersonalAccount({ id: first.id, name: "Firm #1", profile: { ...profile, stage: "Phase 2" } });
  savePersonalAccount({ id: first.id, name: "Firm #1", profile: { ...profile, stage: "Funded" } });
  addMovement({
    accountId: first.id,
    kind: "payout",
    date: "2026-01-02",
    amount: 1000,
    received: 800,
  });
  const account = listPersonalAccounts().accounts.find((a) => a.id === first.id)!;
  expect(account.balance).toBe(99000);
  expect(account.received).toBe(800);
  expect(account.pnl).toBe(0);
  expect(account.phases.map((p) => p.stage)).toEqual(["Phase 1", "Phase 2", "Funded"]);
  expect(() =>
    addMovement({
      accountId: first.id,
      kind: "payout",
      date: "2026-01-02",
      amount: 1000,
      received: 1200,
    }),
  ).toThrow();
});
it("rejects invalid settings and duplicate account creation", () => {
  expect(() =>
    savePersonalAccount({ name: "Bad", profile: { ...defaultProfile(), openingBalance: -1 } }),
  ).toThrow();
  expect(() =>
    savePersonalAccount({ name: "Bad", profile: { ...defaultProfile(), startDate: "2026-99-99" } }),
  ).toThrow();
  expect(() => savePersonalAccount({ name: "Personal", profile: defaultProfile() })).toThrow();
});
it("uses nominal prop capital and freezes the current personal balance excluding the same trade", () => {
  const firm = saveFirm({ name: "Money firm" });
  const prop = savePersonalAccount({
    name: "Money prop",
    profile: {
      ...defaultProfile(),
      kind: "prop",
      firmId: firm.id,
      accountSize: 50000,
      openingBalance: 49000,
      drawdown: 3000,
      startDate: "2026-01-01",
    },
  });
  const trade = createPersonalJournalEntry();
  const row = updatePersonalJournalEntry(trade.id, {
    date: "2026-01-04",
    accounts: [
      {
        accountId: prop.id,
        riskCash: 300,
        riskPct: null,
        pnlCash: null,
        pnlPct: null,
        editedField: "riskCash",
      },
    ],
  }).accounts[0]!;
  expect(row.riskPct).toBe(0.6);
  const personal = savePersonalAccount({
    name: "Money personal",
    profile: { ...defaultProfile(), openingBalance: 1000, startDate: "2026-01-01" },
  });
  const previous = createPersonalJournalEntry();
  updatePersonalJournalEntry(previous.id, {
    date: "2026-01-02",
    accounts: [{ accountId: personal.id, riskPct: null, pnlCash: 200, pnlPct: null }],
  });
  const current = createPersonalJournalEntry();
  updatePersonalJournalEntry(current.id, {
    date: "2026-01-03",
    accounts: [{ accountId: personal.id, riskPct: null, pnlCash: -100, pnlPct: null }],
  });
  const updated = updatePersonalJournalEntry(current.id, {
    accounts: [
      { accountId: personal.id, riskPct: 1, pnlCash: -100, pnlPct: null, editedField: "riskPct" },
    ],
  }).accounts[0]!;
  expect(updated.baseBalance).toBe(1200);
  expect(updated.riskCash).toBe(12);
  addMovement({
    accountId: personal.id,
    kind: "deposit",
    date: "2026-01-04",
    amount: 1000,
    received: 1000,
  });
  const updatedAgain = updatePersonalJournalEntry(current.id, {
    accounts: [{ ...updated, pnlCash: -300, editedField: "pnlCash" }],
  }).accounts[0]!;
  expect(updatedAgain.baseBalance).toBe(1200);
  expect(updatedAgain.pnlPct).toBe(-25);
});
