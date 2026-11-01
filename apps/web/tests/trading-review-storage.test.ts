import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
let testDirectory = "";
vi.mock("@/db", () => ({ dataDir: () => testDirectory }));
import {
  listReviews,
  saveReview,
  validReviewKey,
  reviewConnection,
  hasReviewAttachmentOwner,
} from "../src/server/trading-review";
import {
  createSessionEntry,
  listSessionEntries,
  updateSessionEntry,
  archiveSessionEntry,
} from "../src/server/session-entries";
beforeAll(() => {
  testDirectory = mkdtempSync(join(tmpdir(), "review-storage-test-"));
});
it('allows review attachment owners only for existing review text fields',()=>{
  expect(hasReviewAttachmentOwner('review:day:2026-10-20:preText')).toBe(false);
  saveReview({key:'2026-10-20',kind:'day',preText:'Keep plan'});
  expect(hasReviewAttachmentOwner('review:day:2026-10-20:preText')).toBe(true);
  expect(hasReviewAttachmentOwner('review:day:2026-10-20:mindsetText')).toBe(true);
  expect(hasReviewAttachmentOwner('review:day:2026-10-20:vpShape')).toBe(false);
  expect(hasReviewAttachmentOwner('review:week:2026-10-20:preText')).toBe(false);
});
it("keeps Daily and PRE Session VP independent and allows clearing them", () => {
  saveReview({key:"2026-10-14",kind:"day",vpOpen:["Near POC"],vpShape:["P"],preSessionVpOpen:["Near VAL"],preSessionVpShape:["b"]});
  saveReview({key:"2026-10-14",kind:"day",preSessionVpOpen:[],preSessionVpShape:["D"]});
  expect(listReviews().find(r=>r.key==="2026-10-14")).toMatchObject({vpOpen:["Near POC"],vpShape:["P"],preSessionVpOpen:[],preSessionVpShape:["D"]});
  expect(()=>saveReview({key:"2026-10-14",kind:"day",preSessionVpShape:["invalid"]})).toThrow();
});
it('archives and restores a live note without losing its text or timestamp',()=>{
  const note=createSessionEntry('2026-10-13');
  updateSessionEntry(note.id,[{id:'qa-text',kind:'text',text:'Keep this'}]);
  archiveSessionEntry(note.id);
  expect(listSessionEntries('2026-10-13').some(n=>n.id===note.id)).toBe(false);
  archiveSessionEntry(note.id,true);
  expect(listSessionEntries('2026-10-13').find(n=>n.id===note.id)).toMatchObject({createdAt:note.createdAt,blocks:[{id:'qa-text',kind:'text',text:'Keep this'}]});
});
it('keeps weekly notes separate from daily sessions and preserves them through restore',()=>{
 const key='2026-10-19',daily=createSessionEntry(key),weekly=createSessionEntry(key,'week');
 updateSessionEntry(weekly.id,[{id:'weekly-text',kind:'text',text:'/закон Weekly law'}]);
 expect(listSessionEntries(key).map(e=>e.id)).toContain(daily.id);
 expect(listSessionEntries(key).map(e=>e.id)).not.toContain(weekly.id);
 expect(listSessionEntries(key,'week')).toEqual([expect.objectContaining({id:weekly.id,kind:'week',dayKey:key,blocks:[{id:'weekly-text',kind:'text',text:'/закон Weekly law'}]})]);
 archiveSessionEntry(weekly.id);expect(listSessionEntries(key,'week')).toEqual([]);
 archiveSessionEntry(weekly.id,true);expect(listSessionEntries(key,'week')[0]?.createdAt).toBe(weekly.createdAt);
 expect(()=>createSessionEntry('2026-10-20','week')).toThrow();
 expect(()=>listSessionEntries(key,'invalid' as 'week')).toThrow();
});
afterAll(() => {
  if (
    resolve(testDirectory).startsWith(`${resolve(tmpdir())}\\`) &&
    basename(testDirectory).startsWith("review-storage-test-")
  )
    rmSync(testDirectory, { recursive: true, force: true });
});
it("persists drafts, merges field updates and keeps day and weekly reports independent", () => {
  saveReview({ key: "2026-10-05", kind: "day", preText: "Plan" });
  saveReview({ key: "2026-10-05", kind: "day", postText: "Review" });
  saveReview({ key: "2026-10-05", kind: "week", postText: "Weekly" });
  expect(listReviews().find((review) => review.kind === "day" && review.key === "2026-10-05")).toMatchObject({
    preText: "Plan",
    postText: "Review",
    complete: false,
  });
  expect(listReviews().find((review) => review.kind === "week")?.postText).toBe("Weekly");
});
it("persists a manual day status without changing automatic metrics", () => {
  saveReview({key:'2026-10-15',kind:'day',dayStatus:'Missed'});
  expect(listReviews().find(r=>r.key==='2026-10-15')?.dayStatus).toBe('Missed');
  saveReview({ key: "2026-10-09", kind: "day", dayStatus: "Win Day" });
  expect(listReviews().find((review) => review.key === "2026-10-09")?.dayStatus).toBe("Win Day");
  saveReview({ key: "2026-10-09", kind: "day", postText: "Note" });
  expect(listReviews().find((review) => review.key === "2026-10-09")?.dayStatus).toBe("Win Day");
  expect(() => saveReview({ key: "2026-10-09", kind: "day", dayStatus: "bad" })).toThrow();
  saveReview({ key: "2026-10-09", kind: "day", dayStatus: "" });
  expect(listReviews().find(review => review.key === "2026-10-09")?.dayStatus).toBe("");
});
it("autosaves weekly thoughts independently of focus and conclusions", () => {
  saveReview({key:"2026-10-12",kind:"week",preText:"Focus",sessionText:"Thoughts",postText:"Conclusions"});
  saveReview({key:"2026-10-12",kind:"week",sessionText:"Updated thoughts"});
  expect(listReviews().find(r => r.kind === "week" && r.key === "2026-10-12")).toMatchObject({preText:"Focus",sessionText:"Updated thoughts",postText:"Conclusions"});
});
it("validates actual dates, week anchors and finite nonnegative ATR", () => {
  expect(validReviewKey("2026-02-30")).toBe(false);
  expect(validReviewKey("2024-02-29")).toBe(true);
  expect(() => saveReview({ key: "2026-10-06", kind: "week" })).toThrow();
  expect(() => saveReview({ key: "2026-10-05", kind: "day", preAtr: -1 })).toThrow();
  expect(() => saveReview({ key: "2026-10-05", kind: "day", nyAtr: Infinity })).toThrow();
});
it("allows autosaved context without completion or required fields", () => {
  const review = saveReview({
    key: "2026-10-05",
    kind: "day",
    vpOpen: ["Near POC", "Near VAH"],
    vwapOpen: ["0 to +1σ"],
    vpShape: ["D", "Thin"],
  });
  expect(review.vpOpen).toEqual(["Near POC", "Near VAH"]);
  expect(review.preAtr).toBe(null);
  expect(() => saveReview({ key: "2026-10-05", kind: "day", vpOpen: ["invalid"] })).toThrow();
});
it("stores each session note with its own UTC timestamp and updates without duplicates", () => {
  const first = createSessionEntry("2026-10-05"),
    second = createSessionEntry("2026-10-05");
  expect(first.createdAt).toMatch(/Z$/);
  updateSessionEntry(first.id, [{ id: "text", kind: "text", text: "My thought" }]);
  updateSessionEntry(first.id, [{ id: "text", kind: "text", text: "Updated thought" }]);
  expect(listSessionEntries("2026-10-05")).toHaveLength(2);
  expect(
    listSessionEntries("2026-10-05").find((entry) => entry.id === first.id)?.blocks[0],
  ).toMatchObject({ text: "Updated thought" });
  expect(second.id).not.toBe(first.id);
  expect(() => createSessionEntry("bad-date")).toThrow();
});

