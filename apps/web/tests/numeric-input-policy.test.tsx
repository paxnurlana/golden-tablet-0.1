// @vitest-environment jsdom
import {it,expect} from 'vitest';
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {NumericInputPolicy} from '../src/components/numeric-input-policy';
it('blocks numeric arrow stepping and lets the wheel scroll without changing a focused number',async()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  const input=document.createElement('input');input.type='number';input.value='50';document.body.append(input);
  try {
    await act(async()=>root.render(<NumericInputPolicy/>));
    input.focus();
    const arrow=new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true,cancelable:true});input.dispatchEvent(arrow);
    expect(arrow.defaultPrevented).toBe(true);
    const typing=new KeyboardEvent('keydown',{key:'5',bubbles:true,cancelable:true});input.dispatchEvent(typing);expect(typing.defaultPrevented).toBe(false);
    const wheel=new WheelEvent('wheel',{deltaY:100,bubbles:true,cancelable:true});input.dispatchEvent(wheel);
    expect(input.value).toBe('50');expect(document.activeElement).not.toBe(input);expect(wheel.defaultPrevented).toBe(false);
    input.type='text';input.focus();const textArrow=new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true});input.dispatchEvent(textArrow);expect(textArrow.defaultPrevented).toBe(false);
  }finally{await act(async()=>root.unmount());host.remove();input.remove();}
});
