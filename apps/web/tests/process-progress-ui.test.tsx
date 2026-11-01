// @vitest-environment jsdom
import {it,expect,vi} from 'vitest';import {act} from 'react';import {createRoot} from 'react-dom/client';
import {demoProcessReports} from '../src/lib/process-equity';
const mock=vi.hoisted(()=>({data:null as unknown,refresh:vi.fn()}));
vi.mock('@/lib/use-api',()=>({useApi:()=>({data:mock.data,error:null,refresh:mock.refresh}),postJson:vi.fn()}));
vi.mock('next/dynamic',()=>({default:()=>({points,frame}:{points:unknown[];frame:string})=><div data-chart-frame={frame} data-chart-count={points.length}/> }));
import {ProcessProgress} from '../src/components/process-progress';
it('offers only criteria/days and keeps the chart independent of the calendar month',async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});localStorage.clear();localStorage.setItem('process-equity-demo','true');mock.data={reports:[],demo:demoProcessReports(),today:'2026-10-18',now:Date.parse('2026-10-18T10:00:00Z'),start:'2026-10-19'};
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{
  await act(async()=>root.render(<ProcessProgress/>));
  const frame=host.querySelector('[aria-label="Вид графика"]')!;expect([...frame.querySelectorAll('button')].map(b=>b.textContent)).toEqual(['По критериям','По дням']);
  const count=host.querySelector('[data-chart-count]')!.getAttribute('data-chart-count');
  const input=host.querySelector<HTMLInputElement>('[aria-label="Месяц рапортов"]')!;await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'2026-09');input.dispatchEvent(new Event('input',{bubbles:true}));});
  expect(host.querySelector('[data-chart-count]')!.getAttribute('data-chart-count')).toBe(count);
  await act(async()=>[...frame.querySelectorAll('button')].find(b=>b.textContent==='По критериям')!.click());expect(Number(host.querySelector('[data-chart-count]')!.getAttribute('data-chart-count'))).toBeGreaterThan(Number(count));
 }finally{await act(async()=>root.unmount());host.remove();localStorage.clear();}
});
