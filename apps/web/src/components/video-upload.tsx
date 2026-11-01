"use client";
import {createRoot} from 'react-dom/client';
import {useEffect,useRef} from 'react';
import {VideoPlayer} from './attachment-media';
type Preview={token:string;url:string;name:string;size:number;originalSize:number;compressed:boolean};
const mb=(size:number)=>(size/1024/1024).toLocaleString('ru-RU',{maximumFractionDigits:1})+' МБ';
function PreviewDialog({preview,original,cancel,accept}:{preview?:Preview;original?:string;cancel:()=>void;accept:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{dialog.current?.showModal();},[]);
 return <dialog ref={dialog} onCancel={event=>{event.preventDefault();cancel();}} className="fixed inset-0 m-auto max-h-[90vh] w-[min(1100px,94vw)] overflow-y-auto rounded-xl border bg-background p-5 text-foreground shadow-2xl backdrop:bg-black/75">
  <h2 className="text-lg font-semibold">{preview?'Проверить видео перед сохранением':'Загрузка и сжатие видео…'}</h2>
  {preview?<><p className="my-3 text-sm">Было {mb(preview.originalSize)} → стало {mb(preview.size)}{preview.compressed?` · меньше на ${Math.round((1-preview.size/preview.originalSize)*100)}%`:' · исходник уже компактнее: оставляем его без увеличения размера'}</p>
   <p className="mb-3 text-xs text-muted-foreground">Проверь читаемость цифр на графике. Исходное разрешение сохранено, частота — не выше 30 кадров/с.</p>
   <div className="grid gap-3 md:grid-cols-2">{original&&<div><h3 className="mb-1 text-sm">Исходник</h3><VideoPlayer src={original} name="Исходное видео"/></div>}<div><h3 className="mb-1 text-sm">Будет сохранено</h3><VideoPlayer src={preview.url} name={preview.name}/></div></div>
  </>:<p className="py-6 text-sm text-muted-foreground">Обрабатываем по одному видео, чтобы не перегружать компьютер. Большая запись может занять несколько минут.</p>}
  <div className="mt-4 flex justify-end gap-3"><button type="button" className="rounded-lg border px-4 py-2" onClick={cancel}>Отмена</button>{preview&&<button type="button" className="rounded-lg bg-primary px-4 py-2 text-primary-foreground" onClick={accept}>Сохранить видео</button>}</div>
 </dialog>;
}
/** All owners use the same compression/preview/confirmation flow. */
export async function uploadAttachment(form:FormData):Promise<Response>{
 const file=form.get('file'),video=file instanceof File&&(['video/mp4','video/webm'].includes(file.type)||/\.(mp4|webm)$/i.test(file.name));
 if(!video)return fetch('/api/attachments',{method:'POST',body:form});
 const previous=document.activeElement as HTMLElement|null,container=document.createElement('div');document.body.append(container);const root=createRoot(container),controller=new AbortController();let preview:Preview|undefined,objectUrl:string|undefined;
 const cancel=()=>controller.abort();
 try{
  root.render(<PreviewDialog cancel={cancel} accept={()=>{}}/>);
  const response=await fetch('/api/attachments',{method:'POST',body:form,signal:controller.signal});if(!response.ok)return response;
  const data=await response.clone().json();if(!data.preview)return response;preview=data.preview;
  objectUrl=URL.createObjectURL(file);
  const accepted=await new Promise<boolean>(resolve=>{root.render(<PreviewDialog preview={preview} original={objectUrl} cancel={()=>resolve(false)} accept={()=>resolve(true)}/>);});
  const confirmation=new FormData();confirmation.set('type',String(form.get('type')));confirmation.set('id',String(form.get('id')));confirmation.set('videoToken',preview!.token);if(!accepted)confirmation.set('cancel','1');
  const saved=await fetch('/api/attachments',{method:'POST',body:confirmation});if(!accepted)throw Error('Вставка видео отменена');return saved;
 }catch(error){if(controller.signal.aborted)throw Error('Вставка видео отменена');throw error;}
 finally{if(objectUrl)URL.revokeObjectURL(objectUrl);root.unmount();container.remove();previous?.focus({preventScroll:true});}
}
