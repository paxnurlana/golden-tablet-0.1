// @vitest-environment jsdom
import {it,expect,vi,afterEach} from 'vitest';
import {act} from 'react';import {createRoot} from 'react-dom/client';
import {emptyProcessReport,LEGACY_PROCESS_CRITERIA} from '../src/lib/process-equity';
const mock=vi.hoisted(()=>({data:null as unknown,post:vi.fn(),refresh:vi.fn()}));
vi.mock('@/lib/use-api',()=>({useApi:()=>({data:mock.data,error:null,refresh:mock.refresh}),postJson:(...args:unknown[])=>mock.post(...args)}));
import {ProcessReportCard} from '../src/components/process-report-card';
afterEach(()=>{localStorage.clear();mock.post.mockReset();});
it('autosaves scores immediately without save buttons and retains queued text on a failed request',async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
 const report=emptyProcessReport('2026-10-19');mock.data={reports:[report],demo:[],today:'2026-10-20',now:Date.parse('2026-10-20T10:00:00Z')};
 mock.post.mockImplementation(async(_url:string,input:Record<string,unknown>)=>{const next=structuredClone(report);next.items.find(i=>i.id===input.id)!.score=input.score as number;next.revision=1;return {report:next};});
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{
  await act(async()=>root.render(<ProcessReportCard date="2026-10-19"/>));
  expect(host.textContent).not.toContain('ШТРАФ');expect([...host.querySelectorAll('button')].some(b=>b.textContent==='Сохранить')).toBe(false);
  const select=host.querySelector<HTMLSelectElement>('select[aria-label="Балл: Подготовка"]')!;
  await act(async()=>{select.value='1';select.dispatchEvent(new Event('change',{bubbles:true}));});
  expect(mock.post).toHaveBeenCalledWith('/api/process-progress',{date:'2026-10-19',op:'item',id:'preparation',score:1});expect(localStorage.getItem('process-report-pending:2026-10-19')).toBeNull();
  mock.post.mockRejectedValue(new Error('Offline'));
  const text=host.querySelector<HTMLTextAreaElement>('textarea[aria-label="Пояснение: Подготовка"]')!;
  await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(text,'Keep this explanation');text.dispatchEvent(new Event('input',{bubbles:true}));text.dispatchEvent(new FocusEvent('focusout',{bubbles:true}));});
  expect(localStorage.getItem('process-report-pending:2026-10-19')).toContain('Keep this explanation');
 }finally{await act(async()=>root.unmount());host.remove();}
});
it('shows demo reports as read-only and never writes them',async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});const report=emptyProcessReport('2026-10-12');report.demo=true;mock.data={reports:[],demo:[report],today:'2026-10-18',now:Date.parse('2026-10-18T10:00:00Z')};
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);try{
  await act(async()=>root.render(<ProcessReportCard date={report.date} demo/>));expect(host.textContent).toContain('Демо');expect([...host.querySelectorAll('select')].every(s=>s.disabled)).toBe(true);expect(mock.post).not.toHaveBeenCalled();
 }finally{await act(async()=>root.unmount());host.remove();}
});
it('shows legacy criteria as legacy, never relabeling old improvement scores as exits',async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
 const report={...emptyProcessReport('2026-10-12'),criteriaVersion:undefined,items:LEGACY_PROCESS_CRITERIA.map(c=>({...c,text:'Original text',score:1}))};
 mock.data={reports:[report],demo:[],today:'2026-10-18',now:Date.parse('2026-10-18T10:00:00Z')};
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{
  await act(async()=>root.render(<ProcessReportCard date={report.date}/>));
  expect(host.textContent).toContain('по прежним критериям');
  expect(host.querySelector('select[aria-label="Балл: Daily Improvement"]')).not.toBeNull();
  expect(host.querySelector('select[aria-label="Балл: Сопровождение и выход"]')).toBeNull();
  expect(host.querySelector('button[aria-label="Удалить критерий Daily Improvement"]')).toBeNull();
  expect(host.textContent).toContain('Все критерии оценены');
 }finally{await act(async()=>root.unmount());host.remove();}
});
