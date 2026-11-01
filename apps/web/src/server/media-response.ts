import {createReadStream,statSync} from 'node:fs';
import {Readable} from 'node:stream';
import {attachmentRange} from '@/lib/attachment-range';
export function mediaResponse(path:string,info:{mime:string;name:string},request:Request){
 const size=statSync(path).size,range=attachmentRange(request.headers.get('range'),size);
 if(range===false)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${size}`}});
 const stream=createReadStream(path,range?{start:range.start,end:range.end}:undefined);
 return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>,{status:range?206:200,headers:{'Content-Type':info.mime,'Content-Length':String(range?range.end-range.start+1:size),'Accept-Ranges':'bytes',...(range?{'Content-Range':`bytes ${range.start}-${range.end}/${size}`} : {}),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Disposition':`inline; filename*=UTF-8''${encodeURIComponent(info.name)}`}});
}
