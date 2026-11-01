// @vitest-environment jsdom
import {it,expect,vi} from 'vitest';
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {ReviewMonthPicker} from '../src/components/review-month-picker';
it('chooses a year first, then a month, without native date inputs',async()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const change=vi.fn();
  try{
    await act(async()=>root.render(<ReviewMonthPicker value="2026-10" today="2026-10-14" open onChange={change}/>));
    expect(host.querySelector('input')).toBeNull();
    expect(host.querySelector('[aria-pressed=true]')?.textContent).toBe('Октябрь');
    await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="Выбрать год"]')!.click());
    await act(async()=>Array.from(host.querySelectorAll('button')).find(b=>b.textContent==='2028')!.click());
    expect(change).not.toHaveBeenCalled();
    await act(async()=>Array.from(host.querySelectorAll('button')).find(b=>b.textContent==='Март')!.click());
    expect(change).toHaveBeenCalledWith('2028-03');
    await act(async()=>Array.from(host.querySelectorAll('button')).find(b=>b.textContent==='Текущий месяц')!.click());
    expect(change).toHaveBeenLastCalledWith('2026-10');
  }finally{await act(async()=>root.unmount());host.remove();}
});
