// @vitest-environment jsdom
import {it,expect,vi} from 'vitest';import {act} from 'react';
import {uploadAttachment} from '../src/components/video-upload';
it('requires preview acceptance before saving and sends cancellation without creating a card attachment',async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});HTMLDialogElement.prototype.showModal=vi.fn();URL.createObjectURL=vi.fn(()=> 'blob:source');URL.revokeObjectURL=vi.fn();
 const fetchMock=vi.fn(async(_url:string,options:{body:FormData})=>options.body.has('videoToken')?new Response(JSON.stringify(options.body.has('cancel')?{cancelled:true}:{id:'saved'})):new Response(JSON.stringify({preview:{token:'preview-token',url:'/api/attachments/preview-token',size:100,originalSize:300,name:'result.mp4',compressed:true}})));
 vi.stubGlobal('fetch',fetchMock);
 const make=()=>{const f=new FormData();f.set('type','workflow');f.set('id','owner');f.set('file',new File(['video'],'capture.mp4',{type:'video/mp4'}));return f;};
 try{
  let pending!:Promise<Response>;await act(async()=>{pending=uploadAttachment(make());await new Promise(r=>setTimeout(r,0));});
  expect(document.body.textContent).toContain('Проверить видео');expect(fetchMock).toHaveBeenCalledTimes(1);
  await act(async()=>{[...document.querySelectorAll('button')].find(b=>b.textContent==='Сохранить видео')!.click();await pending;});
  expect(await (await pending).json()).toEqual({id:'saved'});expect(fetchMock.mock.calls[1]![1].body.get('videoToken')).toBe('preview-token');expect(document.querySelector('dialog')).toBeNull();
  let cancellation!:Promise<unknown>;await act(async()=>{cancellation=uploadAttachment(make()).catch(e=>e);await new Promise(r=>setTimeout(r,0));});
  await act(async()=>{[...document.querySelectorAll('button')].find(b=>b.textContent==='Отмена')!.click();await cancellation;});
  expect(fetchMock.mock.calls.at(-1)![1].body.get('cancel')).toBe('1');expect(document.querySelector('dialog')).toBeNull();
 }finally{vi.unstubAllGlobals();}
});
