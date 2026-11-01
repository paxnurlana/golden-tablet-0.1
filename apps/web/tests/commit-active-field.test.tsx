// @vitest-environment jsdom
import {it,expect,vi} from 'vitest';
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {CommitActiveField} from '../src/components/commit-active-field';
it('commits the last value before a closing pointer handler and on Escape',async()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const save=vi.fn();
  try{
    await act(async()=>root.render(<><CommitActiveField/><input aria-label="MAE" defaultValue="" onBlur={e=>save(e.target.value)}/><button onPointerDown={()=>expect(save).toHaveBeenCalledWith('50')}>Close</button></>));
    const input=host.querySelector('input')!;input.focus();input.value='50';
    await act(async()=>host.querySelector('button')!.dispatchEvent(new Event('pointerdown',{bubbles:true})));
    expect(save).toHaveBeenCalledWith('50');input.focus();input.value='60';
    await act(async()=>input.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
    expect(save).toHaveBeenLastCalledWith('60');
  }finally{await act(async()=>root.unmount());host.remove();}
});
