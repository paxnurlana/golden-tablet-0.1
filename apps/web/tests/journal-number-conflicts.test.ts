import {it,expect} from 'vitest';
import {journalNumberConflicts} from '../src/lib/journal-number-conflicts';
it('detects duplicate labels without treating repeated snapshots of an identity as another trade',()=>{
  expect([...journalNumberConflicts([{id:'a',tradeNo:5},{id:'b',tradeNo:5},{id:'c',tradeNo:6}])]).toEqual([5]);
  expect(journalNumberConflicts([{id:'a',tradeNo:5},{id:'a',tradeNo:5}]).size).toBe(0);
});
