import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import type Database from "better-sqlite3";

let testDirectory = "";
vi.mock("@/db", () => ({ dataDir: () => testDirectory }));
import {
  archivePersonalJournalEntry,
  createPersonalJournalEntry,
  createPersonalJournalTerm,
  listPersonalJournal,
  restorePersonalJournalEntry,
  updatePersonalJournalEntry,
  updatePersonalJournalTerm,
  connection as journalConnection,
} from "../src/server/personal-journal";

beforeAll(() => {
  testDirectory = mkdtempSync(join(tmpdir(), "journal-storage-test-"));
});
it('uses each account market for fractional CFD lots and whole futures contracts on the same assets',()=>{
 const entry=createPersonalJournalEntry(),gc=createPersonalJournalTerm('instrument','GC'),gold=createPersonalJournalTerm('instrument','XAUUSD');
 const cfd=createPersonalJournalTerm('account','CFD volume regression'),future=createPersonalJournalTerm('account','Futures volume regression');
 const sql=journalConnection();sql.exec('CREATE TABLE IF NOT EXISTS personal_account_profiles(account_id TEXT PRIMARY KEY,profile_json TEXT NOT NULL)');
 sql.prepare('INSERT INTO personal_account_profiles(account_id,profile_json) VALUES (?,?)').run(cfd.id,JSON.stringify({market:'CFD'}));
 sql.prepare('INSERT INTO personal_account_profiles(account_id,profile_json) VALUES (?,?)').run(future.id,JSON.stringify({market:'Futures'}));
 updatePersonalJournalEntry(entry.id,{terms:{instrument:[gc.id,gold.id]}});
 const row=(accountId:string,quantity:number)=>({accountId,quantity,riskPct:null,pnlCash:null,pnlPct:null});
 const saved=updatePersonalJournalEntry(entry.id,{accounts:[row(cfd.id,.5),row(future.id,1)]});
 expect(saved.accounts.find(a=>a.accountId===cfd.id)).toMatchObject({quantity:.5,quantityUnit:'lots'});
 expect(saved.accounts.find(a=>a.accountId===future.id)).toMatchObject({quantity:1,quantityUnit:'contracts'});
 expect(()=>updatePersonalJournalEntry(entry.id,{accounts:[row(future.id,.5)]})).toThrow('контракты');
});

it("persists, replaces and removes account logos without changing relations", () => {
  const term = createPersonalJournalTerm("account", "Logo account");
  const logo =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
  expect(updatePersonalJournalTerm(term.id, { logo }).logo).toBe(logo);
  expect(listPersonalJournal().terms.find((item) => item.id === term.id)?.logo).toBe(logo);
  expect(() =>
    updatePersonalJournalTerm(term.id, { logo: "data:image/png;base64,YWJj" }),
  ).toThrow();
  expect(() => updatePersonalJournalTerm(term.id, { logo: "https://example.com/a.png" })).toThrow();
  const other = createPersonalJournalTerm("setup", "No logo setup");
  expect(() => updatePersonalJournalTerm(other.id, { logo })).toThrow();
  expect(updatePersonalJournalTerm(term.id, { logo: "" }).logo).toBe("");
});
afterAll(() => {
  const state = globalThis as unknown as { __personalJournalSqlite?: Database.Database };
  state.__personalJournalSqlite?.close();
  delete state.__personalJournalSqlite;
  if (
    resolve(testDirectory).startsWith(`${resolve(tmpdir())}\\`) &&
    basename(testDirectory).startsWith("journal-storage-test-")
  )
    rmSync(testDirectory, { recursive: true, force: true });
});

it("renames and archives Type values while preserving trade links and descriptions", () => {
  const entry = createPersonalJournalEntry();
  const term = createPersonalJournalTerm("type", "Catalog test");
  updatePersonalJournalEntry(entry.id, { terms: { type: [term.id] } });
  const renamed = updatePersonalJournalTerm(term.id, {
    name: "Renamed type",
    description: "Rules",
  });
  expect(renamed.name).toBe("Renamed type");
  expect(createPersonalJournalTerm("type", "RENAMED TYPE").id).toBe(term.id);
  updatePersonalJournalTerm(term.id, { archived: true });
  const data = listPersonalJournal();
  expect(data.terms.find((item) => item.id === term.id)?.archived).toBe(true);
  expect(data.entries.find((item) => item.id === entry.id)?.terms.type).toContain(term.id);
  const restored = createPersonalJournalTerm("type", "Renamed type");
  expect(restored.id).toBe(term.id);
  expect(restored.archived).toBe(false);
  expect(restored.description).toBe("Rules");
});

