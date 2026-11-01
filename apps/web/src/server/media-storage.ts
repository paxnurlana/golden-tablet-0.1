import {dataDir} from '@/db';
import {mkdirSync,existsSync,copyFileSync,linkSync,constants,readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {join} from 'node:path';
export type VideoInfo={originalSize:number;size:number;mime:string;name:string;ownerType:string;ownerId:string;createdAt:number;compressed:boolean};
export function mediaPath(id:string,pending=false,metadata=false){
 if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id))throw Error('Некорректное вложение');
 const folder=join(dataDir(),pending?'video-pending':'media');mkdirSync(folder,{recursive:true});return join(folder,id+(metadata?'.json':'.media'));
}
export function mediaInfo(id:string,pending=false):VideoInfo|undefined{const path=mediaPath(id,pending,true);return existsSync(path)?JSON.parse(readFileSync(path,'utf8')):undefined;}
export function writeMediaInfo(id:string,info:VideoInfo,pending=false){writeFileSync(mediaPath(id,pending,true),JSON.stringify(info),{flag:'wx'});}
export function removeMedia(id:string,pending=false){for(const metadata of [false,true]){const file=mediaPath(id,pending,metadata);try{unlinkSync(file);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}}}
export function cloneMedia(from:string,to:string){
 const file=mediaPath(from);if(!existsSync(file))return;
 try{linkSync(file,mediaPath(to));}catch{copyFileSync(file,mediaPath(to),constants.COPYFILE_EXCL);}
 const info=mediaInfo(from);if(info)writeMediaInfo(to,info);
}
