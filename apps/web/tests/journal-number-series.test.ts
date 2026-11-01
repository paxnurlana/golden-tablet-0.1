import {it,expect} from 'vitest';
import {numberSeries} from '../src/lib/journal-number-series';
import {journalNumberConflictIds} from '../src/lib/journal-number-conflicts';
it('keeps Missed with executions and gives hypotheses and unidentified ideas separate series',()=>{
 for(const name of ['Win','Loss','BE','Breakeven','Missed'])expect(numberSeries([name])).toBe('main');
 expect(numberSeries(['Hypothesis'])).toBe('hypothesis');expect(numberSeries(['НЛО'])).toBe('unidentified');
 expect([...journalNumberConflictIds([{id:'a',tradeNo:1,numberSeries:'main'},{id:'h',tradeNo:1,numberSeries:'hypothesis'},{id:'u',tradeNo:1,numberSeries:'unidentified'}])]).toEqual([]);
 expect([...journalNumberConflictIds([{id:'h',tradeNo:1,numberSeries:'hypothesis'},{id:'h2',tradeNo:1,numberSeries:'hypothesis'}])]).toEqual(['h','h2']);
});
