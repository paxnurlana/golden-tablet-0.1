"use client";
import {Fragment} from 'react';
import {X,GripVertical} from 'lucide-react';
import {AttachmentMedia} from './attachment-media';
import {resizeTextarea} from '@/lib/textarea-height';
import {hasRichImages} from '@/lib/rich-image-paste';
import {isFileDrag,forwardImageDrop} from '@/lib/image-drop';

/** Text slots are real editable fields, including the permanent slot after every image. */
export function InlineScreenshotEditor({text,target,label,onChange,onSelect,partIndex,onMove,sourceStart,indented}:{text:string;target:HTMLTextAreaElement;label:string;onChange:(text:string,caret?:number)=>void;onSelect:(start:number,end:number)=>void;partIndex:number;onMove:(fromPart:number,from:number,to:number)=>void;sourceStart:(offset:number)=>number;indented:boolean}) {
  const images=[...text.matchAll(/\[\[image:([a-zA-Z0-9_-]+)\]\]/g)];
  let cursor=0;
  const slots=images.map(image=>{const slot={start:cursor,end:image.index!,image};cursor=image.index!+image[0].length;return slot;});
  const segments=[...slots,{start:cursor,end:text.length,image:undefined}];
  return <>{segments.map((segment,index)=><Fragment key={index}>
    <textarea data-no-slash data-source-start={sourceStart(segment.start)} data-source-indented={indented} aria-label={index?`${label} — после скриншота ${index}`:label}
      readOnly={target.readOnly} rows={1} value={text.slice(segment.start,segment.end)}
      className="block min-h-8 w-full cursor-text resize-none overflow-hidden bg-transparent text-sm leading-6 outline-none"
      ref={field=>{if(field)resizeTextarea(field,32);}}
      onChange={event=>{
        if(target.readOnly)return;
        const field=event.currentTarget;
        // A slash after an image must start a source line, not follow the hidden image marker.
        const prefix=index>0&&field.value.startsWith('/')?'\n':'';
        const caret=field.selectionStart+prefix.length;
        onChange(text.slice(0,segment.start)+prefix+field.value+text.slice(segment.end),segment.start+caret);
        if(prefix)requestAnimationFrame(()=>field.setSelectionRange(caret,caret));
      }}
      onSelect={event=>onSelect(segment.start+event.currentTarget.selectionStart,segment.start+event.currentTarget.selectionEnd)}
      onBlur={()=>target.dispatchEvent(new FocusEvent('focusout',{bubbles:true}))}
      onKeyDown={event=>{
        // A boundary never removes the continuation or merges it across an image.
        if((event.key==='Backspace'&&event.currentTarget.selectionStart===0)||(event.key==='Delete'&&event.currentTarget.selectionEnd===event.currentTarget.value.length)) {
          if(event.currentTarget.selectionStart===event.currentTarget.selectionEnd)event.preventDefault();
        }
      }}
      onPaste={event=>{
        if(event.clipboardData.files.length||event.clipboardData.getData('application/x-golden-journal-blocks')||(target.dataset.richImagePaste==='true'&&hasRichImages(event.clipboardData))){
          event.preventDefault();onSelect(segment.start+event.currentTarget.selectionStart,segment.start+event.currentTarget.selectionEnd);
          target.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,clipboardData:event.clipboardData}));
        }
      }}
      onDragOver={event=>{if(!target.readOnly&&(event.dataTransfer.types.includes('application/x-golden-inline-image')||(target.dataset.imagePaste==='true'&&isFileDrag(event.dataTransfer)))){event.preventDefault();event.stopPropagation();}}}
      onDrop={event=>{
        if(target.readOnly)return;
        const moved=event.dataTransfer.getData('application/x-golden-inline-image');
        if(moved){event.preventDefault();event.stopPropagation();try{const source=JSON.parse(moved);if(source.owner===target.dataset.workflowSource)onMove(source.part,source.start,segment.start+event.currentTarget.selectionStart);}catch{}return;}
        if(target.dataset.imagePaste!=='true'||!isFileDrag(event.dataTransfer))return;onSelect(segment.start+event.currentTarget.selectionStart,segment.start+event.currentTarget.selectionEnd);if(forwardImageDrop(target,event.dataTransfer)){event.preventDefault();event.stopPropagation();}
      }}
    />
    {segment.image&&<figure className="relative overflow-hidden rounded-lg border">
      <button type="button" draggable={!target.readOnly} disabled={target.readOnly} aria-label="Перетащить скриншот" title="Перетащи в нужную строку" className="absolute left-2 top-2 z-10 grid size-7 cursor-grab place-items-center rounded bg-black/70 text-white active:cursor-grabbing"
        onDragStart={event=>{event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('application/x-golden-inline-image',JSON.stringify({owner:target.dataset.workflowSource,part:partIndex,start:segment.end}));}}><GripVertical className="size-4"/></button>
      <AttachmentMedia src={`/api/attachments/${segment.image[1]}`} name="Вложение пометки"/>
      <button type="button" aria-label="Убрать скриншот из пометки" disabled={target.readOnly} className="absolute right-2 top-2 grid size-6 place-items-center rounded bg-black/60 text-white"
        onClick={()=>{onChange(text.slice(0,segment.end)+text.slice(segment.end+segment.image![0].length));target.dispatchEvent(new FocusEvent('focusout',{bubbles:true}));}}><X className="size-3.5"/></button>
    </figure>}
  </Fragment>)}</>;
}
