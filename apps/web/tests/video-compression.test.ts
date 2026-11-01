import {it,expect,vi,afterAll} from 'vitest';
import {mkdtempSync,existsSync,readFileSync,rmSync,writeFileSync,readdirSync,utimesSync} from 'node:fs';
import {join,resolve} from 'node:path';import {tmpdir} from 'node:os';import {execFileSync} from 'node:child_process';
import ffmpeg from 'ffmpeg-static';
let directory='';vi.mock('@/db',()=>({dataDir:()=>directory}));
import {prepareVideo,acceptVideo,cleanExpiredVideos} from '../src/server/video-compression';
import {mediaPath,cloneMedia,removeMedia,writeMediaInfo} from '../src/server/media-storage';
import {mediaResponse} from '../src/server/media-response';
import {attachmentUpload} from '../src/server/attachment-upload';
afterAll(()=>{if(directory&&resolve(directory).startsWith(resolve(tmpdir())+'\\')&&directory.includes('compression-test-'))rmSync(directory,{recursive:true,force:true});});
it('really encodes a 60fps video, previews it, commits externally, copies safely and serves byte ranges',async()=>{
 directory=mkdtempSync(join(tmpdir(),'compression-test-'));const input=join(directory,'source.mp4');
 execFileSync(ffmpeg!,['-hide_banner','-loglevel','error','-f','lavfi','-i','testsrc2=size=640x360:rate=60','-t','1','-c:v','libx264','-crf','0','-threads','1',input],{windowsHide:true});
 const prepared=await prepareVideo(input,'screen.mp4','video/mp4','workflow','owner');
 expect(prepared.size).toBeLessThan(prepared.originalSize);expect(existsSync(mediaPath(prepared.token,true))).toBe(true);
 expect(()=>acceptVideo(prepared.token,'bad','workflow','other')).toThrow();
 const info=acceptVideo(prepared.token,'accepted','workflow','owner');expect(existsSync(mediaPath(prepared.token,true))).toBe(false);
 const probe=execFileSync(ffmpeg!,['-hide_banner','-i',mediaPath('accepted'),'-f','null','-'],{windowsHide:true,stdio:['ignore','pipe','pipe']});expect(probe).toBeDefined();
 cloneMedia('accepted','copy');removeMedia('accepted');expect(existsSync(mediaPath('copy'))).toBe(true);
 const response=mediaResponse(mediaPath('copy'),info,new Request('http://localhost/api/attachments/copy',{headers:{Range:'bytes=4-11'}}));
 expect(response.status).toBe(206);expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array(readFileSync(mediaPath('copy')).subarray(4,12)));
 const form=new FormData();form.set('type','workflow');form.set('id','owner');form.set('file',new File([readFileSync(mediaPath('copy'))],'copy.mp4',{type:'video/mp4'}));
 const upload=await attachmentUpload(new Request('http://localhost/api/attachments',{method:'POST',body:form}));expect(upload.fields.id).toBe('owner');expect(readFileSync(upload.path!)).toEqual(readFileSync(mediaPath('copy')));upload.cleanup();expect(existsSync(upload.path!)).toBe(false);
},30000);
it('rejects invalid video without leaving previews or replacing existing media',async()=>{
 const input=join(directory,'invalid.mp4');writeFileSync(input,'invalid data');
 await expect(prepareVideo(input,'invalid.mp4','video/mp4','workflow','owner')).rejects.toThrow('Не удалось обработать');
 expect(readdirSync(join(directory,'video-pending'))).toEqual([]);expect(existsSync(mediaPath('copy'))).toBe(true);
});
it('cleans both halves of expired previews and abandoned uploads without touching accepted videos',()=>{
 writeFileSync(mediaPath('expired',true),'old');writeMediaInfo('expired',{originalSize:3,size:3,mime:'video/mp4',name:'old.mp4',ownerId:'owner',ownerType:'workflow',createdAt:0,compressed:false},true);
 const old=new Date(Date.now()-25*3600000);for(const metadata of [false,true])utimesSync(mediaPath('expired',true,metadata),old,old);
 const abandoned=join(directory,'video-upload','abandoned.upload');writeFileSync(abandoned,'old');utimesSync(abandoned,old,old);
 cleanExpiredVideos();expect(existsSync(mediaPath('expired',true))).toBe(false);expect(existsSync(mediaPath('expired',true,true))).toBe(false);expect(existsSync(abandoned)).toBe(false);expect(existsSync(mediaPath('copy'))).toBe(true);
});
