// @vitest-environment jsdom
import {it,expect,vi} from 'vitest';
import {act} from 'react';import {createRoot} from 'react-dom/client';
import {VideoPlayer,AttachmentMedia} from '../src/components/attachment-media';
import {droppedImages} from '../src/lib/image-drop';
it('plays local attachments with selectable speed and bounded ten-second seeking',async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{
  await act(async()=>root.render(<VideoPlayer src="/api/attachments/video" name="Recording.mp4"/>));
  const video=host.querySelector('video')!;Object.defineProperty(video,'duration',{value:25});
  expect(video.controls).toBe(true);expect(video.preload).toBe('metadata');
  const speed=host.querySelector<HTMLSelectElement>('[aria-label="Скорость видео"]')!;expect([...speed.options].map(o=>o.value)).toEqual(['1','1.5','2','3']);
  await act(async()=>{speed.value='3';speed.dispatchEvent(new Event('change',{bubbles:true}));});expect(video.playbackRate).toBe(3);
  const next=host.querySelector<HTMLButtonElement>('[aria-label="Вперёд на 10 секунд"]')!,back=host.querySelector<HTMLButtonElement>('[aria-label="Назад на 10 секунд"]')!;
  next.click();expect(video.currentTime).toBe(10);back.click();back.click();expect(video.currentTime).toBe(0);video.currentTime=20;next.click();expect(video.currentTime).toBe(25);
  vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({mime:'video/mp4'})})));
  await act(async()=>root.render(<AttachmentMedia src="/api/attachments/unknown"/>));expect(host.querySelector('video')).not.toBeNull();
  expect(droppedImages({files:[new File(['video'],'capture.mp4',{type:'video/mp4'})]} as unknown as DataTransfer)).toHaveLength(1);
 }finally{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();}
});
