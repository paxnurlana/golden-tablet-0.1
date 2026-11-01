// @vitest-environment jsdom
import {it,expect,vi} from 'vitest';
import {act,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {GrowingText} from '../src/components/trading-review';
it('uploads screenshots into review fields and slash commands, then unlocks editing',async()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  vi.stubGlobal('ClipboardEvent',class extends Event {clipboardData:unknown;constructor(type:string,init:ClipboardEventInit){super(type,init);this.clipboardData=init.clipboardData;}});
  const fetchMock=vi.fn(async(url:string)=>({ok:true,json:async()=>url==='/api/attachments'?{id:'review-image'}:{}}));vi.stubGlobal('fetch',fetchMock);
  function Harness({initial}:{initial:string}){const [value,setValue]=useState(initial);return <GrowingText source="review:day:2026-10-14:preText" value={value} onChange={setValue} placeholder="Plan"/>;}
  for(const initial of ['Plan','/задача Check']){
    const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
    try{
      await act(async()=>root.render(<Harness initial={initial}/>));
      const source=host.querySelector<HTMLTextAreaElement>('textarea[data-workflow-source]')!;
      source.setSelectionRange(initial.length,initial.length);
      const event=new Event('paste',{bubbles:true,cancelable:true});Object.defineProperty(event,'clipboardData',{value:{files:[new File(['qa'],'qa.png',{type:'image/png'})]}});
      await act(async()=>{source.dispatchEvent(event);await new Promise(resolve=>setTimeout(resolve,0));});
      expect(event.defaultPrevented).toBe(true);
      expect(source.value).toContain('[[image:review-image]]');
      expect(source.readOnly).toBe(false);
      expect(host.querySelector('img')?.getAttribute('src')).toBe('/api/attachments/review-image');
      expect(source.value).toContain(initial);
      expect(source.value.endsWith('[[image:review-image]]')).toBe(true);
      const visible=host.querySelector<HTMLTextAreaElement>('[data-slash-blocks] textarea')!;
      expect(visible.rows).toBe(1);
      expect(visible.value).toBe((initial.startsWith('/')?'Check':'Plan')+'\n');
      const continuation=host.querySelector<HTMLTextAreaElement>('textarea[aria-label*="после скриншота"]')!;
      expect(continuation).not.toBeNull();
      expect(continuation.value).toBe('');
      for(const key of ['Backspace','Delete']){
        const deletion=new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true});
        await act(async()=>{continuation.dispatchEvent(deletion);});
        expect(deletion.defaultPrevented).toBe(true);
      }
      await act(async()=>{
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(continuation,'Продолжение');
        continuation.dispatchEvent(new Event('input',{bubbles:true}));
      });
      expect(source.value).toContain('[[image:review-image]]Продолжение');
      expect(continuation.value).toBe('Продолжение');
      expect(host.querySelector('button[aria-label="Скопировать скриншот"]')).not.toBeNull();
      const handle=host.querySelector<HTMLButtonElement>('button[aria-label="Перетащить скриншот"]')!;
      expect(handle.draggable).toBe(true);
      const data=new Map<string,string>();
      const transfer={effectAllowed:'',types:['application/x-golden-inline-image'],setData:(key:string,value:string)=>data.set(key,value),getData:(key:string)=>data.get(key)||''};
      const start=new Event('dragstart',{bubbles:true});Object.defineProperty(start,'dataTransfer',{value:transfer});
      await act(async()=>{handle.dispatchEvent(start);});
      visible.setSelectionRange(0,0);
      const drop=new Event('drop',{bubbles:true,cancelable:true});Object.defineProperty(drop,'dataTransfer',{value:transfer});
      await act(async()=>{visible.dispatchEvent(drop);});
      expect(drop.defaultPrevented).toBe(true);
      expect(source.value).toContain((initial.startsWith('/')?'/задача ':'')+'[[image:review-image]]'+(initial.startsWith('/')?'Check':'Plan'));
      expect(source.value.match(/\[\[image:review-image\]\]/g)).toHaveLength(1);
    }finally{await act(async()=>root.unmount());host.remove();}
  }
  const upload=fetchMock.mock.calls.find(c=>c[0]==='/api/attachments') as unknown as [string,{body:FormData}];
  expect(upload[1].body.get('type')).toBe('review');expect(upload[1].body.get('id')).toBe('review:day:2026-10-14:preText');
  vi.unstubAllGlobals();
});
