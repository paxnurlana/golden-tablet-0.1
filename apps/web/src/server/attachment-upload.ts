import Busboy from 'busboy';
import {Readable,Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {createWriteStream,mkdirSync,unlinkSync} from 'node:fs';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {dataDir} from '@/db';
import {MAX_VIDEO_SIZE} from '@/lib/attachment-validation';
import {requireValue} from './api';
/** Spool multipart files to disk: a 500 MB screen recording must not become a 500 MB Buffer. */
export async function attachmentUpload(request:Request){
 requireValue(request.body,'Нет файла');
 requireValue(Number(request.headers.get('content-length')??0)<=MAX_VIDEO_SIZE+65536,'Видео — до 500 МБ');
 const directory=join(dataDir(),'video-upload');mkdirSync(directory,{recursive:true});const path=join(directory,randomUUID()+'.upload');
 const fields:Record<string,string>={};let filename='',hasFile=false,invalid=false,total=0;
 const writes:Promise<void>[]=[];
 try{
  const parser=Busboy({headers:Object.fromEntries(request.headers),defParamCharset:'utf8',limits:{fileSize:MAX_VIDEO_SIZE,files:1,fields:8,fieldSize:2048,parts:10}});
  parser.on('field',(key,value,info)=>{if(info.valueTruncated)invalid=true;fields[key]=value;});
  parser.on('file',(_key,stream,info)=>{hasFile=true;filename=(info.filename??'Вложение').slice(0,200);stream.on('limit',()=>{invalid=true;});const writing=pipeline(stream,createWriteStream(path,{flags:'wx'}));writing.catch(()=>{});writes.push(writing);});
  for(const event of ['filesLimit','fieldsLimit','partsLimit'] as const)parser.on(event,()=>{invalid=true;});
  const counter=new Transform({transform(chunk,_encoding,done){total+=chunk.length;done(total>MAX_VIDEO_SIZE+65536?Error('Видео — до 500 МБ'):null,chunk);}});
  await pipeline(Readable.fromWeb(request.body as import('node:stream/web').ReadableStream),counter,parser);await Promise.all(writes);
  requireValue(!invalid,'Файл слишком большой или некорректная загрузка');
  return {fields,path:hasFile?path:undefined,name:filename,cleanup:()=>{if(hasFile)try{unlinkSync(path);}catch{}}};
 }catch(error){await Promise.allSettled(writes);if(hasFile)try{unlinkSync(path);}catch{}throw error;}
}
