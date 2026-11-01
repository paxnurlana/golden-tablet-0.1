// @vitest-environment jsdom
import {it,expect,vi} from 'vitest';
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {JournalBodyEditor} from '../src/components/journal-body-editor';
import {clipboardImageParts} from '../src/lib/rich-image-paste';
const origin='http://localhost:3000';
it('preserves text and screenshots in order and refuses external image fetches',()=>{
 const data={getData:(type:string)=>type==='text/html'?'<section><strong>15.10.2026</strong><p>Before</p><img src="data:image/png;base64,YQ==" alt="one.png"/><p>After</p></section>':''};
 expect(clipboardImageParts(data,origin)).toEqual([expect.objectContaining({kind:'text',text:expect.stringContaining('Before')}),{kind:'image',src:'data:image/png;base64,YQ==',name:'one.png'},expect.objectContaining({kind:'text',text:expect.stringContaining('After')})]);
 expect(clipboardImageParts({getData:()=>'<img src="https://example.com/private.png"/>'},origin)).toBeNull();
 expect(clipboardImageParts({getData:t=>t==='text/plain'?'Before\nimage.png: '+origin+'/api/attachments/with_under-score\nAfter':''},origin)).toEqual([expect.objectContaining({text:'Before\n'}),{kind:'image',src:origin+'/api/attachments/with_under-score',name:'image.png'},expect.objectContaining({text:'\nAfter'})]);
});
it('pastes a complete Live note into the visible Journal field, uploading images to the destination',async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
 vi.stubGlobal('ClipboardEvent',class extends Event{clipboardData:unknown;constructor(type:string,init:ClipboardEventInit){super(type,init);this.clipboardData=init.clipboardData;}});
 vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,blob:async()=>new Blob(['image'],{type:'image/png'})})));
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host),commit=vi.fn(),upload=vi.fn(async()=>({id:'new-owned-image',name:'image.png'}));
 try{
 await act(async()=>root.render(<JournalBodyEditor entry={{id:'destination',bodyText:'Keep'}} attachments={[]} onCommit={commit} onUpload={upload}/>));
 const field=host.querySelector<HTMLTextAreaElement>('[data-slash-blocks] textarea')!;field.setSelectionRange(4,4);
 const event=new Event('paste',{bubbles:true,cancelable:true});Object.defineProperty(event,'clipboardData',{value:{files:[],getData:(t:string)=>t==='text/html'?'<p>Copied text</p><img src="data:image/png;base64,YQ=="/><p>After image</p>':''}});
 await act(async()=>{field.dispatchEvent(event);await new Promise(r=>setTimeout(r,0));});
 expect(event.defaultPrevented).toBe(true);expect(upload).toHaveBeenCalledTimes(1);
 const blocks=commit.mock.calls.at(-1)?.[0];expect(blocks.map((b:any)=>b.kind)).toEqual(['text','text','image','text','text']);
 expect(blocks[0].text).toBe('Keep');expect(blocks[1].text).toContain('Copied text');expect(blocks[2].attachmentId).toBe('new-owned-image');expect(blocks[3].text).toContain('After image');
 }finally{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();}
});
