"use client";
import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Copy, Download, Maximize2, Minus, Plus, RotateCcw, X } from "lucide-react";
export function ScreenshotViewer({src,name,showCopy=true}:{src:string;name:string;showCopy?:boolean}) {
  const [copyStatus,setCopyStatus]=useState('');
  async function copy(){
    try{
      const response=await fetch(src);if(!response.ok)throw Error();
      const bitmap=await createImageBitmap(await response.blob());
      const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
      canvas.getContext('2d')!.drawImage(bitmap,0,0);bitmap.close();
      const png=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error()),'image/png'));
      await navigator.clipboard.write([new ClipboardItem({'image/png':png})]);setCopyStatus('Скопировано');
    }catch{setCopyStatus('Не удалось скопировать скриншот. Проверь разрешение на буфер обмена.');}
  }
  const [open,setOpen]=useState(false),[zoom,setZoom]=useState(1),[offset,setOffset]=useState({x:0,y:0});
  const scale=useRef(1),viewport=useRef<HTMLDivElement>(null),image=useRef<HTMLImageElement>(null);
  const drag=useRef<{id:number;x:number;y:number;origin:{x:number;y:number}}|null>(null);
  const clamp=(p:{x:number;y:number},z:number)=>{
    const box=viewport.current,img=image.current;if(!box||!img||z<=1)return{x:0,y:0};
    const x=Math.max(0,(img.clientWidth*z-box.clientWidth)/2),y=Math.max(0,(img.clientHeight*z-box.clientHeight)/2);
    return{x:Math.max(-x,Math.min(x,p.x)),y:Math.max(-y,Math.min(y,p.y))};
  };
  const change=(value:number)=>{const next=Math.max(.25,Math.min(8,value));scale.current=next;setZoom(next);setOffset(old=>clamp(old,next));};
  const reset=()=>{scale.current=1;setZoom(1);setOffset({x:0,y:0});drag.current=null;};
  useEffect(()=>{
    if(!open||!viewport.current)return;const box=viewport.current;
    const wheel=(e:WheelEvent)=>{e.preventDefault();change(scale.current*(e.deltaY<0?1.2:1/1.2));};
    const resize=()=>setOffset(old=>clamp(old,scale.current));
    box.addEventListener("wheel",wheel,{passive:false});window.addEventListener("resize",resize);
    return()=>{box.removeEventListener("wheel",wheel);window.removeEventListener("resize",resize);};
  },[open]);
  const tool="grid size-7 place-items-center rounded-md bg-black/70 text-white hover:bg-black/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400";
  return <>
    {showCopy&&<button type="button" aria-label="Скопировать скриншот" title="Скопировать скриншот" className={tool} onClick={copy}><Copy className="size-4"/></button>}
    {copyStatus&&<button type="button" role="status" className="absolute right-0 top-9 rounded bg-zinc-900 px-3 py-2 text-sm text-white" onClick={()=>setCopyStatus('')}>{copyStatus}</button>}
    <button type="button" aria-label="Увеличить скриншот" title="Увеличить" className={tool} onClick={()=>{window.getSelection()?.removeAllRanges();reset();setOpen(true);}}><Maximize2 className="size-4"/></button>
    <a href={src} download={name} aria-label="Скачать скриншот" title="Скачать" className={tool}><Download className="size-4"/></a>
    <Dialog.Root open={open} onOpenChange={setOpen}><Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-[150] bg-black/85"/>
      <Dialog.Content aria-describedby={undefined} className="fixed inset-3 z-[151] flex flex-col overflow-hidden rounded-xl border bg-background shadow-2xl sm:inset-6">
        <Dialog.Title className="sr-only">Просмотр скриншота</Dialog.Title>
        <div className="flex shrink-0 items-center justify-between gap-3 border-b px-3 py-2">
          <span className="min-w-0 truncate text-sm text-muted-foreground">{name}</span>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" className={tool} aria-label="Уменьшить масштаб" disabled={zoom<=.25} onClick={()=>change(scale.current/1.25)}><Minus className="size-4"/></button>
            <span aria-live="polite" className="w-12 text-center text-xs tabular-nums">{Math.round(zoom*100)}%</span>
            <button type="button" className={tool} aria-label="Увеличить масштаб" disabled={zoom>=8} onClick={()=>change(scale.current*1.25)}><Plus className="size-4"/></button>
            <button type="button" className={tool} aria-label="Сбросить масштаб" onClick={reset}><RotateCcw className="size-4"/></button>
            <a href={src} download={name} aria-label="Скачать оригинал" className={tool}><Download className="size-4"/></a>
            <Dialog.Close className={tool} aria-label="Закрыть просмотр"><X className="size-4"/></Dialog.Close>
          </div>
        </div>
        <div ref={viewport} aria-label="Область просмотра скриншота" className={`relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black/40 touch-none select-none ${zoom>1?"cursor-grab active:cursor-grabbing":""}`}
          onPointerDown={e=>{if(e.button!==0||scale.current<=1)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,origin:offset};}}
          onPointerMove={e=>{const start=drag.current;if(!start||start.id!==e.pointerId)return;setOffset(clamp({x:start.origin.x+e.clientX-start.x,y:start.origin.y+e.clientY-start.y},scale.current));}}
          onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}} onLostPointerCapture={()=>{drag.current=null;}}
          onDoubleClick={()=>scale.current>1?reset():change(2)}>
          <img ref={image} src={src} alt={name} draggable={false} className="block max-h-full max-w-full object-contain" style={{transform:`translate(${offset.x}px, ${offset.y}px) scale(${zoom})`}}/>
        </div>
        <p className="shrink-0 border-t px-3 py-2 text-center text-xs text-muted-foreground">Колесо — масштаб · потяни увеличенный скрин · Esc — закрыть</p>
      </Dialog.Content>
    </Dialog.Portal></Dialog.Root>
  </>;
}
