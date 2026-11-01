import {it,expect} from 'vitest';
import {filterReviewAccounts} from '../src/lib/review-account-filter';
import {reviewStats} from '../src/lib/trading-review';
import type {JournalEntry,Term} from '../src/server/personal-journal';
const scopes=[{id:'a',name:'A',firmId:'firm'},{id:'b',name:'B',firmId:'firm'},{id:'c',name:'Personal',firmId:null}];
const entry={id:'one',mode:'Forward',date:'2026-10-14',realisedR:2,realisedTicks:null,terms:{result:['win']},accounts:[{accountId:'a',pnlCash:100,pnlPct:1},{accountId:'b',pnlCash:200,pnlPct:2},{accountId:'c',pnlCash:900,pnlPct:9}]} as JournalEntry;
const terms=[{id:'win',name:'Win'}] as Term[];
it('limits cash to account/firms without duplicating RR or mutating stored records',()=>{
  expect(reviewStats(filterReviewAccounts([entry],['firm:firm','account:a'],scopes),terms)).toMatchObject({rr:2,cash:300,trades:1,accounts:2});
  expect(reviewStats(filterReviewAccounts([entry],['account:c'],scopes),terms)).toMatchObject({rr:2,cash:900,trades:1,accounts:1});
  expect(entry.accounts).toHaveLength(3);
  expect(filterReviewAccounts([entry],[],scopes)).toEqual([entry]);
  expect(filterReviewAccounts([entry],['firm:missing'],scopes)).toEqual([]);
});