it("moves a trade to trash and restores its notes, relations and per-account results", () => {
  const entry = createPersonalJournalEntry();
  const type = createPersonalJournalTerm("type", "Test type");
  const account = createPersonalJournalTerm("account", "Test account");
  const updated = updatePersonalJournalEntry(entry.id, {
    quickNote: "Preserve",
    bodyText: "Review",
    terms: { type: [type.id] },
    accounts: [{ accountId: account.id, riskPct: 1, pnlCash: 250, pnlPct: 0.5 }],
  });
  archivePersonalJournalEntry(entry.id);
  expect(listPersonalJournal().entries.some((item) => item.id === entry.id)).toBe(false);
  expect(listPersonalJournal().trashed.find((item) => item.id === entry.id)).toEqual(updated);
  restorePersonalJournalEntry(entry.id);
  expect(listPersonalJournal().entries.find((item) => item.id === entry.id)).toEqual(updated);
  expect(listPersonalJournal().trashed.some((item) => item.id === entry.id)).toBe(false);
  expect(createPersonalJournalEntry().tradeNo).toBe(entry.tradeNo + 1);
});

it("keeps new entries at the bottom even when their trade date is earlier", () => {
  const entry = createPersonalJournalEntry();
  updatePersonalJournalEntry(entry.id, { date: "2020-01-01" });
  const list = listPersonalJournal().entries;
  expect(list[list.length - 1]?.id).toBe(entry.id);
  expect(list.map((item) => item.tradeNo)).toEqual(
    list.map((item) => item.tradeNo).sort((a, b) => a - b),
  );
});

it("renumbers active trades after deletion and restoration without changing identities",()=>{
  const a=createPersonalJournalEntry(),b=createPersonalJournalEntry(),c=createPersonalJournalEntry();
  archivePersonalJournalEntry(b.id);
  const active=listPersonalJournal().entries;
  expect(active.map(e=>e.tradeNo)).toEqual(active.map((_,i)=>i+1));
  expect(active.find(e=>e.id===c.id)?.tradeNo).toBe(c.tradeNo-1);
  const restored=restorePersonalJournalEntry(b.id);
  expect(restored.id).toBe(b.id);
  expect(listPersonalJournal().entries.find(e=>e.id===c.id)?.tradeNo).toBe(c.tradeNo);
  for(const e of listPersonalJournal().entries)archivePersonalJournalEntry(e.id);
  expect(createPersonalJournalEntry().tradeNo).toBe(1);
});

