import ffmpeg from 'ffmpeg-static';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {renameSync,statSync,existsSync,unlinkSync,readdirSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {dataDir} from '@/db';
import {mediaPath,mediaInfo,writeMediaInfo,removeMedia,type VideoInfo} from './media-storage';
import {requireValue} from './api';
let busy=false;
export function cleanExpiredVideos(){
 const pending=dirname(mediaPath('cleanup',true));
 for(const file of readdirSync(pending))if(/^[a-zA-Z0-9_-]+\.(json|media)$/.test(file)&&existsSync(join(pending,file))&&Date.now()-statSync(join(pending,file)).mtimeMs>24*3600000)removeMedia(file.replace(/\.(json|media)$/,''),true);
 const incoming=join(dataDir(),'video-upload');if(existsSync(incoming))for(const file of readdirSync(incoming))if(/^[a-zA-Z0-9_-]+\.upload$/.test(file)&&Date.now()-statSync(join(incoming,file)).mtimeMs>24*3600000)unlinkSync(join(incoming,file));
}
export function encodeVideo(input:string,output:string,signal?:AbortSignal){
 requireValue(ffmpeg&&existsSync(ffmpeg),'Видеокодировщик недоступен. Перезапустите приложение после установки FFmpeg.');
 return new Promise<void>((resolve,reject)=>{
  const child=spawn(ffmpeg!,['-hide_banner','-loglevel','error','-nostdin','-protocol_whitelist','file,pipe','-i',input,'-map','0:v:0','-map','0:a:0?','-vf',"fps=min(source_fps\\,30),pad=ceil(iw/2)*2:ceil(ih/2)*2",'-c:v','libx264','-preset','medium','-crf','21','-threads','2','-pix_fmt','yuv420p','-c:a','aac','-b:a','96k','-map_metadata','-1','-movflags','+faststart','-f','mp4',output],{windowsHide:true,signal,stdio:['ignore','ignore','pipe']});
  let errors='';child.stderr.on('data',data=>{errors=(errors+data).slice(-4000);});const timer=setTimeout(()=>{child.kill();},15*60*1000);
  child.on('error',()=>{});child.on('close',code=>{clearTimeout(timer);code===0?resolve():reject(Error(signal?.aborted?'Обработка видео отменена':'Не удалось обработать видео. Проверь файл или сократи длительность. '+errors.slice(-250)));});
 });
}
export async function prepareVideo(input:string,name:string,mime:string,ownerType:string,ownerId:string,signal?:AbortSignal){
 requireValue(!busy,'Другое видео уже сжимается. Дождись окончания и повтори вставку.');busy=true;
 const token=randomUUID(),output=mediaPath(token,true);
 try{
  cleanExpiredVideos();const originalSize=statSync(input).size;await encodeVideo(input,output,signal);const encodedSize=statSync(output).size;
  // Never keep a larger transcode merely to claim that compression happened.
  const compressed=encodedSize<originalSize;
  if(!compressed){unlinkSync(output);renameSync(input,output);}
  const info:VideoInfo={originalSize,size:compressed?encodedSize:originalSize,mime:compressed?'video/mp4':mime,name:compressed?name.replace(/\.[^.]+$/,'')+'.mp4':name,ownerType,ownerId,createdAt:Date.now(),compressed};
  writeMediaInfo(token,info,true);return {token,...info,url:`/api/attachments/preview-${token}`};
 }catch(error){removeMedia(token,true);throw error;}finally{busy=false;}
}
export function acceptVideo(token:string,id:string,type:string,ownerId:string){
 const info=mediaInfo(token,true);requireValue(info&&info.ownerType===type&&info.ownerId===ownerId&&Date.now()-info.createdAt<24*3600000,'Предпросмотр истёк. Добавь видео заново.');
 renameSync(mediaPath(token,true),mediaPath(id));try{writeMediaInfo(id,info);removeMedia(token,true);}catch(error){removeMedia(id);throw error;}return info;
}
