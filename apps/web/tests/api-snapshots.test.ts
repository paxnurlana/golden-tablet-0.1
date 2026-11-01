import {afterEach,expect,it,vi} from "vitest";
import {readApiSnapshot,writeApiSnapshot,clearApiSnapshots} from "../src/lib/use-api";
afterEach(()=>{clearApiSnapshots();vi.useRealTimers();});
it("shares recent data and expires snapshots instead of retaining financial data forever",()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date("2026-10-10T12:00:00Z"));
  writeApiSnapshot("/test",{value:1});expect(readApiSnapshot("/test")).toEqual({value:1});
  vi.advanceTimersByTime(120001);expect(readApiSnapshot("/test")).toBeUndefined();
});
it("invalidates cached data after writes and bounds the cache",()=>{
  for(let i=0;i<45;i++)writeApiSnapshot(`/test/${i}`,i);
  expect(readApiSnapshot("/test/0")).toBeUndefined();expect(readApiSnapshot("/test/44")).toBe(44);
  clearApiSnapshots();expect(readApiSnapshot("/test/44")).toBeUndefined();
});