it("preserves text and inline image order through saving and restoration", () => {
  const entry = createPersonalJournalEntry();
  const state = globalThis as unknown as { __personalJournalSqlite: Database.Database };
  state.__personalJournalSqlite.exec(
    "CREATE TABLE IF NOT EXISTS attachments(id TEXT PRIMARY KEY,owner_type TEXT,owner_id TEXT,mime TEXT)",
  );
  state.__personalJournalSqlite
    .prepare(
      "INSERT INTO attachments(id,owner_type,owner_id,mime) VALUES (?,'personal-journal',?,'image/png')",
    )
    .run("inline-test-image", entry.id);
  const blocks = [
    { id: "before", kind: "text", text: "Before" },
    { id: "image", kind: "image", attachmentId: "inline-test-image", name: "test.png" },
    { id: "after", kind: "text", text: "After" },
  ];
  const saved = updatePersonalJournalEntry(entry.id, { bodyBlocks: blocks });
  expect(saved.bodyBlocks).toEqual(blocks);
  expect(saved.bodyText).toBe("Before\nAfter");
  archivePersonalJournalEntry(entry.id);
  expect(restorePersonalJournalEntry(entry.id).bodyBlocks).toEqual(blocks);
});
it("stores position size separately per account and rejects fractional futures contracts",()=>{
  const entry=createPersonalJournalEntry();
  const a=createPersonalJournalTerm("account","Volume A"),b=createPersonalJournalTerm("account","Volume B");
  const gc=createPersonalJournalTerm("instrument","GC"),gold=createPersonalJournalTerm("instrument","XAUUSD");
  updatePersonalJournalEntry(entry.id,{terms:{instrument:[gc.id]}});
  const row=(accountId:string,quantity:number)=>({accountId,quantity,riskPct:null,pnlCash:null,pnlPct:null});
  const saved=updatePersonalJournalEntry(entry.id,{accounts:[row(a.id,1),row(b.id,3)]});
  expect(saved.accounts.find(row=>row.accountId===a.id)).toMatchObject({quantity:1,quantityUnit:"contracts"});
  expect(saved.accounts.find(row=>row.accountId===b.id)).toMatchObject({quantity:3,quantityUnit:"contracts"});
  expect(()=>updatePersonalJournalEntry(entry.id,{accounts:[row(a.id,0.1)]})).toThrow();
  expect(listPersonalJournal().entries.find(e=>e.id===entry.id)?.accounts).toEqual(expect.arrayContaining(saved.accounts));
  expect(updatePersonalJournalEntry(entry.id,{terms:{instrument:[gold.id]}}).accounts.every(a=>a.quantity===undefined)).toBe(true);
  expect(updatePersonalJournalEntry(entry.id,{accounts:[row(a.id,0.15)]}).accounts[0]).toMatchObject({quantity:0.15,quantityUnit:"lots"});
});
it("persists classifications without changing RR and clears incompatible details on result changes",()=>{
  const entry=createPersonalJournalEntry();
  const be=createPersonalJournalTerm("result","BE"),loss=createPersonalJournalTerm("result","Loss");
  expect(be.name).toBe("Breakeven");
  updatePersonalJournalEntry(entry.id,{terms:{result:[be.id]},realisedR:0});
  const classified=updatePersonalJournalEntry(entry.id,{classification:{detail:"be-target",tags:["FOMO"]}});
  expect(classified.classification).toEqual({detail:"be-target",tags:["FOMO"]});expect(classified.realisedR).toBe(0);
  const changed=updatePersonalJournalEntry(entry.id,{terms:{result:[loss.id]}});
  expect(changed.classification).toEqual({detail:"",tags:["FOMO"]});
  expect(()=>updatePersonalJournalEntry(entry.id,{classification:{detail:"be-target"}})).toThrow();
  archivePersonalJournalEntry(entry.id);expect(restorePersonalJournalEntry(entry.id).classification).toEqual(changed.classification);
});
it('preserves manual numbers through deletion and restoration without changing identity',()=>{
  const entry=createPersonalJournalEntry();
  expect(updatePersonalJournalEntry(entry.id,{tradeNo:42})).toMatchObject({id:entry.id,tradeNo:42});
  expect(listPersonalJournal().entries.find(e=>e.id===entry.id)?.tradeNo).toBe(42);
  archivePersonalJournalEntry(entry.id);expect(restorePersonalJournalEntry(entry.id).tradeNo).toBe(42);
  expect(()=>updatePersonalJournalEntry(entry.id,{tradeNo:0})).toThrow();
  expect(()=>updatePersonalJournalEntry(entry.id,{tradeNo:1.5})).toThrow();
  expect(updatePersonalJournalEntry(entry.id,{tradeNo:null}).tradeNo).not.toBe(42);
});
it('keeps two trades with the same manual number and independent content',()=>{
  const a=createPersonalJournalEntry(),b=createPersonalJournalEntry();
  updatePersonalJournalEntry(a.id,{tradeNo:5,date:'2026-10-07',bodyTitle:'First duplicate',bodyText:'Keep A'});
  updatePersonalJournalEntry(b.id,{tradeNo:5,bodyTitle:'Second duplicate',bodyText:'Keep B'});
  const rows=listPersonalJournal().entries;
  expect(rows.find(e=>e.id===a.id)).toMatchObject({tradeNo:5,date:'2026-10-07',bodyText:'Keep A'});
  expect(rows.find(e=>e.id===b.id)).toMatchObject({tradeNo:5,bodyText:'Keep B'});
});
it('preserves optional potential separately from actual results through trash and restore',()=>{
  const e=createPersonalJournalEntry(),account=createPersonalJournalTerm('account','Potential test');
  updatePersonalJournalEntry(e.id,{realisedR:1,accounts:[{accountId:account.id,riskCash:100,pnlCash:100,pnlPct:null,riskPct:null}]});
  const potential={enabled:true,rr:3,ticks:150,basis:'planned',comment:'Original TP',accountCash:{[account.id]:280}};
  const saved=updatePersonalJournalEntry(e.id,{potential});
  expect(saved.potential).toEqual(potential);expect(saved.realisedR).toBe(1);expect(saved.accounts[0]?.pnlCash).toBe(100);
  archivePersonalJournalEntry(e.id);expect(restorePersonalJournalEntry(e.id).potential).toEqual(potential);
  expect(()=>updatePersonalJournalEntry(e.id,{potential:{...potential,accountCash:{missing:300}}})).toThrow();
  expect(listPersonalJournal().entries.find(row=>row.id===e.id)?.potential).toEqual(potential);
  updatePersonalJournalEntry(e.id,{accounts:[]});
  expect(updatePersonalJournalEntry(e.id,{potential:{...potential,comment:'Keep detached account history'}}).potential?.accountCash).toEqual(potential.accountCash);
});
it('persists Missed reasons and clears them when switching to an executed result',()=>{
  const entry=createPersonalJournalEntry();
  const missed=createPersonalJournalTerm('result','Missed'),win=createPersonalJournalTerm('result','Win');
  updatePersonalJournalEntry(entry.id,{terms:{result:[missed.id]},realisedR:3});
  for(const detail of ['missed-fear','missed-conflict','missed-overlooked']) {
    expect(updatePersonalJournalEntry(entry.id,{classification:{detail,tags:[]}}).classification?.detail).toBe(detail);
    expect(listPersonalJournal().entries.find(e=>e.id===entry.id)?.classification?.detail).toBe(detail);
  }
  archivePersonalJournalEntry(entry.id);
  expect(restorePersonalJournalEntry(entry.id).classification?.detail).toBe('missed-overlooked');
  expect(updatePersonalJournalEntry(entry.id,{terms:{result:[win.id]}}).classification?.detail).toBe('');
  expect(()=>updatePersonalJournalEntry(entry.id,{classification:{detail:'missed-fear'}})).toThrow();
});
it('assigns automatic numbers within each series while preserving manual labels and identity',()=>{
 const hyp=createPersonalJournalTerm('result','Hypothesis'),unknown=createPersonalJournalTerm('result','НЛО');
 const a=createPersonalJournalEntry(),b=createPersonalJournalEntry(),c=createPersonalJournalEntry();
 const first=updatePersonalJournalEntry(a.id,{terms:{result:[hyp.id]}});
 const second=updatePersonalJournalEntry(b.id,{terms:{result:[hyp.id]}});
 expect(first.numberSeries).toBe('hypothesis');expect(second.tradeNo).toBe(first.tradeNo+1);
 expect(updatePersonalJournalEntry(c.id,{terms:{result:[unknown.id]}})).toMatchObject({id:c.id,tradeNo:1,numberSeries:'unidentified'});
 expect(updatePersonalJournalEntry(b.id,{tradeNo:1})).toMatchObject({id:b.id,tradeNo:1,numberSeries:'hypothesis'});
 expect(listPersonalJournal().entries.find(e=>e.id===c.id)?.tradeNo).toBe(1);
});
it('stores explicit target-hit assessments without changing actual RR',()=>{
 const entry=createPersonalJournalEntry();
 updatePersonalJournalEntry(entry.id,{realisedR:1,classification:{targetHit:true}});
 expect(listPersonalJournal().entries.find(e=>e.id===entry.id)).toMatchObject({realisedR:1,classification:{targetHit:true}});
 expect(updatePersonalJournalEntry(entry.id,{classification:{targetHit:false}}).classification?.targetHit).toBe(false);
 expect(()=>updatePersonalJournalEntry(entry.id,{classification:{targetHit:'yes'}})).toThrow();
});

