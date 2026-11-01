import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, basename } from "node:path";
let directory = "";
vi.mock("@/db", () => ({ dataDir: () => directory }));
import {
  listWorkflow,
  syncWorkflow,
  moveWorkflow,
  createWorkflow,
  updateWorkflowCard,
  duplicateWorkflow,
  archiveWorkflow,
  changeWorkflowCategory,
} from "../src/server/workflow";
import { reviewConnection } from "../src/server/trading-review";
import { workflowCommands } from "../src/lib/workflow";
import {WORKFLOW_CATEGORIES,WORKFLOW_LABELS} from '../src/lib/workflow';
beforeAll(() => {
  directory = mkdtempSync(join(tmpdir(), "workflow-test-"));
});
afterAll(() => {
  if (
    resolve(directory).startsWith(resolve(tmpdir()) + "\\") &&
    basename(directory).startsWith("workflow-test-")
  )
    rmSync(directory, { recursive: true, force: true });
});
const source = {
  source: "review:2026-10-09:plan",
  url: "/journal?review=day&date=2026-10-09",
  label: "План",
};
it('edits linked and detached titles without changing the source and preserves edits after source synchronization',()=>{
 const input={source:'review:editable-law',url:'/journal?review=day&date=2026-10-16',label:'Итоги',text:'/закон Original rule'};
 syncWorkflow(input);const original=listWorkflow().find(c=>c.source===input.source)!;
 updateWorkflowCard({id:original.id,text:'Edited rule',blocks:[{id:'detail',kind:'text',text:'Explanation'}]});
 syncWorkflow(input);
 expect(listWorkflow().find(c=>c.id===original.id)).toMatchObject({text:'Edited rule',detached:false});
 syncWorkflow({...input,text:''});
 updateWorkflowCard({id:original.id,text:'Detached edit',blocks:[]});
 expect(listWorkflow().find(c=>c.id===original.id)).toMatchObject({text:'Detached edit',detached:true,source:input.source});
 const db=reviewConnection();try{expect(db.prepare('SELECT text FROM personal_workflow_cards WHERE id=?').get(original.id)).toEqual({text:'Original rule'});}finally{db.close();}
 const copy=duplicateWorkflow(original.id);expect(listWorkflow().find(c=>c.id===copy.id)?.text).toBe('Detached edit');
 archiveWorkflow(original.id);archiveWorkflow(copy.id);
});
it('tracks real status transitions independently of source edits, category changes and repeated status saves',()=>{
 const manual=createWorkflow({text:'Timing',category:'задача',status:'inbox'});
 let card=listWorkflow().find(c=>c.id===manual.id)!;
 expect(card.status_changed_at).toBeTruthy();const created=card.created_at;
 const db=reviewConnection();try{db.prepare('UPDATE personal_workflow_cards SET status_changed_at=? WHERE id=?').run('2026-10-01T10:00:00.000Z',manual.id);}finally{db.close();}
 moveWorkflow(manual.id,'inbox');changeWorkflowCategory(manual.id,'закон');updateWorkflowCard({id:manual.id,text:'Timing edited',blocks:[]});
 card=listWorkflow().find(c=>c.id===manual.id)!;expect(card.status_changed_at).toBe('2026-10-01T10:00:00.000Z');expect(card.created_at).toBe(created);
 moveWorkflow(manual.id,'doing');card=listWorkflow().find(c=>c.id===manual.id)!;expect(card.status_changed_at).not.toBe('2026-10-01T10:00:00.000Z');expect(card.created_at).toBe(created);
 const copy=duplicateWorkflow(manual.id);expect(listWorkflow().find(c=>c.id===copy.id)?.status_changed_at).toBeTruthy();
 archiveWorkflow(manual.id);archiveWorkflow(copy.id);
});
it('keeps an unknown legacy status date unknown until a real transition',()=>{
 const record=createWorkflow({text:'Legacy',category:'идея',status:'doing'});
 const db=reviewConnection();try{db.prepare('UPDATE personal_workflow_cards SET status_changed_at=NULL WHERE id=?').run(record.id);}finally{db.close();}
 moveWorkflow(record.id,'doing');expect(listWorkflow().find(c=>c.id===record.id)?.status_changed_at).toBeNull();
 moveWorkflow(record.id,'done');expect(listWorkflow().find(c=>c.id===record.id)?.status_changed_at).toBeTruthy();
 archiveWorkflow(record.id);
});
it('supports Laws in slash commands, source sync and category changes',()=>{
 expect(WORKFLOW_CATEGORIES).toContain('закон');expect(WORKFLOW_LABELS.закон).toBe('Законы');
 const input={source:'review:laws-test',url:'/journal?review=day&date=2026-10-16',label:'Plan',text:'/закон Не входить без подтверждения'};
 expect(workflowCommands(input.text)[0]).toMatchObject({category:'закон',text:'Не входить без подтверждения'});
 syncWorkflow(input);const card=listWorkflow().find(c=>c.source===input.source)!;
 expect(card.category).toBe('закон');
 const manual=createWorkflow({text:'Rule',category:'идея',status:'inbox'});
 changeWorkflowCategory(manual.id,'закон');expect(listWorkflow().find(c=>c.id===manual.id)?.category).toBe('закон');
 archiveWorkflow(card.id);archiveWorkflow(manual.id);
});
it("creates an empty title without saving placeholder text",()=>{
  const {id}=createWorkflow({text:'',category:'задача',status:'inbox'});
  expect(listWorkflow().find(c=>c.id===id)?.text).toBe('');
  updateWorkflowCard({id,text:'My title',blocks:[]});
  expect(listWorkflow().find(c=>c.id===id)?.text).toBe('My title');
  updateWorkflowCard({id,text:'',blocks:[]});
  expect(listWorkflow().find(c=>c.id===id)?.text).toBe('');
  archiveWorkflow(id);
});
it("duplicates a card independently and supports deletion with restore",()=>{
  const original=createWorkflow({text:'Original',category:'задача',status:'doing'});
  updateWorkflowCard({id:original.id,blocks:[{id:'text-original',kind:'text',text:'Details'}]});
  const copy=duplicateWorkflow(original.id);
  expect(listWorkflow().find(c=>c.id===copy.id)).toMatchObject({text:'Original',status:'doing',source:`manual:${copy.id}`,blocks:[{kind:'text',text:'Details'}]});
  archiveWorkflow(copy.id);
  expect(listWorkflow().some(c=>c.id===copy.id)).toBe(false);
  archiveWorkflow(copy.id,true);
  expect(listWorkflow().some(c=>c.id===copy.id)).toBe(true);
  // Avoid affecting later tests' card counts.
  archiveWorkflow(copy.id);archiveWorkflow(original.id);
});
it("parses Russian commands mid-text and custom categories but not URL slashes", () => {
  expect(
    workflowCommands(
      "Увидел пробой /идея Проверить VAH\n/задача Сделать бэктест\nhttps://example.com/test",
    ),
  ).toEqual([
    { slot: 0, category: "идея", text: "Проверить VAH" },
    { slot: 1, category: "задача", text: "Сделать бэктест" },
  ]);
  expect(workflowCommands("/исследование ATR")).toHaveLength(1);
  expect(workflowCommands("/идея ")).toEqual([]);
  expect(workflowCommands("/идея Первая строка\n\tВторая строка\nОбычный текст\n/вопрос Почему?")).toEqual([
    {slot:0,category:"идея",text:"Первая строка\nВторая строка"},
    {slot:1,category:"вопрос",text:"Почему?"},
  ]);
});
it("upserts once, updates source text and preserves board status", () => {
  syncWorkflow({ ...source, text: "/идея Проверить VAH" });
  const first = listWorkflow()[0]!;
  moveWorkflow(first.id, "doing");
  syncWorkflow({ ...source, text: "/идея Проверить VAH со стопом 50" });
  syncWorkflow({ ...source, text: "/идея Проверить VAH со стопом 50" });
  expect(listWorkflow()).toHaveLength(1);
  expect(listWorkflow()[0]).toMatchObject({
    id: first.id,
    status: "doing",
    text: "Проверить VAH со стопом 50",
    detached: false,
  });
});
it("retains identities on insertion and removal without deleting cards", () => {
  const old = listWorkflow()[0]!;
  syncWorkflow({ ...source, text: "/задача Новая задача\n/идея Проверить VAH со стопом 50" });
  expect(listWorkflow().find((card) => card.id === old.id)).toMatchObject({
    slot: 1,
    status: "doing",
  });
  syncWorkflow({ ...source, text: "/идея Проверить VAH со стопом 50" });
  expect(listWorkflow().find((card) => card.id === old.id)).toMatchObject({
    slot: 0,
    detached: false,
    status: "doing",
  });
  expect(listWorkflow().find((card) => card.category === "задача")?.detached).toBe(true);
});
it("rejects external backlinks and invalid states", () => {
  expect(() => syncWorkflow({ ...source, url: "https://evil.test", text: "/идея x" })).toThrow();
  expect(() => moveWorkflow("missing", "done")).toThrow();
  expect(() => moveWorkflow(listWorkflow()[0]!.id, "invalid")).toThrow();
});
it("saves detail blocks and verifies screenshot ownership", () => {
  const { id } = createWorkflow({ text: "Карточка", category: "идея", status: "doing" });
  const db = reviewConnection();
  try {
    db.exec("CREATE TABLE attachments(id TEXT PRIMARY KEY,owner_type TEXT,owner_id TEXT)");
    db.prepare("INSERT INTO attachments VALUES (?,?,?)").run("image-own", "workflow", id);
  } finally {
    db.close();
  }
  const blocks = [
    { id: "a", kind: "text", text: "Мысли" },
    { id: "b", kind: "image", attachmentId: "image-own", name: "chart.png" },
  ];
  updateWorkflowCard({ id, text: "Новый заголовок", blocks });
  expect(listWorkflow().find((card) => card.id === id)).toMatchObject({
    text: "Новый заголовок",
    status: "doing",
    blocks,
  });
  expect(() =>
    updateWorkflowCard({ id, blocks: [{ id: "b", kind: "image", attachmentId: "other" }] }),
  ).toThrow();
  const linked = listWorkflow().find((card) => !card.source.startsWith("manual:"))!;
  expect(() =>
    updateWorkflowCard({ id: linked.id, text: "Перезаписать источник", blocks: [] }),
  ).not.toThrow();
});
it("creates standalone cards in each column and rejects empty content", () => {
  for (const status of ["inbox", "doing", "done"]) {
    const { id } = createWorkflow({ text: `Test ${status}`, category: "задача", status });
    expect(listWorkflow().find((card) => card.id === id)).toMatchObject({
      status,
      text: `Test ${status}`,
      source: `manual:${id}`,
    });
  }
  expect(() => createWorkflow({ text: " ", category: "задача", status: "inbox" })).toThrow();
});
it("links source screenshots and preserves identity on category changes", () => {
  const db = reviewConnection();
  try {
    db.exec("ALTER TABLE attachments ADD COLUMN name TEXT; ALTER TABLE attachments ADD COLUMN mime TEXT");
    db.prepare("INSERT INTO attachments(id,owner_type,owner_id,name,mime) VALUES(?,?,?,?,?)").run("source-image", "personal-journal", "qa-owner", "chart.png", "image/png");
  } finally { db.close(); }
  const input = { source: "journal-body:qa-owner:block", url: "/trades?entry=qa-owner", label: "Journal", text: "/идея Check\n\t[[image:source-image]]" };
  syncWorkflow(input);
  const card = listWorkflow().find(c => c.source === input.source)!;
  expect(card.sourceImages).toEqual([{id:"source-image",name:"chart.png"}]);
  expect(card.text).toBe("Check");
  syncWorkflow({...input,text:"/мысль Changed\n\t[[image:source-image]]"});
  expect(listWorkflow().find(c => c.source === input.source)?.id).toBe(card.id);
  syncWorkflow({...input,source:"journal-body:other-owner:block"});
  expect(listWorkflow().find(c => c.source === "journal-body:other-owner:block")?.sourceImages).toEqual([]);
});
it("keeps archived demo commands hidden on repeated synchronization", () => {
  const input = { ...source, source:"qa:archived", text:"/идея Demo" };
  syncWorkflow(input);
  const card = listWorkflow().find(c => c.source === input.source)!;
  const db = reviewConnection();
  try { db.prepare("UPDATE personal_workflow_cards SET deleted_at=? WHERE id=?").run(new Date().toISOString(),card.id); } finally { db.close(); }
  syncWorkflow(input);
  expect(listWorkflow().some(c => c.id === card.id)).toBe(false);
  syncWorkflow({...input,text:"/идея Real new note"});
  expect(listWorkflow().find(c => c.source === input.source)?.text).toBe("Real new note");
});
it("copies source screenshots into independently owned duplicate attachments",()=>{
  const db=reviewConnection();
  try {db.exec('ALTER TABLE attachments ADD COLUMN size INTEGER; ALTER TABLE attachments ADD COLUMN data BLOB; ALTER TABLE attachments ADD COLUMN created_at TEXT');db.prepare('UPDATE attachments SET size=3,data=?,created_at=? WHERE id=?').run(Buffer.from([1,2,3]),new Date().toISOString(),'source-image');}finally{db.close();}
  const original=listWorkflow().find(c=>c.source==='journal-body:qa-owner:block')!;
  const copied=duplicateWorkflow(original.id);
  const card=listWorkflow().find(c=>c.id===copied.id)!;
  const image=card.blocks.find((b:{kind:string})=>b.kind==='image')!;
  expect(image.kind).toBe('image');
  if(image.kind!=='image')throw new Error('Missing image');
  expect(image.attachmentId).not.toBe('source-image');
  updateWorkflowCard({id:card.id,blocks:card.blocks,text:'Independent'});
  const check=reviewConnection();
  try{expect(check.prepare('SELECT owner_id,data FROM attachments WHERE id=?').get(image.attachmentId)).toEqual({owner_id:copied.id,data:Buffer.from([1,2,3])});}finally{check.close();}
  archiveWorkflow(original.id);
  expect(listWorkflow().find(c=>c.id===copied.id)?.text).toBe('Independent');
});
it('retains a manually chosen category when a linked source synchronizes',()=>{
  const input={source:'journal-body:category-owner:block',url:'/trades?entry=category-owner',label:'Journal',text:'/идея Original'};
  syncWorkflow(input);
  const card=listWorkflow().find(c=>c.source===input.source)!;
  moveWorkflow(card.id,'doing');
  updateWorkflowCard({id:card.id,blocks:[{id:'own-text',kind:'text',text:'Keep notes'}]});
  changeWorkflowCategory(card.id,'задача');
  syncWorkflow({...input,text:'/идея Updated source'});
  expect(listWorkflow().find(c=>c.id===card.id)).toMatchObject({category:'задача',status:'doing',source:input.source,text:'Updated source',blocks:[{id:'own-text',kind:'text',text:'Keep notes'}]});
  const copy=duplicateWorkflow(card.id);
  expect(listWorkflow().find(c=>c.id===copy.id)?.category).toBe('задача');
  expect(()=>changeWorkflowCategory(card.id,'bad category!')).toThrow();
});
it('recovers legacy review sources without losing card identity, status or notes',()=>{
 const prefix='review:day:2026-10-16:postText';
 const old=createWorkflow({text:'Rule',category:'закон',status:'doing'});
 const db=reviewConnection();try{db.prepare('UPDATE personal_workflow_cards SET source=?,label=? WHERE id=?').run(prefix+':Old body','Wrong body label',old.id);}finally{db.close();}
 updateWorkflowCard({id:old.id,blocks:[{id:'notes',kind:'text',text:'Keep my notes'}]});
 syncWorkflow({source:prefix+':'+ 'x'.repeat(2000),url:'/journal?review=day&date=2026-10-16',label:'Old body',text:'/закон Rule'});
 expect(listWorkflow().find(c=>c.id===old.id)).toMatchObject({source:prefix,status:'doing',detached:false,blocks:[{id:'notes',kind:'text',text:'Keep my notes'}]});
 expect(listWorkflow().filter(c=>c.source===prefix&&!c.detached)).toHaveLength(1);
});
