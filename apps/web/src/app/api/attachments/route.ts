import { and, eq } from "drizzle-orm";
import { db, attachments, trades, notes, missedTrades, propAccounts, propEntries } from "@/db";
import { handler, ok, requireValue } from "@/server/api";
import { newId, nowIso } from "@/server/ids";
import { attachmentMime, MAX_ATTACHMENT_SIZE,MAX_VIDEO_SIZE } from "@/lib/attachment-validation";
import { hasPersonalJournalEntry } from "@/server/personal-journal";
import { hasSessionEntry } from "@/server/session-entries";
import { hasWorkflowCard } from "@/server/workflow";
import {hasReviewAttachmentOwner} from '@/server/trading-review';
import {attachmentUpload} from '@/server/attachment-upload';
import {prepareVideo,acceptVideo} from '@/server/video-compression';
import {mediaInfo,removeMedia} from '@/server/media-storage';
import {readFileSync,openSync,readSync,closeSync,statSync} from 'node:fs';
function owner(type: string, id: string) {
  if(type==='review')return hasReviewAttachmentOwner(id);
  if (type === "workflow") return hasWorkflowCard(id);
  if (type === "session-entry") return hasSessionEntry(id);
  if (type === "personal-journal") return hasPersonalJournalEntry(id);
  if (type === "prop-account")
    return !!db
      .select({ id: propAccounts.id })
      .from(propAccounts)
      .where(eq(propAccounts.id, id))
      .get();
  if (type === "prop-entry")
    return !!db
      .select({ id: propEntries.id })
      .from(propEntries)
      .where(eq(propEntries.id, id))
      .get();
  if (type === "trade")
    return !!db.select({ key: trades.key }).from(trades).where(eq(trades.key, id)).get();
  if (type === "note")
    return !!db.select({ id: notes.id }).from(notes).where(eq(notes.id, id)).get();
  if (type === "missed")
    return !!db
      .select({ id: missedTrades.id })
      .from(missedTrades)
      .where(eq(missedTrades.id, id))
      .get();
  return (
    type === "day" &&
    /^\d{4}-\d{2}-\d{2}$/.test(id) &&
    !isNaN(Date.parse(id)) &&
    new Date(id).toISOString().slice(0, 10) === id
  );
}
export const GET = handler((request: Request) => {
  const p = new URL(request.url).searchParams;
  const type = p.get("type") ?? "",
    id = p.get("id") ?? "";
  requireValue(owner(type, id), "Attachment owner not found.");
  return ok({
    attachments: db
      .select({
        id: attachments.id,
        name: attachments.name,
        mime: attachments.mime,
        size: attachments.size,
      })
      .from(attachments)
      .where(and(eq(attachments.ownerType, type), eq(attachments.ownerId, id)))
      .all(),
  });
});
export const POST = handler(async (request: Request) => {
  const upload=await attachmentUpload(request);
  try{
  const type=upload.fields.type??'',ownerId=upload.fields.id??'';
  requireValue(owner(type, ownerId), "Attachment owner not found.");
  const id=newId();
  if(upload.fields.videoToken){
    const token=upload.fields.videoToken;
    if(upload.fields.cancel==='1'){const info=mediaInfo(token,true);requireValue(info&&info.ownerId===ownerId&&info.ownerType===type,'Некорректное видео');removeMedia(token,true);return ok({cancelled:true});}
    const info=acceptVideo(token,id,type,ownerId);
    try{db.insert(attachments).values({id,ownerType:type,ownerId,name:info.name,mime:info.mime,size:info.size,data:Buffer.alloc(0),createdAt:nowIso()}).run();}catch(error){removeMedia(id);throw error;}
    return ok({id,name:info.name,originalSize:info.originalSize,size:info.size});
  }
  requireValue(upload.path&&statSync(upload.path).size>0,'Выберите файл');
  const header=Buffer.alloc(4096),fd=openSync(upload.path,'r');let length=0;try{length=readSync(fd,header,0,header.length,0);}finally{closeSync(fd);}
  const mime=attachmentMime(header.subarray(0,length));
  requireValue(mime, "Поддерживаются PNG, JPEG, WebP, PDF, MP4 и WebM.");
  requireValue(statSync(upload.path).size<=(mime.startsWith('video/')?MAX_VIDEO_SIZE:MAX_ATTACHMENT_SIZE),'Видео — до 500 МБ, изображения и PDF — до 8 МБ.');
  if(mime.startsWith('video/'))return ok({preview:await prepareVideo(upload.path,upload.name,mime,type,ownerId,request.signal)});
  const bytes=readFileSync(upload.path);
  db.insert(attachments)
    .values({
      id,
      ownerType: type,
      ownerId,
      name: upload.name,
      mime,
      size: bytes.length,
      data: bytes,
      createdAt: nowIso(),
    })
    .run();
  return ok({ id });
  }finally{upload.cleanup();}
});
