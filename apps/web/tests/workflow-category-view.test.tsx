// @vitest-environment jsdom
import {it,expect,vi} from 'vitest';
import {act} from 'react';
import {createRoot} from 'react-dom/client';
const mocks=vi.hoisted(()=>({category:'закон' as string|null,push:vi.fn(),refresh:vi.fn(),post:vi.fn(async(..._args:unknown[])=>({id:'new'})),cards:[{id:'law',category:'закон',text:'Rule title',status:'doing',created_at:'2026-10-01T10:00:00Z',status_changed_at:'2026-10-02T10:00:00Z',source:'manual:law',url:'/workflow',blocks:[{id:'note',kind:'text',text:'Long internal note'}]},{id:'idea',category:'идея',text:'Other idea',status:'inbox',source:'manual:idea',url:'/workflow',blocks:[]}]}));
vi.mock('next/navigation',()=>({useRouter:()=>({push:mocks.push}),useSearchParams:()=>({get:(key:string)=>key==='category'?mocks.category:null})}));
vi.mock('../src/lib/use-api',()=>({useApi:()=>({data:{cards:mocks.cards},refresh:mocks.refresh,loading:false}),postJson:(...args:unknown[])=>mocks.post(...args)}));
import {WorkflowBoard} from '../src/components/workflow-board';
it('opens a full-width category with notes and existing create/copy/delete actions',async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{
  await act(async()=>root.render(<WorkflowBoard/>));
  expect(host.querySelectorAll('section[aria-label^="Столбец"]')).toHaveLength(1);expect(host.textContent).toContain('Long internal note');expect(host.textContent).not.toContain('Other idea');
  const statuses=host.querySelector('[aria-label="Статус записей Workflow"]')!;
  const waiting=[...statuses.querySelectorAll('button')].find(button=>button.textContent==='Входящие')!;
  await act(async()=>waiting.click());expect(host.querySelector('[data-workflow-card="law"]')).toBeNull();expect(waiting.getAttribute('aria-pressed')).toBe('true');
  await act(async()=>[...statuses.querySelectorAll('button')].find(button=>button.textContent==='Все')!.click());
  expect(host.textContent).toContain('По дате создания');
  const sort=host.querySelector<HTMLSelectElement>('select[aria-label="Сортировка Workflow"]')!;
  expect([...sort.options].map(option=>option.textContent)).toContain('Сначала новые');
  await act(async()=>{sort.value='newest';sort.dispatchEvent(new Event('change',{bubbles:true}));});expect(localStorage.getItem('workflow-sort')).toBe('newest');
  expect(host.querySelector('time')?.getAttribute('datetime')).toBe('2026-10-01T10:00:00Z');
  expect(host.querySelector('button[aria-label^="Перетащить карточку"]')).toBeNull();
  const tile=host.querySelector<HTMLButtonElement>('button[aria-label="Создать новую запись: Законы"]')!;
  expect(tile).not.toBeNull();expect(tile).toBe(tile.parentElement?.lastElementChild);
  expect(host.querySelector('button[aria-label="Добавить: Законы"]')).toBeNull();
  await act(async()=>host.querySelector<HTMLButtonElement>('button[aria-label="Копировать: Rule title"]')!.click());expect(mocks.post).toHaveBeenLastCalledWith('/api/workflow',{action:'duplicate',id:'law'});
  await act(async()=>host.querySelector<HTMLButtonElement>('button[aria-label="Удалить: Rule title"]')!.click());expect(mocks.post).toHaveBeenLastCalledWith('/api/workflow',{action:'delete',id:'law'});expect(host.textContent).toContain('Отменить');
  await act(async()=>host.querySelector<HTMLButtonElement>('button[aria-label="Открыть категорию: Законы"]')!.click());expect(mocks.push).toHaveBeenCalledWith('/workflow?category='+encodeURIComponent('закон'));
 }finally{await act(async()=>root.unmount());host.remove();}
});
it('moves the whole card across columns with no drag handle and provides creation tiles in empty columns',async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});mocks.category=null;const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{
  await act(async()=>root.render(<WorkflowBoard/>));
  const card=host.querySelector<HTMLElement>('[data-workflow-card="law"]')!;
  expect(card.draggable).toBe(true);
  const transfer={setData:vi.fn(),effectAllowed:'',dropEffect:''};
  const start=new Event('dragstart',{bubbles:true});Object.defineProperty(start,'dataTransfer',{value:transfer});
  const drop=new Event('drop',{bubbles:true,cancelable:true});Object.defineProperty(drop,'dataTransfer',{value:transfer});
  await act(async()=>{card.dispatchEvent(start);host.querySelector('section[aria-label="Столбец Идеи"]')!.dispatchEvent(drop);});
  expect(mocks.post).toHaveBeenLastCalledWith('/api/workflow',{action:'category',id:'law',category:'идея'});
  expect(host.querySelector('section[aria-label="Столбец Мысли"] button[aria-label="Создать новую запись: Мысли"]')).not.toBeNull();
 }finally{await act(async()=>root.unmount());host.remove();mocks.category='закон';}
});
