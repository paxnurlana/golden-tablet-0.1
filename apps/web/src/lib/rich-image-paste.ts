export type ClipboardPart={kind:'text';text:string}|{kind:'image';src:string;name:string};
const localAttachment=(src:string,origin:string)=>{try{const url=new URL(src,origin);return url.origin===origin&&/^\/api\/attachments\/[a-zA-Z0-9_-]+$/.test(url.pathname);}catch{return false;}};
const allowed=(src:string,origin:string)=>/^data:image\/(png|jpeg|webp|gif);base64,/i.test(src)||localAttachment(src,origin);
export function hasRichImages(data:Pick<DataTransfer,'getData'>){return clipboardImageParts(data,window.location.origin)!==null;}
export function clipboardImageParts(data:Pick<DataTransfer,'getData'>,origin:string):ClipboardPart[]|null{
 const html=data.getData('text/html');
 if(/<img\b/i.test(html)){
  const doc=new DOMParser().parseFromString(html,'text/html'),parts:ClipboardPart[]=[];
  const text=(s:string)=>{const prev=parts.at(-1);if(prev?.kind==='text')prev.text+=s;else parts.push({kind:'text',text:s});};
  const walk=(node:Node)=>{
   if(node.nodeType===3){text(node.textContent??'');return;}
   if(!(node instanceof Element))return;
   if(['SCRIPT','STYLE','IFRAME','OBJECT'].includes(node.tagName))return;
   if(node.tagName==='IMG'){const src=node.getAttribute('src')??'';if(allowed(src,origin))parts.push({kind:'image',src,name:node.getAttribute('alt')||'image.png'});else text(node.getAttribute('alt')??'');return;}
   if(node.tagName==='BR'||node.tagName==='HR'){text('\n');return;}
   node.childNodes.forEach(walk);if(['P','DIV','SECTION','LI'].includes(node.tagName))text('\n');
  };
  doc.body.childNodes.forEach(walk);
  if(parts.some(p=>p.kind==='image'))return parts;
 }
 const plain=data.getData('text/plain'),parts:ClipboardPart[]=[];
 const pattern=/(?:[^\n:]+\.(?:png|jpe?g|webp|gif):\s*)?(https?:\/\/[^\s]+\/api\/attachments\/[a-zA-Z0-9_-]+)/gi;
 let end=0;for(const match of plain.matchAll(pattern)){if(!localAttachment(match[1]!,origin))continue;parts.push({kind:'text',text:plain.slice(end,match.index)},{kind:'image',src:match[1]!,name:'image.png'});end=match.index!+match[0].length;}
 if(!parts.length)return null;parts.push({kind:'text',text:plain.slice(end)});return parts;
}
export async function clipboardImageFile(part:Extract<ClipboardPart,{kind:'image'}>,origin:string){
 if(!allowed(part.src,origin))throw Error('Недопустимый источник изображения');
 const response=await fetch(part.src,{redirect:'error'});if(!response.ok)throw Error('Не удалось прочитать скриншот');
 const blob=await response.blob();if((!blob.type.startsWith('image/')&&!blob.type.startsWith('video/'))||blob.size>(blob.type.startsWith('video/')?500:8)*1024*1024)throw Error('Недопустимое вложение');
 return new File([blob],part.name,{type:blob.type});
}
