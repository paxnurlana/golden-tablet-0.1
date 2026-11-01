"use client";
import {useEffect,useRef,useState} from 'react';
import {ScreenshotViewer} from './screenshot-viewer';
export function VideoPlayer({src,name}:{src:string;name:string}){
 const video=useRef<HTMLVideoElement>(null),[speed,setSpeed]=useState(1),[error,setError]=useState(false);
 const seek=(seconds:number)=>{const player=video.current;if(!player)return;const duration=Number.isFinite(player.duration)?player.duration:Infinity;player.currentTime=Math.max(0,Math.min(duration,player.currentTime+seconds));};
 return <div className="w-full bg-black/90 pt-10" data-video-player>
  <video ref={video} src={src} controls playsInline preload="metadata" aria-label={name} onError={()=>setError(true)} onLoadedMetadata={()=>{if(video.current)video.current.playbackRate=speed;}} className="max-h-[720px] w-full"/>
  <div className="flex flex-wrap items-center justify-center gap-3 px-3 py-2 text-sm text-white">
   <button type="button" aria-label="Назад на 10 секунд" className="rounded px-3 py-1 hover:bg-white/15" onClick={()=>seek(-10)}>−10 сек</button>
   <label className="flex items-center gap-2">Скорость<select aria-label="Скорость видео" className="rounded border border-white/20 bg-zinc-900 px-2 py-1" value={speed} onChange={event=>{const value=Number(event.target.value);setSpeed(value);if(video.current)video.current.playbackRate=value;}}>{[1,1.5,2,3].map(value=><option key={value} value={value}>{String(value).replace('.',',')}×</option>)}</select></label>
   <button type="button" aria-label="Вперёд на 10 секунд" className="rounded px-3 py-1 hover:bg-white/15" onClick={()=>seek(10)}>+10 сек</button>
   <a href={src} download={name} className="text-xs text-zinc-300 hover:text-white">Скачать</a>
  </div>
  {error&&<p role="alert" className="p-3 text-sm text-amber-300">Браузер не смог воспроизвести видео. Скачай файл или используй MP4 с кодеком H.264.</p>}
 </div>;
}
/** The legacy image block/marker is a visual-attachment slot; its MIME, not its name, selects the renderer. */
export function AttachmentMedia({src,name='Вложение',mime,showCopy=true}:{src:string;name?:string;mime?:string;showCopy?:boolean}){
 const initial=mime??(/\.(mp4|webm)$/i.test(name)?'video/mp4':'image/unknown');
 const [type,setType]=useState(initial),[failed,setFailed]=useState(false),[sizes,setSizes]=useState<{originalSize:number;size:number}|null>(null);
 useEffect(()=>{if(mime){setType(mime);return;}let active=true;setType(initial);setFailed(false);setSizes(null);void fetch(`${src}?metadata=1`).then(async response=>{if(!response.ok)throw Error();const data=await response.json();if(active&&typeof data.mime==='string'){setType(data.mime);if(data.originalSize)setSizes({originalSize:data.originalSize,size:data.size});}}).catch(()=>{if(active)setFailed(true);});return()=>{active=false;};},[src,mime,initial]);
 if(type.startsWith('video/'))return <><VideoPlayer src={src} name={name}/>{sizes&&<p className="bg-black/90 px-3 pb-2 text-xs text-zinc-400">{(sizes.originalSize/1048576).toFixed(1)} → {(sizes.size/1048576).toFixed(1)} МБ</p>}</>;
 if(!type&&!failed)return <div role="status" className="p-5 text-sm text-muted-foreground">Загружаем вложение…</div>;
 return <><img draggable={false} src={src} alt={name} className="h-auto w-full"/><div className="absolute right-[76px] top-2 flex gap-2"><ScreenshotViewer src={src} name={name} showCopy={showCopy}/></div></>;
}
