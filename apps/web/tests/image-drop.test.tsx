// @vitest-environment jsdom
import {it,expect,vi} from 'vitest';
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {JournalBodyEditor} from '../src/components/journal-body-editor';
import {SlashTextarea} from '../src/components/slash-textarea';
const files=()=>[new File(['a'],'one.png',{type:'image/png'}),new File(['b'],'two.png',{type:'image/png'})];
function drop(images:File[]){const e=new Event('drop',{bubbles:true,cancelable:true});Object.defineProperty(e,'dataTransfer',{value:{files:images,types:['Files'],getData:()=>''}});return e;}
it('uploads multiple dropped images in order without replacing existing body text',async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});const host=document.createElement('div');document.body.append(host);const root=createRoot(host),commit=vi.fn(),upload=vi.fn(async(f:File)=>({id:f.name.replace('.png',''),name:f.name}));
 try{
  await act(async()=>root.render(<JournalBodyEditor entry={{id:'drop-owner',bodyText:'Keep text',bodyBlocks:[{id:'text',kind:'text',text:'Keep text'}]}} attachments={[]} onCommit={commit} onUpload={upload}/>));
  const event=drop(files());await act(async()=>{host.querySelector('[data-workflow-owner]')!.dispatchEvent(event);await new Promise(r=>setTimeout(r,0));});
  expect(event.defaultPrevented).toBe(true);expect(upload).toHaveBeenCalledTimes(2);
  expect(commit.mock.calls.at(-1)?.[0]).toEqual([expect.objectContaining({text:'Keep text'}),expect.objectContaining({kind:'image',attachmentId:'one'}),expect.objectContaining({kind:'image',attachmentId:'two'}),expect.objectContaining({kind:'text',text:''})]);
 }finally{await act(async()=>root.unmount());host.remove();}
});
it('forwards a direct textarea drop through its existing paste handler',async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});vi.stubGlobal('ClipboardEvent',class extends Event{clipboardData:unknown;constructor(type:string,init:ClipboardEventInit){super(type,init);this.clipboardData=init.clipboardData;}});
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host),paste=vi.fn();
 try{await act(async()=>root.render(<SlashTextarea data-no-slash onPaste={paste}/>));const e=drop(files());await act(async()=>host.querySelector('textarea')!.dispatchEvent(e));expect(e.defaultPrevented).toBe(true);expect(paste).toHaveBeenCalledTimes(1);expect(paste.mock.calls[0]![0].clipboardData.files).toHaveLength(2);
 }finally{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();}
});
it('drops images inside slash commands through the owning editor, not as foreign blocks',async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});vi.stubGlobal('ClipboardEvent',class extends Event{clipboardData:unknown;constructor(type:string,init:ClipboardEventInit){super(type,init);this.clipboardData=init.clipboardData;}});
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host),commit=vi.fn();
 try{await act(async()=>root.render(<JournalBodyEditor entry={{id:'command-owner',bodyText:'/идея Keep'}} attachments={[]} onCommit={commit} onUpload={async(f)=>({id:f.name.replace('.png',''),name:f.name})}/>));
 const field=host.querySelector<HTMLTextAreaElement>('[data-slash-blocks] textarea')!;field.setSelectionRange(field.value.length,field.value.length);const e=drop(files());await act(async()=>{field.dispatchEvent(e);await new Promise(r=>setTimeout(r,0));});
 const blocks=commit.mock.calls.at(-1)?.[0];expect(blocks[0].text).toContain('/идея Keep');expect(blocks[0].text).toContain('[[image:one]]');expect(blocks[0].text).toContain('[[image:two]]');expect(e.defaultPrevented).toBe(true);
 }finally{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();}
});
