"use client";
import { SlashTextarea } from "@/components/slash-textarea";
import { useEffect, useRef, useState, Fragment, type MutableRefObject } from "react";
import { resizeTextarea } from "@/lib/textarea-height";
import { X, Copy, GripVertical, Plus } from "lucide-react";
import {moveEditorBlock} from '@/lib/move-editor-block';
import {droppedImages,isFileDrag} from '@/lib/image-drop';
import {clipboardImageParts,clipboardImageFile,type ClipboardPart} from '@/lib/rich-image-paste';
import {AttachmentMedia} from './attachment-media';
import { selectedTextSlice } from "@/lib/editor-selection";
import type { JournalBodyBlock, JournalEntry } from "@/server/personal-journal";

export function JournalBodyEditor({
  entry,
  attachments,
  onCommit,
  onUpload,
  onDraft,
  compact = false,
  workflowUrl,
  workflowLabel,
  imagePasteRef,
}: {
  entry: Pick<JournalEntry, "id" | "bodyText" | "bodyBlocks">;
  attachments: { id: string; name: string; mime: string }[];
  onCommit: (blocks: JournalBodyBlock[]) => void;
  onUpload: (file: File) => Promise<{ id: string; name: string } | undefined>;
  onDraft?: (blocks: JournalBodyBlock[]) => void;
  compact?: boolean;
  workflowUrl?: string;
  workflowLabel?: string;
  imagePasteRef?: MutableRefObject<((file: File) => Promise<void>) | null>;
}) {
  const [blocks, setBlocks] = useState<JournalBodyBlock[]>(
    entry.bodyBlocks?.length ? entry.bodyBlocks : [{ id: `text-${entry.id}`, kind: "text", text: entry.bodyText }],
  );
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const focusId = useRef<string | null>(null);
  const root = useRef<HTMLDivElement | null>(null);
  const latest = useRef(blocks);
  const draggedBlock=useRef<string|null>(null);
  const dropAt=useRef<{id:string;after:boolean}|null>(null);
  const clearDrag=()=>{draggedBlock.current=null;dropAt.current=null;root.current?.querySelectorAll('[data-drop-position]').forEach(el=>el.removeAttribute('data-drop-position'));};
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [copiedImage, setCopiedImage] = useState<string | null>(null);
  useEffect(() => {
    if (!copiedImage) return;
    const timer=setTimeout(()=>setCopiedImage(null),2500);
    return ()=>clearTimeout(timer);
  },[copiedImage]);
  latest.current = blocks;
  useEffect(() => {
    const selected = () => {
      const selection = window.getSelection();
      if (!selection?.rangeCount || selection.isCollapsed || !root.current) return null;
      const range = selection.getRangeAt(0);
      if (range.collapsed) return null;
      return root.current.contains(range.startContainer) && root.current.contains(range.endContainer) ? range : null;
    };
    const inspect = (range: Range) => {
      const copied: JournalBodyBlock[] = [];
      const next = latest.current.flatMap((block): JournalBodyBlock[] => {
        const wrapper = root.current?.querySelector<HTMLElement>(`[data-editor-block="${block.id}"]`);
        if (!wrapper || !range.intersectsNode(wrapper)) return [block];
        if (block.kind === "image") { copied.push(block); return []; }
        const parts = [...wrapper.querySelectorAll<HTMLElement>("[data-slash-part]")];
        if (!parts.length) return [block];
        const remaining: string[] = [], extracted: string[] = [];
        for (const part of parts) {
          const textarea = part.querySelector<HTMLTextAreaElement>("textarea")!;
          const label = part.querySelector<HTMLButtonElement>('button[aria-label^="Изменить тип"]')?.textContent?.trim();
          const encode = (text: string) => label ? `${label} ${text.replaceAll("\n", "\n\t")}` : text;
          if (!range.intersectsNode(part)) { remaining.push(encode(textarea.value)); continue; }
          const slice = selectedTextSlice(range, textarea, textarea.value);
          if (!slice) { extracted.push(encode(textarea.value)); continue; }
          extracted.push(encode(textarea.value.slice(slice.start, slice.end)));
          if (slice.start || slice.end < textarea.value.length)
            remaining.push(encode(textarea.value.slice(0, slice.start) + textarea.value.slice(slice.end)));
        }
        if (extracted.length) copied.push({ ...block, text: extracted.join("\n") });
        return remaining.length ? [{ ...block, text: remaining.join("\n") }] : [];
      });
      return { copied, next };
    };
    const remove = (next: JournalBodyBlock[]) => {
      const safe = next.length ? next : [{ id: crypto.randomUUID(), kind: "text" as const, text: "" }];
      for (const previous of latest.current) {
        if (previous.kind !== "text") continue;
        const updated = safe.find(b => b.id === previous.id);
        const text = updated?.kind === "text" ? updated.text : "";
        if (text === previous.text) continue;
        const target = root.current?.querySelector<HTMLTextAreaElement>(`textarea[data-block-id="${previous.id}"]`);
        if (target) {
          Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(target, text);
          target.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }
      latest.current = safe; setBlocks(safe); onDraft?.(safe); onCommit(safe);
      window.getSelection()?.removeAllRanges(); setSelectedImage(null);
    };
    const keys = (event: KeyboardEvent) => {
      if (pending || !["Backspace", "Delete"].includes(event.key)) return;
      const range = selected();
      if (!range) return;
      event.preventDefault(); event.stopImmediatePropagation(); remove(inspect(range).next);
    };
    const clipboard = (event: ClipboardEvent) => {
      const range = selected();
      if (!range || !event.clipboardData) return;
      const { copied, next } = inspect(range);
      if (!copied.length) return;
      event.preventDefault();
      event.clipboardData.setData("application/x-golden-journal-blocks", JSON.stringify(copied));
      event.clipboardData.setData("text/plain", copied.map(b => b.kind === "text" ? b.text : b.name).join("\n"));
      const container = document.createElement("div");
      for (const block of copied) {
        const element = document.createElement(block.kind === "image" ? "img" : "p");
        if (block.kind === "image") { element.setAttribute("src", `${location.origin}/api/attachments/${block.attachmentId}`); element.setAttribute("alt", block.name); }
        else { element.textContent = block.text; element.style.whiteSpace = "pre-wrap"; }
        container.append(element);
      }
      event.clipboardData.setData("text/html", container.innerHTML);
      if (event.type === "cut" && !pending) remove(next);
    };
    document.addEventListener("keydown", keys, true);
    document.addEventListener("copy", clipboard);
    document.addEventListener("cut", clipboard);
    return () => { document.removeEventListener("keydown", keys, true); document.removeEventListener("copy", clipboard); document.removeEventListener("cut", clipboard); };
  }, [pending, onCommit, onDraft]);
  const grow = (element: HTMLTextAreaElement) => {
    if(element.closest('[data-slash-blocks]')) return;
    resizeTextarea(element);
  };
  const focusText = (id:string,end=false) => requestAnimationFrame(()=>{
    const source=root.current?.querySelector<HTMLTextAreaElement>(`textarea[data-block-id='${id}']`);
    const fields=source?.previousElementSibling?.querySelectorAll<HTMLTextAreaElement>('textarea');
    const visible=source?.style.display==='none'?(end?fields?.[fields.length-1]:fields?.[0]):source;
    if(visible){visible.focus();const position=end?visible.value.length:0;visible.setSelectionRange(position,position);}
  });
  useEffect(() => {
    if (!pending && entry.bodyBlocks === undefined && attachments.length)
      setBlocks((old) => {
        const missing = attachments.filter(
          (file) =>
            (file.mime.startsWith("image/")||file.mime.startsWith('video/')) &&
            !old.some((block) => block.kind === "image" && block.attachmentId === file.id),
        );
        return missing.length
          ? [
              ...old,
              ...missing.map((file) => ({
                id: `image-${file.id}`,
                kind: "image" as const,
                attachmentId: file.id,
                name: file.name,
              })),
              { id: crypto.randomUUID(), kind: "text", text: "" },
            ]
          : old;
      });
  }, [attachments, entry.bodyBlocks, pending]);
  useEffect(() => {
    root.current?.querySelectorAll<HTMLTextAreaElement>("textarea").forEach(grow);
    if (focusId.current) {
      focusText(focusId.current);
      focusId.current = null;
    }
  }, [blocks]);
  const pasteRich = async(parts:ClipboardPart[],blockId:string,text:string,start:number,end:number)=>{
    if(pending)return;setPending(true);setError('');
    try{
      if(parts.length>400)throw Error('Слишком большая заметка');
      const inserted:JournalBodyBlock[]=[];
      for(const part of parts){
        if(part.kind==='text'){inserted.push({id:crypto.randomUUID(),kind:'text',text:part.text});continue;}
        const uploaded=await onUpload(await clipboardImageFile(part,window.location.origin));if(!uploaded)throw Error('Не удалось вставить скриншот');
        inserted.push({id:crypto.randomUUID(),kind:'image',attachmentId:uploaded.id,name:uploaded.name});
      }
      const before=text.slice(0,start),after=text.slice(end),afterId=crypto.randomUUID();
      const lines=before.split('\n');let line=lines.length-1;while(line>0&&lines[line]!.startsWith('\t'))line--;
      const command=/^\/[\p{L}\p{N}_-]{1,40}[ \t]/u.test(lines[line]!);
      const next=command?latest.current.map(b=>b.id!==blockId?b:{...b,text:before+'\n\t'+inserted.map(p=>p.kind==='text'?p.text.replaceAll('\n','\n\t'):`[[image:${p.attachmentId}]]`).join('\n\t')+'\n\t'+after} as JournalBodyBlock):latest.current.flatMap((b):JournalBodyBlock[]=>b.id!==blockId?[b]:[{id:b.id,kind:'text',text:before},...inserted,{id:afterId,kind:'text',text:after}]);
      latest.current=next;setBlocks(next);focusId.current=command?blockId:afterId;onDraft?.(next);onCommit(next);
    }catch(e){setError(e instanceof Error?e.message:'Не удалось вставить заметку');}finally{setPending(false);}
  };
  const paste = async (files: File[], blockId: string, text: string, start: number, end: number) => {
    if(pending)return;
    setPending(true);
    setError("");
    try {
      const uploadedFiles:{id:string;name:string}[]=[];
      for(const file of files){const uploaded=await onUpload(file);if(!uploaded)throw new Error('Не удалось вставить скриншот');uploadedFiles.push(uploaded);}
      const before = text.slice(0, start);
      const lines = before.split("\n");
      let line = lines.length - 1;
      while (line > 0 && lines[line]!.startsWith("\t")) line--;
      if (/^\/[\p{L}\p{N}_-]{1,40}[ \t]/u.test(lines[line]!)) {
        const separator=before.endsWith('\n\t')?'':before.endsWith('\n')?'\t':'\n\t';
        const value = before + separator + uploadedFiles.map(uploaded=>`[[image:${uploaded.id}]]`).join('\n\t')+'\n\t'+text.slice(end);
        const next = latest.current.map(b => b.id === blockId ? { ...b, text: value } as JournalBodyBlock : b);
        latest.current = next; setBlocks(next); onDraft?.(next); onCommit(next);
        requestAnimationFrame(() => {
          const target = root.current?.querySelector<HTMLTextAreaElement>(`textarea[data-block-id="${blockId}"]`);
          if (target) { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(target, value); target.setSelectionRange(before.length, before.length); target.dispatchEvent(new Event("input", { bubbles: true })); }
        });
        return;
      }
      const afterId = crypto.randomUUID();
      // The empty line at the caret becomes the image, not a paragraph above it.
      const prefix=before.endsWith('\n')?before.slice(0,-1):before;
      const next = latest.current.flatMap((block): JournalBodyBlock[] =>
        block.id === blockId
          ? [
              ...(prefix ? [{ id: block.id, kind: "text" as const, text: prefix }] : []),
              ...uploadedFiles.map(uploaded=>({
                id: crypto.randomUUID(),
                kind: "image" as const,
                attachmentId: uploaded.id,
                name: uploaded.name,
              })),
              { id: afterId, kind: "text", text: text.slice(end) },
            ]
          : [block],
      );
      focusId.current = afterId;
      latest.current=next;
      setBlocks(next);
      onCommit(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ошибка вставки");
    } finally {
      setPending(false);
    }
  };
  useEffect(() => {
    if (!imagePasteRef) return;
    imagePasteRef.current = async (file) => {
      setPending(true); setError('');
      try {
        const uploaded=await onUpload(file);
        if(!uploaded)throw new Error('Не удалось вставить скриншот');
        const afterId=crypto.randomUUID();
        const next:JournalBodyBlock[]=[...latest.current,{id:crypto.randomUUID(),kind:'image',attachmentId:uploaded.id,name:uploaded.name},{id:afterId,kind:'text',text:''}];
        latest.current=next;focusId.current=afterId;setBlocks(next);onDraft?.(next);onCommit(next);
      } catch(cause){setError(cause instanceof Error?cause.message:'Ошибка вставки');}
      finally{setPending(false);}
    };
    return()=>{imagePasteRef.current=null;};
  });
  return (
    <div
      ref={root}
      data-workflow-owner={`journal-body:${entry.id}`}
      data-workflow-url={workflowUrl ?? `/trades?entry=${entry.id}`}
      data-workflow-label={workflowLabel}
      className={compact ? "space-y-2 pb-16" : "mt-5 min-h-72 space-y-3 pb-32"}
      onDragOver={event=>{
        if(isFileDrag(event.dataTransfer)){event.preventDefault();event.stopPropagation();event.dataTransfer.dropEffect='copy';return;}
        if(!draggedBlock.current||pending)return;
        const block=(event.target as HTMLElement).closest<HTMLElement>('[data-editor-block]');
        if(!block||!root.current?.contains(block)||block.dataset.editorBlock===draggedBlock.current){dropAt.current=null;root.current?.querySelectorAll('[data-drop-position]').forEach(el=>el.removeAttribute('data-drop-position'));return;}
        event.preventDefault();event.dataTransfer.dropEffect='move';
        root.current.querySelectorAll('[data-drop-position]').forEach(el=>el.removeAttribute('data-drop-position'));
        const rect=block.getBoundingClientRect();const after=event.clientY>rect.top+rect.height/2;
        block.dataset.dropPosition=after?'after':'before';dropAt.current={id:block.dataset.editorBlock!,after};
      }}
      onDrop={event=>{
        const files=droppedImages(event.dataTransfer);
        if(files.length){
          event.preventDefault();event.stopPropagation();if(pending)return;
          const anchor=(event.target as HTMLElement).closest<HTMLElement>('[data-editor-block]');const anchorId=anchor?.dataset.editorBlock;const after=anchor?event.clientY>anchor.getBoundingClientRect().top+anchor.getBoundingClientRect().height/2:true;
          setPending(true);setError('');
          void(async()=>{try{
            const images:JournalBodyBlock[]=[];for(const file of files){const uploaded=await onUpload(file);if(!uploaded)throw new Error('Не удалось вставить изображение');images.push({id:crypto.randomUUID(),kind:'image',attachmentId:uploaded.id,name:uploaded.name});}
            const next=[...latest.current],index=anchorId?next.findIndex(b=>b.id===anchorId):-1;const afterId=crypto.randomUUID();next.splice(index<0?next.length:index+(after?1:0),0,...images,{id:afterId,kind:'text',text:''});
            latest.current=next;focusId.current=afterId;setBlocks(next);onDraft?.(next);onCommit(next);
          }catch(cause){setError(cause instanceof Error?cause.message:'Ошибка загрузки');}finally{setPending(false);}})();return;
        }
        if(!draggedBlock.current||!dropAt.current||pending)return;
        event.preventDefault();event.stopPropagation();
        const next=moveEditorBlock(latest.current,draggedBlock.current,dropAt.current.id,dropAt.current.after);
        latest.current=next;setBlocks(next);onDraft?.(next);onCommit(next);clearDrag();
      }}
      onMouseDown={event=>{
        if(event.target!==event.currentTarget||pending)return;
        event.preventDefault();
        const last=latest.current.at(-1);
        if(last?.kind==='text')focusText(last.id,true);
        else {const id=crypto.randomUUID();const next:JournalBodyBlock[]=[...latest.current,{id,kind:'text',text:''}];latest.current=next;setBlocks(next);focusId.current=id;onDraft?.(next);}
      }}
    >
      {blocks.map((block,index) =>
        block.kind === "text" ? (
          <div key={block.id} data-editor-block={block.id}><SlashTextarea
            data-block-id={block.id}
            aria-label="Основной текст"
            rows={1}
            value={block.text}
            readOnly={pending}
            placeholder={
              blocks.length === 1
                ? "Основной текст. Вставляй скриншоты Ctrl+V."
                : ""
            }
            onChange={(event) => {
              const value = event.target.value;
              grow(event.currentTarget);
              const next = latest.current.map((item) =>
                item.id === block.id ? { ...block, text: value } : item,
              );
              latest.current = next;
              setBlocks(next);
              onDraft?.(next);
            }}
            onBlur={() => {
              if (!pending) onCommit(latest.current);
            }}
            data-rich-image-paste="true"
            onPaste={(event) => {
              const rich=clipboardImageParts(event.clipboardData,window.location.origin);
              if(rich){event.preventDefault();void pasteRich(rich,block.id,event.currentTarget.value,event.currentTarget.selectionStart,event.currentTarget.selectionEnd);return;}
              const copied = event.clipboardData.getData("application/x-golden-journal-blocks");
              if (copied && !pending) {
                try {
                  const parsed: unknown = JSON.parse(copied);
                  if (Array.isArray(parsed) && parsed.length <= 200 && parsed.every(b =>
                    b && ((b.kind === "text" && typeof b.text === "string") ||
                    (b.kind === "image" && typeof b.attachmentId === "string" && /^[a-zA-Z0-9-]+$/.test(b.attachmentId) && typeof b.name === "string")))) {
                    event.preventDefault();
                    const value = event.currentTarget.value, start = event.currentTarget.selectionStart, end = event.currentTarget.selectionEnd;
                    const afterId = crypto.randomUUID();
                    const next = latest.current.flatMap((item): JournalBodyBlock[] => item.id !== block.id ? [item] : [
                      { id: item.id, kind: "text", text: value.slice(0, start) },
                      ...parsed.map(b => ({ ...b, id: crypto.randomUUID() })),
                      { id: afterId, kind: "text", text: value.slice(end) },
                    ]);
                    latest.current = next; setBlocks(next); focusId.current = afterId; onDraft?.(next); onCommit(next); return;
                  }
                } catch { /* ordinary paste remains available */ }
              }
              const files = droppedImages(event.clipboardData);
              if (files.length) {
                event.preventDefault();
                void paste(
                  files,
                  block.id,
                  event.currentTarget.value,
                  event.currentTarget.selectionStart,
                  event.currentTarget.selectionEnd,
                );
              }
            }}
            onKeyDown={(event) => {
              if (pending || event.nativeEvent.isComposing || !["Backspace", "Delete"].includes(event.key) || event.currentTarget.selectionStart !== event.currentTarget.selectionEnd) return;
              const index = latest.current.findIndex(item => item.id === block.id);
              const backward = event.key === "Backspace";
              const boundary = backward ? event.currentTarget.selectionStart === 0 : event.currentTarget.selectionEnd === event.currentTarget.value.length;
              if (!boundary) return;
              const neighbor = latest.current[index + (backward ? -1 : 1)];
              if (!event.currentTarget.value.trim() && latest.current.length > 1) {
                event.preventDefault();
                const next = latest.current.filter(item => item.id !== block.id);
                latest.current = next; setBlocks(next); onDraft?.(next); onCommit(next);
                const destination = next[Math.max(0,index-1)];
                if (destination?.kind === "text") focusText(destination.id,true);
                else requestAnimationFrame(()=>root.current?.querySelector<HTMLElement>(`figure[data-editor-block="${destination?.id}"]`)?.focus());
                return;
              }
              if (neighbor?.kind === "text") {
                event.preventDefault();
                const left = backward ? neighbor : block, right = backward ? block : neighbor;
                const next = latest.current.flatMap(item => item.id === left.id ? [{...left,text:left.text+"\n"+right.text}] : item.id === right.id ? [] : [item]);
                latest.current=next;setBlocks(next);onDraft?.(next);onCommit(next);focusText(left.id,backward);
                return;
              }
              if (
                event.key === "Backspace" &&
                event.currentTarget.selectionStart === 0 &&
                event.currentTarget.selectionEnd === 0
              ) {
                const index = latest.current.findIndex((item) => item.id === block.id);
                const previous = latest.current[index - 1];
                if (previous?.kind === "image") {
                  event.preventDefault();
                  const next = latest.current.filter((item) => item.id !== previous.id);
                  setBlocks(next);
                  onCommit(next);
                }
              }
            }}
            className="min-h-10 w-full resize-none overflow-hidden whitespace-pre-wrap break-words bg-transparent text-base leading-7 outline-none [overflow-wrap:anywhere]"
          /></div>
        ) : (
          <Fragment key={block.id}>
          {index>0&&blocks[index-1]?.kind==='image'&&<button type="button" aria-label="Вставить строку между скриншотами" className="flex w-full items-center justify-center gap-2 rounded py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground" onClick={()=>{
            const id=crypto.randomUUID();const next=latest.current.flatMap(b=>b.id===block.id?[{id,kind:'text' as const,text:''},b]:[b]);
            latest.current=next;focusId.current=id;setBlocks(next);onDraft?.(next);onCommit(next);
          }}><Plus className="size-3.5"/>Вставить строку</button>}
          <figure data-editor-block={block.id} tabIndex={0} aria-label={`Скриншот: ${block.name}`}
            onClick={event => { if ((event.target as Element).closest("video,select,label,button,a,[role=dialog]")) return; const range = document.createRange(); range.selectNode(event.currentTarget); const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range); setSelectedImage(block.id); event.currentTarget.focus(); }}
            className={`group relative overflow-hidden rounded-lg border ${selectedImage === block.id ? "ring-2 ring-sky-400" : ""}`}>
            <button type="button" draggable={!pending} aria-label="Перетащить скриншот" title="Перетащить скриншот" className="absolute left-2 top-2 z-10 grid size-7 cursor-grab place-items-center rounded bg-black/70 text-white active:cursor-grabbing" onDragStart={event=>{draggedBlock.current=block.id;event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('application/x-golden-editor-block',block.id);}} onDragEnd={clearDrag}><GripVertical className="size-4"/></button>
            <AttachmentMedia src={`/api/attachments/${block.attachmentId}`} name={block.name} showCopy={false}/>
            {copiedImage === block.id && <span role="status" className="absolute right-2 top-12 rounded-md bg-zinc-900/95 px-3 py-2 text-sm font-medium text-white shadow-lg">✓ Скопировано</span>}
            <button type="button" aria-label="Скопировать скриншот" title="Скопировать скриншот"
              className="absolute right-10 top-2 grid size-6 place-items-center rounded-md bg-black/60 text-white opacity-0 group-hover:opacity-100 focus:opacity-100 group-has-[video]:hidden"
              onClick={async () => {
                setCopiedImage(null);
                try {
                  const response = await fetch(`/api/attachments/${block.attachmentId}`);
                  if (!response.ok) throw new Error("Не удалось загрузить скриншот");
                  const blob = await response.blob();
                  const bitmap = await createImageBitmap(blob); const canvas = document.createElement("canvas"); canvas.width = bitmap.width; canvas.height = bitmap.height; canvas.getContext("2d")!.drawImage(bitmap, 0, 0); bitmap.close();
                  const png = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("Не удалось скопировать")), "image/png"));
                  await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]); setError(""); setCopiedImage(block.id);
                } catch { setError("Не удалось скопировать скриншот. Попробуй выделить его и нажать Ctrl+C."); }
              }}><Copy className="size-3.5" /></button>
            <button
              type="button"
              aria-label="Убрать скриншот из текста"
              onClick={() => {
                const next = latest.current.filter((item) => item.id !== block.id);
                setBlocks(next);
                onCommit(next);
              }}
              className="absolute right-2 top-2 grid size-6 place-items-center rounded-md bg-black/60 text-white opacity-0 group-hover:opacity-100 focus:opacity-100"
            >
              <X className="size-3.5" />
            </button>
          </figure>
          </Fragment>
        ),
      )}
      {pending && <p className="text-xs text-muted-foreground">Вставляем скриншот…</p>}
      {error && (
        <p role="alert" className="text-xs text-rose-400">
          {error}
        </p>
      )}
    </div>
  );
}
