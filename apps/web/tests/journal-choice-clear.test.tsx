// @vitest-environment jsdom
import {it,expect,vi} from 'vitest';
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {JournalChoicePicker} from '../src/components/journal-popover';
vi.mock('@radix-ui/react-popover',()=>({Root:({children}:any)=>children,Trigger:({children}:any)=>children,Portal:({children}:any)=>children,Content:({children}:any)=>children}));
it('clears optional single selections on repeat clicks but keeps required values',async()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const change=vi.fn();
  try {
    for(const allowClear of [true,false]) {
      await act(async()=>root.render(<JournalChoicePicker label="Choice" value="Long" options={[{value:'Long',label:'Long'}]} onChange={change} allowClear={allowClear}/>));
      await act(async()=>host.querySelector<HTMLButtonElement>('[role="option"]')!.click());
      expect(change).toHaveBeenLastCalledWith(allowClear?'':'Long');
    }
  } finally {await act(async()=>root.unmount());host.remove();}
});
