import { eq,sql } from "drizzle-orm";
import { db, attachments } from "@/db";
import { handler, ok, bad } from "@/server/api";
import {attachmentRange} from '@/lib/attachment-range';
import {mediaPath,mediaInfo,removeMedia} from '@/server/media-storage';
import {mediaResponse} from '@/server/media-response';
import {existsSync} from 'node:fs';
type Context = { params: Promise<{ id: string }> };
export const GET = handler(async (_request: Request, { params }: Context) => {
  const { id } = await params;
  if(id.startsWith('preview-')){const token=id.slice(8),info=mediaInfo(token,true);if(!info||Date.now()-info.createdAt>24*3600000||!existsSync(mediaPath(token,true)))return bad('Предпросмотр истёк',404);return mediaResponse(mediaPath(token,true),info,_request);}
  if(new URL(_request.url).searchParams.has('metadata')){
    const meta=db.select({mime:attachments.mime,name:attachments.name,size:attachments.size}).from(attachments).where(eq(attachments.id,id)).get();
    const info=meta?mediaInfo(id):undefined;
    return meta?ok({...meta,...(info?{originalSize:info.originalSize,compressed:info.compressed}: {})}):bad('Attachment not found',404);
  }
  const a = db.select({mime:attachments.mime,name:attachments.name,size:attachments.size}).from(attachments).where(eq(attachments.id, id)).get();
  if (!a) return bad("Attachment not found", 404);
  if(existsSync(mediaPath(id)))return mediaResponse(mediaPath(id),a,_request);
  const range=attachmentRange(_request.headers.get('range'),a.size);
  if(range===false)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${a.size}`}});
  const payload=range?db.select({data:sql<Buffer>`substr(${attachments.data},${range.start+1},${range.end-range.start+1})`}).from(attachments).where(eq(attachments.id,id)).get():db.select({data:attachments.data}).from(attachments).where(eq(attachments.id,id)).get();
  if(!payload||(!payload.data.length&&a.size>0))return bad('Файл отсутствует. Восстановите папку media из резервной копии.',404);
  return new Response(new Uint8Array(payload.data), {
    status:range?206:200,
    headers: {
      "Content-Type": a.mime,
      'Accept-Ranges':'bytes',
      'Content-Length':String(range?range.end-range.start+1:a.size),
      ...(range?{'Content-Range':`bytes ${range.start}-${range.end}/${a.size}`} : {}),
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `${a.mime.startsWith("image/")||a.mime.startsWith('video/') ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(a.name)}`,
      "Cache-Control": "private, no-store",
    },
  });
});
export const DELETE = handler(async (_request: Request, { params }: Context) => {
  const { id } = await params;
  db.delete(attachments).where(eq(attachments.id, id)).run();
  removeMedia(id);
  return ok({ deleted: true });
});