it('persists a shared RR basis, calculates ticks automatically and locks explicit RR to manual',()=>{
 const created=createPersonalJournalEntry();expect(created.rrBasis).toEqual({mode:'standard',ticks:50});
 const standard=updatePersonalJournalEntry(created.id,{riskTicks:20,realisedTicks:100});expect(standard.realisedR).toBe(2);expect(standard.riskTicks).toBe(20);
 expect(updatePersonalJournalEntry(created.id,{rrBasis:{mode:'stop',ticks:50}}).realisedR).toBe(5);
 const manual=updatePersonalJournalEntry(created.id,{realisedR:2});expect(manual.rrBasis?.mode).toBe('manual');
 expect(updatePersonalJournalEntry(created.id,{realisedTicks:120}).realisedR).toBe(2);
 expect(listPersonalJournal().entries.find(e=>e.id===created.id)?.rrBasis?.mode).toBe('manual');
 expect(updatePersonalJournalEntry(created.id,{rrBasis:{mode:'standard',ticks:50}}).realisedR).toBe(2.4);
 expect(updatePersonalJournalEntry(created.id,{realisedTicks:-20}).realisedR).toBe(-.4);
 for(const ticks of [0,-1,Infinity,'50'])expect(()=>updatePersonalJournalEntry(created.id,{rrBasis:{mode:'standard',ticks}})).toThrow();
 expect(()=>updatePersonalJournalEntry(created.id,{rrBasis:{mode:'unknown',ticks:50}})).toThrow();
 archivePersonalJournalEntry(created.id);expect(restorePersonalJournalEntry(created.id).rrBasis).toEqual({mode:'standard',ticks:50});
});
it('keeps unconfigured historical entries and manual RR untouched on unrelated edits',()=>{
 const e=createPersonalJournalEntry();journalConnection().prepare('UPDATE personal_journal_entries SET rr_basis_json=NULL,risk_ticks=20,realised_ticks=100,realised_r=2 WHERE id=?').run(e.id);
 const saved=updatePersonalJournalEntry(e.id,{quickNote:'Keep history'});expect(saved.realisedR).toBe(2);expect(saved.rrBasis).toBeUndefined();
});
