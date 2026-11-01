import {noteDate} from './note-date';
import type {JournalBodyBlock} from '@/server/personal-journal';
export function sessionClipboard(createdAt:string,blocks:JournalBodyBlock[],origin:string,dateOnly=false) {
  const escape=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
  const stamp=dateOnly?noteDate(createdAt):new Intl.DateTimeFormat('ru-RU',{timeZone:'Asia/Qyzylorda',hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit',year:'numeric',hourCycle:'h23'}).format(new Date(createdAt));
  const image=(id:string,name='Скриншот')=>`<img src="${escape(origin)}/api/attachments/${encodeURIComponent(id)}" alt="${escape(name)}" style="max-width:100%;height:auto"/>`;
  const html=blocks.map(b=>b.kind==='image'?image(b.attachmentId,b.name):`<p style="white-space:pre-wrap">${escape(b.text).replace(/\[\[image:([a-zA-Z0-9_-]+)\]\]/g,(_,id)=>image(id))}</p>`).join('');
  const text=stamp+'\n\n'+blocks.map(b=>b.kind==='image'?`${b.name}: ${origin}/api/attachments/${b.attachmentId}`:b.text.replace(/\[\[image:([a-zA-Z0-9_-]+)\]\]/g,(_,id)=>`${origin}/api/attachments/${id}`)).join('\n\n');
  return {text,html:`<section><strong>${escape(stamp)}</strong><hr/>${html}</section>`};
}
export async function sessionClipboardWithImages(createdAt:string,blocks:JournalBodyBlock[],origin:string,dateOnly=false) {
  const result=sessionClipboard(createdAt,blocks,origin,dateOnly);
  const ids=new Set(blocks.flatMap(b=>b.kind==='image'?[b.attachmentId]:[...b.text.matchAll(/\[\[image:([a-zA-Z0-9_-]+)\]\]/g)].map(m=>m[1]!)));
  for(const id of ids) {
    const response=await fetch(`${origin}/api/attachments/${encodeURIComponent(id)}`);
    if(!response.ok)throw Error('Не удалось скопировать скриншот');
    const blob=await response.blob();
    const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);});
    result.html=result.html.replaceAll(`${origin}/api/attachments/${encodeURIComponent(id)}`,data);
  }
  return result;
}
