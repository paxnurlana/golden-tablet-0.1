// @vitest-environment jsdom
import {it,expect} from 'vitest';
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {metricLayout,moveMetric,JOURNAL_METRIC_IDS} from '../src/lib/journal-metric-layout';
import {JournalMetrics} from '../src/components/journal-metrics';
it('validates saved preferences and moves cards in either direction',()=>{
 const layout=metricLayout({order:['PNL','PNL','invalid'],hidden:['PNL','invalid']});
 expect(layout.order[0]).toBe('PNL');expect(layout.order).toHaveLength(JOURNAL_METRIC_IDS.length);expect(layout.hidden).toEqual(['PNL']);
 expect(moveMetric(['a','b','c'],'a','c')).toEqual(['b','c','a']);expect(moveMetric(['a','b','c'],'c','a')).toEqual(['c','a','b']);
});
it('restores visibility, persists dragging and retains equal-size cards',async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});localStorage.clear();
 localStorage.setItem('journal-metric-layout-v1',JSON.stringify({hidden:['Avg MAE']}));
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{
  await act(async()=>root.render(<JournalMetrics entries={[]} terms={[]}/>));
  expect(host.querySelector('[data-metric-card="Avg MAE"]')).toBeNull();
  expect(host.querySelector('[data-metric-card="Missed trades"]')?.className).not.toContain('col-span');
  const first=host.querySelector<HTMLElement>('[data-metric-card="Сделки / Записи"]')!,pnl=host.querySelector<HTMLElement>('[data-metric-card="PNL"]')!;
  const transfer={effectAllowed:'',setData:()=>{}};
  const start=new Event('dragstart',{bubbles:true});Object.defineProperty(start,'dataTransfer',{value:transfer});
  await act(async()=>{first.dispatchEvent(start);pnl.dispatchEvent(new Event('drop',{bubbles:true,cancelable:true}));});
  const saved=JSON.parse(localStorage.getItem('journal-metric-layout-v1')!);
  expect(saved.order.indexOf('Сделки / Записи')).toBeGreaterThan(saved.order.indexOf('PNL'));expect(saved.hidden).toEqual(['Avg MAE']);
 }finally{await act(async()=>root.unmount());host.remove();localStorage.clear();}
});
