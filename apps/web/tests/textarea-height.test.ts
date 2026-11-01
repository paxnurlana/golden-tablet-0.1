// @vitest-environment jsdom
import {it,expect,vi} from 'vitest';
import {resizeTextarea} from '../src/lib/textarea-height';
it('measures without collapsing the active textarea or resetting its scroll',()=>{
  const field=document.createElement('textarea');document.body.append(field);
  field.style.height='72px';field.style.boxSizing='border-box';field.value='Typing';field.scrollTop=8;
  field.getBoundingClientRect=()=>({width:400} as DOMRect);
  const original=document.createElement.bind(document);
  const spy=vi.spyOn(document,'createElement').mockImplementation(((name:string)=>{
    const el=original(name);
    if(name==='textarea')Object.defineProperty(el,'scrollHeight',{value:24});
    return el;
  }) as typeof document.createElement);
  try {
    resizeTextarea(field,72);
    expect(field.style.height).toBe('72px');expect(field.scrollTop).toBe(8);
    expect(document.querySelectorAll('textarea')).toHaveLength(1);
    field.value='Next character';resizeTextarea(field,72);
    expect(field.style.height).toBe('72px');
  }finally{spy.mockRestore();field.remove();}
});
