// @vitest-environment jsdom
import {it,expect,vi} from 'vitest';
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {JournalBodyEditor} from '../src/components/journal-body-editor';
it('renders review-style images in ordinary text without concatenating adjacent lines',async()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  try{
    await act(async()=>root.render(<JournalBodyEditor entry={{id:'qa-plain-image',bodyText:'Before\n[[image:plain-image]]\nAfter'}} attachments={[]} onCommit={()=>{}} onUpload={async()=>undefined}/>));
    expect(host.querySelector('[data-slash-blocks] img')?.getAttribute('src')).toBe('/api/attachments/plain-image');
    expect([...host.querySelectorAll<HTMLTextAreaElement>('[data-slash-blocks] textarea')].map(field=>field.value)).toEqual(['Before\n','\nAfter']);
  }finally{await act(async()=>root.unmount());host.remove();}
});
it('routes a heading image into an empty body and leaves an editable line after it',async()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const commit=vi.fn();
  const imagePasteRef={current:null as null|((file:File)=>Promise<void>)};
  try{
    await act(async()=>root.render(<JournalBodyEditor entry={{id:'qa-heading-image',bodyText:'',bodyBlocks:[]}} attachments={[]} imagePasteRef={imagePasteRef} onCommit={commit} onUpload={async()=>({id:'from-heading',name:'image.png'})}/>));
    expect(host.querySelector('textarea')).not.toBeNull();
    await act(async()=>{await imagePasteRef.current!(new File(['image'],'image.png',{type:'image/png'}));});
    expect(commit.mock.calls.at(-1)?.[0]).toEqual([expect.objectContaining({kind:'text',text:''}),expect.objectContaining({kind:'image',attachmentId:'from-heading'}),expect.objectContaining({kind:'text',text:''})]);
    const fields=Array.from(host.querySelectorAll<HTMLTextAreaElement>('[data-slash-blocks] textarea'));
    expect(fields.at(-1)?.readOnly).toBe(false);
    expect(fields.at(-1)?.value).toBe('');
  }finally{await act(async()=>root.unmount());host.remove();}
});
it('separates adjacent screenshots with an editable line without replacing either image',async()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const commit=vi.fn();
  const images=[{id:'one',kind:'image' as const,attachmentId:'first',name:'first.png'},{id:'two',kind:'image' as const,attachmentId:'second',name:'second.png'}];
  try {
    await act(async()=>root.render(<JournalBodyEditor entry={{id:'qa',bodyText:'',bodyBlocks:images}} attachments={[]} onCommit={commit} onUpload={async()=>undefined}/>));
    expect(host.querySelectorAll('button[aria-label="Перетащить скриншот"]')).toHaveLength(2);
    await act(async()=>host.querySelector<HTMLButtonElement>('button[aria-label="Вставить строку между скриншотами"]')!.click());
    expect(commit).toHaveBeenLastCalledWith([images[0],expect.objectContaining({kind:'text',text:''}),images[1]]);
  }finally{await act(async()=>root.unmount());host.remove();}
});
it('replaces the current empty line with an image rather than leaving a blank paragraph above',async()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  vi.stubGlobal('ClipboardEvent',class extends Event {clipboardData:unknown;constructor(type:string,init:ClipboardEventInit){super(type,init);this.clipboardData=init.clipboardData;}});
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const commit=vi.fn();
  try {
    await act(async()=>root.render(<JournalBodyEditor entry={{id:'qa-line',bodyText:'Text\n'}} attachments={[]} onCommit={commit} onUpload={async()=>({id:'qa-image',name:'qa.png'})}/>));
    const field=host.querySelector<HTMLTextAreaElement>('[data-slash-blocks] textarea')!;
    field.focus();field.setSelectionRange(5,5);
    const event=new Event('paste',{bubbles:true,cancelable:true});Object.defineProperty(event,'clipboardData',{value:{getData:()=>'',files:[new File(['qa'],'qa.png',{type:'image/png'})]}});
    await act(async()=>field.dispatchEvent(event));
    expect(commit.mock.calls.at(-1)?.[0]).toEqual([expect.objectContaining({kind:'text',text:'Text'}),expect.objectContaining({kind:'image',attachmentId:'qa-image'}),expect.objectContaining({kind:'text',text:''})]);
  } finally {await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();}
});
it('inserts images at the visible caret, preserves blank lines and focuses a visible continuation',async()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame',(fn:FrameRequestCallback)=>setTimeout(()=>fn(0),0));
  vi.stubGlobal('ClipboardEvent',class extends Event {clipboardData:unknown;constructor(type:string,init:ClipboardEventInit){super(type,init);this.clipboardData=init.clipboardData;}});
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const commit=vi.fn();
  try{
    await act(async()=>root.render(<JournalBodyEditor entry={{id:'qa',bodyText:'Top\nBottom\n\n\n'}} attachments={[]} onCommit={commit} onUpload={async()=>({id:'qa-image',name:'qa.png'})}/>));
    const field=host.querySelector<HTMLTextAreaElement>('[data-slash-blocks] textarea')!;field.focus();field.setSelectionRange(3,3);
    const paste=new Event('paste',{bubbles:true,cancelable:true});Object.defineProperty(paste,'clipboardData',{value:{getData:()=>'',files:[new File(['qa'],'qa.png',{type:'image/png'})]}});
    await act(async()=>field.dispatchEvent(paste));await act(async()=>{await vi.advanceTimersByTimeAsync(1);});
    expect(commit).toHaveBeenLastCalledWith([expect.objectContaining({kind:'text',text:'Top'}),expect.objectContaining({kind:'image',attachmentId:'qa-image'}),expect.objectContaining({kind:'text',text:'\nBottom\n\n\n'})]);
    expect(host.textContent).not.toContain('Продолжить запись');expect((document.activeElement as HTMLElement).style.display).not.toBe('none');
    expect((document.activeElement as HTMLTextAreaElement).value).toBe('\nBottom\n\n\n');
  }finally{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();vi.useRealTimers();}
});
it('keeps a pasted screenshot inside its slash command',async()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame',(fn:FrameRequestCallback)=>setTimeout(()=>fn(0),0));
  vi.stubGlobal('ClipboardEvent',class extends Event {clipboardData:unknown;constructor(type:string,init:ClipboardEventInit){super(type,init);this.clipboardData=init.clipboardData;}});
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const commit=vi.fn();
  try {
    await act(async()=>root.render(<JournalBodyEditor entry={{id:'qa',bodyText:'/идея Check chart'}} attachments={[]} onCommit={commit} onUpload={async()=>({id:'qa-image',name:'qa.png'})}/>));
    const field=host.querySelector<HTMLTextAreaElement>('textarea[aria-label="Текст /идея"]')!;field.setSelectionRange(11,11);
    const paste=new Event('paste',{bubbles:true,cancelable:true});Object.defineProperty(paste,'clipboardData',{value:{getData:()=>'',files:[new File(['qa'],'qa.png',{type:'image/png'})]}});
    await act(async()=>field.dispatchEvent(paste));await act(async()=>{await vi.advanceTimersByTimeAsync(1);});
    expect(commit.mock.calls.at(-1)![0]).toHaveLength(1);
    expect(commit.mock.calls.at(-1)![0][0].text).toContain('\n\t[[image:qa-image]]');
    expect(host.querySelector('[data-slash-part] img')?.getAttribute('src')).toBe('/api/attachments/qa-image');
    expect(host.querySelector<HTMLTextAreaElement>('textarea[aria-label="Текст /идея"]')!.value).not.toContain('[[image:');
  } finally {await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();vi.useRealTimers();}
});
it('removes an empty document block with Delete and keeps the following screenshot',async()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame',(fn:FrameRequestCallback)=>setTimeout(()=>fn(0),0));
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const commit=vi.fn();
  const blocks=[{id:'command',kind:'text' as const,text:'/вопрос Keep question'},{id:'empty',kind:'text' as const,text:''},{id:'image',kind:'image' as const,attachmentId:'qa',name:'qa.png'}];
  try {
    await act(async()=>root.render(<JournalBodyEditor entry={{id:'qa',bodyText:'',bodyBlocks:blocks}} attachments={[]} onCommit={commit} onUpload={async()=>undefined}/>));
    const field=host.querySelector<HTMLTextAreaElement>('[data-editor-block="empty"] [data-slash-blocks] textarea')!;field.focus();
    await act(async()=>field.dispatchEvent(new KeyboardEvent('keydown',{key:'Delete',bubbles:true,cancelable:true})));
    await act(async()=>{await vi.advanceTimersByTimeAsync(1);});
    expect(commit).toHaveBeenLastCalledWith([blocks[0],blocks[2]]);
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Текст /вопрос');
    expect(host.querySelector('[data-editor-block="empty"]')).toBeNull();
  } finally {await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();vi.useRealTimers();}
});
it('removes an empty continuation inside a slash field',async()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});vi.useFakeTimers();vi.stubGlobal('requestAnimationFrame',(fn:FrameRequestCallback)=>setTimeout(()=>fn(0),0));
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const commit=vi.fn();
  try {
    await act(async()=>root.render(<JournalBodyEditor entry={{id:'qa',bodyText:'/вопрос Keep question\n'}} attachments={[]} onCommit={commit} onUpload={async()=>undefined}/>));
    const fields=host.querySelectorAll<HTMLTextAreaElement>('[data-slash-blocks] textarea');fields[1]!.focus();
    await act(async()=>fields[1]!.dispatchEvent(new KeyboardEvent('keydown',{key:'Delete',bubbles:true,cancelable:true})));
    await act(async()=>{await vi.advanceTimersByTimeAsync(1);});
    expect(host.querySelectorAll('[data-slash-blocks] textarea')).toHaveLength(1);
    expect(commit.mock.calls.at(-1)?.[0][0].text).toBe('/вопрос Keep question');
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Текст /вопрос');
  } finally {await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();vi.useRealTimers();}
});
it('does not recreate blank lines when editing a command containing an inline screenshot',async()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const commit=vi.fn();
  try {
    await act(async()=>root.render(<JournalBodyEditor entry={{id:'qa',bodyText:'/вопрос Keep\n\t\n\t\n\t[[image:qa-image]]'}} attachments={[]} onCommit={commit} onUpload={async()=>undefined}/>));
    const field=host.querySelector<HTMLTextAreaElement>('textarea[aria-label="Текст /вопрос"]')!;
    expect(field.value).toBe('Keep\n\n\n');
    for (const value of ['Keep\n','Keep','Keep edited','Keep']) {
      await act(async()=>{
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(field,value);
        field.dispatchEvent(new Event('input',{bubbles:true}));
      });
      expect(field.value).toBe(value);
      expect(host.querySelectorAll('[data-slash-part] img')).toHaveLength(1);
    }
    await act(async()=>field.dispatchEvent(new FocusEvent('focusout',{bubbles:true})));
    expect(commit.mock.calls.at(-1)?.[0][0].text).toBe('/вопрос Keep[[image:qa-image]]');
  } finally {await act(async()=>root.unmount());host.remove();}
});
