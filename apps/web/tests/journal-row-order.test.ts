import {it,expect} from 'vitest';
import {sortJournalEntries} from '../src/lib/journal-row-order';
import type {JournalEntry,Term} from '../src/server/personal-journal';
const entries=[{id:'a',tradeNo:4,date:'2026-10-12',realisedR:1,terms:{result:['win']},accounts:[]},{id:'b',tradeNo:4,date:'2026-10-07',realisedR:null,terms:{result:['be']},accounts:[]},{id:'c',tradeNo:10,date:'2026-10-14',realisedR:-2,terms:{},accounts:[]}] as unknown as JournalEntry[];
it('sorts dates both ways without changing numbers or identities',()=>{
  expect(sortJournalEntries(entries,[],{key:'date',direction:'asc'}).map(e=>e.id)).toEqual(['b','a','c']);
  expect(sortJournalEntries(entries,[],{key:'date',direction:'desc'}).map(e=>e.id)).toEqual(['c','a','b']);
  expect(entries.map(e=>e.tradeNo)).toEqual([4,4,10]);
});
it('sorts numbers numerically and keeps missing values last in both directions',()=>{
  expect(sortJournalEntries(entries,[],{key:'tradeNo',direction:'desc'}).map(e=>e.id)).toEqual(['c','a','b']);
  expect(sortJournalEntries(entries,[],{key:'realisedR',direction:'desc'}).map(e=>e.id)).toEqual(['a','c','b']);
  expect(sortJournalEntries(entries,[],{key:'realisedR',direction:'asc'}).map(e=>e.id)).toEqual(['c','a','b']);
});
it('sorts relations by displayed names and restores independent manual order',()=>{
  const terms=[{id:'win',name:'Win'},{id:'be',name:'Breakeven'}] as Term[];
  expect(sortJournalEntries(entries,terms,{key:'result',direction:'asc'}).map(e=>e.id)).toEqual(['b','a','c']);
  expect(sortJournalEntries(entries,terms,null,['c','b','a']).map(e=>e.id)).toEqual(['c','b','a']);
  expect(sortJournalEntries([...entries,{...entries[0]!,id:'new'}],terms,null,['c','b','a']).map(e=>e.id)).toEqual(['c','b','a','new']);
});
