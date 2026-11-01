// @vitest-environment jsdom
import {it,expect,vi} from 'vitest';
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {matchesTradeScope} from '../src/lib/journal-trade-scope';
import {JournalSegmentControl} from '../src/components/journal-segment-control';
import type {JournalEntry} from '../src/server/personal-journal';
it('separates executed results from all three scenario categories without inventing a result for empty records',()=>{
 const names=new Map(['Win','Loss','BE','Breakeven','Missed','Hypothesis','Неопознанный трейд'].map(n=>[n,n]));
 for(const result of [...names.keys(),'']){
  const row={terms:{result:result?[result]:[]}} as unknown as JournalEntry;
  const actual=['Win','Loss','BE','Breakeven'].includes(result);
  expect(matchesTradeScope(row,names,'Realised')).toBe(actual);
  expect(matchesTradeScope(row,names,'Unrealised')).toBe(Boolean(result)&&!actual);
  expect(matchesTradeScope(row,names,'All')).toBe(true);
 }
});
it('provides compact radio-style switches with click and keyboard selection',async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});const host=document.createElement('div');document.body.append(host);const root=createRoot(host),change=vi.fn();
 try{
  await act(async()=>root.render(<JournalSegmentControl label="Режим" value="Live" options={[{value:'Live',label:'Live'},{value:'Historical',label:'Historical'},{value:'All',label:'All'}]} onChange={change}/>));
  const buttons=host.querySelectorAll('button');expect(buttons[0]!.getAttribute('aria-checked')).toBe('true');
  await act(async()=>buttons[1]!.click());expect(change).toHaveBeenLastCalledWith('Historical');
  await act(async()=>buttons[0]!.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true})));expect(change).toHaveBeenLastCalledWith('Historical');
 }finally{await act(async()=>root.unmount());host.remove();}
});