it("stores a monthly review separately from a day and rejects non-first-of-month anchors", () => {
  saveReview({ key: "2026-10-01", kind: "month", postText: "Month conclusions", complete: true });
  expect(listReviews().find((review) => review.kind === "month")?.postText).toBe(
    "Month conclusions",
  );
  expect(() => saveReview({ key: "2026-10-02", kind: "month" })).toThrow();
});
it("keeps screenshots attached to their session entry and preserves text/image/text order", () => {
  const entry = createSessionEntry("2026-10-08");
  const db = reviewConnection();
  db.exec(
    "CREATE TABLE IF NOT EXISTS attachments(id TEXT PRIMARY KEY, owner_type TEXT, owner_id TEXT)",
  );
  db.prepare("INSERT INTO attachments(id,owner_type,owner_id) VALUES (?,'session-entry',?)").run(
    "image-one",
    entry.id,
  );
  db.close();
  const blocks = [
    { id: "before", kind: "text", text: "Before" },
    { id: "image", kind: "image", attachmentId: "image-one", name: "Chart.png" },
    { id: "after", kind: "text", text: "After" },
  ];
  updateSessionEntry(entry.id, blocks);
  expect(listSessionEntries("2026-10-08")[0]?.blocks).toEqual(blocks);
  const another = createSessionEntry("2026-10-08");
  expect(() => updateSessionEntry(another.id, blocks)).toThrow();
});
