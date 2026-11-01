"use client";
import { useEffect, useState, memo } from "react";
import { WORKFLOW_COLORS, WORKFLOW_CATEGORIES } from "@/lib/workflow";
import { X } from "lucide-react";
import { selectedTextSlice } from "@/lib/editor-selection";
import { resizeTextarea } from "@/lib/textarea-height";
import {isFileDrag,forwardImageDrop} from '@/lib/image-drop';
import {hasRichImages} from '@/lib/rich-image-paste';
import {imageVisibleText,imageSourceOffset,mergeImageText} from '@/lib/inline-image-text';
import {InlineScreenshotEditor} from './inline-screenshot-editor';

export const SlashBlockEditor = memo(function SlashBlockEditor({
  target,
}: {
  target: HTMLTextAreaElement;
}) {
  const [value, setValue] = useState(target.value);
  const [categoryMenu, setCategoryMenu] = useState<number | null>(null);
  const [,refreshStyle] = useState(0);
  useEffect(() => {
    const refresh = () => {setValue(target.value);refreshStyle(n=>n+1);};
    target.addEventListener("input", refresh);
    target.addEventListener("workflow-refresh", refresh);
    return () => {
      target.removeEventListener("input", refresh);
      target.removeEventListener("workflow-refresh", refresh);
    };
  }, [target]);
  let fixedPrompts:string[]=[];
  try{const parsed=JSON.parse(target.dataset.fixedPrompts||'[]');if(Array.isArray(parsed))fixedPrompts=parsed.filter((text):text is string=>typeof text==='string');}catch{}
  const parts: { category?: string; text: string; fixed?:boolean }[] = [];
  for (const line of value.split("\n")) {
    const match = line.match(/^\/([\p{L}\p{N}_-]{1,40})[ \t](.*)$/u);
    if(fixedPrompts.includes(line))parts.push({text:line,fixed:true});
    else if (match) parts.push({ category: match[1], text: match[2]! });
    else if (line.startsWith("\t") && parts.at(-1)?.category)
      parts[parts.length - 1]!.text += "\n" + line.slice(1);
    else if (parts.at(-1) && !parts.at(-1)!.category && !parts.at(-1)!.fixed) parts[parts.length - 1]!.text += "\n" + line;
    else parts.push({ text: line });
  }
  function syncSelection(index:number,start:number,end=start) {
    const prefix=parts.slice(0,index).map(p=>p.category?`/${p.category} ${p.text.replaceAll('\n','\n\t')}`:p.text).join('\n');
    const part=parts[index]!;
    const offset=(position:number)=>{
      const actual = imageSourceOffset(part.text,position);
      return (index?prefix.length+1:0)+(part.category?part.category.length+2:0)+part.text.slice(0,actual).replaceAll('\n',part.category?'\n\t':'\n').length;
    };
    target.setSelectionRange(offset(start),offset(end));
  }
  function sourceStart(index:number,offset=0){
    const prefix=parts.slice(0,index).map(p=>p.category?`/${p.category} ${p.text.replaceAll('\n','\n\t')}`:p.text).join('\n');
    const part=parts[index]!;
    return (index?prefix.length+1:0)+(part.category?part.category.length+2:0)+part.text.slice(0,offset).replaceAll('\n',part.category?'\n\t':'\n').length;
  }
  function write(next: typeof parts, focus?: number, caret?: number) {
    const text = next
      .map((part) =>
        part.category ? `/${part.category} ${part.text.replaceAll("\n", "\n\t")}` : part.text,
      )
      .join("\n");
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(
      target,
      text,
    );
    setValue(text);
    if (caret !== undefined) target.setSelectionRange(caret, caret);
    target.dispatchEvent(new Event("input", { bubbles: true }));
    if (focus !== undefined)
      requestAnimationFrame(() =>
        target.previousElementSibling
          ?.querySelector<HTMLTextAreaElement>(`[data-slash-part="${focus}"] textarea`)?.focus(),
      );
  }
  useEffect(() => {
    const proxy = target.previousElementSibling;
    if (!proxy) return;
    const selected = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.rangeCount) return null;
      const range = selection.getRangeAt(0);
      if (range.collapsed) return null;
      if (!proxy.contains(range.startContainer) || !proxy.contains(range.endContainer)) return null;
      return range;
    };
    const remove = (event: KeyboardEvent) => {
      if (target.readOnly || !["Backspace", "Delete"].includes(event.key)) return;
      const range = selected();
      if (!range) return;
      event.preventDefault(); event.stopPropagation();
      const next = parts.flatMap((part, index) => {
        if(part.fixed)return [part];
        const wrapper = proxy.querySelector<HTMLElement>(`[data-slash-part="${index}"]`)!;
        if (!range.intersectsNode(wrapper)) return [part];
        const text = wrapper.querySelector<HTMLElement>("textarea")!;
        const slice = selectedTextSlice(range, text, part.text);
        if (!slice || (slice.start === 0 && slice.end === part.text.length)) return [];
        return [{ ...part, text: part.text.slice(0, slice.start) + part.text.slice(slice.end) }];
      });
      window.getSelection()?.removeAllRanges();
      write(next.length ? next : [{ text: "" }], 0);
      target.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    };
    document.addEventListener("keydown", remove, true);
    return () => document.removeEventListener("keydown", remove, true);
  });
  return (
    <div className="space-y-2" data-slash-blocks>
      {parts.map((part, index) => part.fixed ? <p key={`fixed-${index}`} data-slash-part={index} data-fixed-prompt contentEditable={false} className="pt-3 text-sm font-semibold italic leading-6">{part.text}</p> : (
        <div
          key={index}
          data-slash-part={index}
          style={
            part.category
              ? {
                  borderColor: WORKFLOW_COLORS[part.category] || "#a1a1aa",
                  backgroundColor: `${WORKFLOW_COLORS[part.category] || "#a1a1aa"}0c`,
                }
              : undefined
          }
          className={
            part.category
              ? "rounded-xl border px-3 py-2 transition-shadow focus-within:ring-1 focus-within:ring-current"
              : ""
          }
        >
          {part.category && (
            <div className="relative mb-1 flex items-center justify-between gap-2">
              <button type="button" disabled={target.readOnly} aria-label={`Изменить тип /${part.category}`} aria-expanded={categoryMenu === index}
                style={{ color: WORKFLOW_COLORS[part.category] || "#a1a1aa" }}
                className="rounded px-1 py-1 text-xs font-medium hover:bg-white/5"
                onClick={() => setCategoryMenu(categoryMenu === index ? null : index)}>
                /{part.category}
              </button>
              <button type="button" disabled={target.readOnly} aria-label={`Удалить блок /${part.category}`} title="Удалить блок"
                className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-white/10 hover:text-foreground"
                onClick={() => {
                  const next = parts.filter((_, i) => i !== index);
                  write(next.length ? next : [{ text: "" }], Math.max(0, index - 1));
                  setCategoryMenu(null);
                  target.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
                }}><X className="size-3.5" /></button>
              {categoryMenu === index && <div role="menu" aria-label="Тип пометки" className="absolute left-0 top-full z-20 min-w-40 rounded-lg border bg-popover p-1 shadow-xl">
                {WORKFLOW_CATEGORIES.map(category => <button key={category} type="button" role="menuitem"
                  className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-accent"
                  style={{ color: WORKFLOW_COLORS[category] }} onClick={() => {
                    write(parts.map((p, i) => i === index ? { ...p, category } : p), index);
                    setCategoryMenu(null);
                    target.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
                  }}>/{category}</button>)}
              </div>}
            </div>
          )}
          {part.text.includes('[[image:') ? <InlineScreenshotEditor text={part.text} target={target}
            sourceStart={offset=>sourceStart(index,offset)} indented={Boolean(part.category)}
            partIndex={index} onMove={(fromPart,from,to)=>{
              const source=parts[fromPart];if(!source)return;
              const marker=source.text.slice(from).match(/^\[\[image:[a-zA-Z0-9_-]+\]\]/)?.[0];if(!marker)return;
              if(fromPart===index&&to>=from&&to<=from+marker.length)return;
              const next=parts.map(p=>({...p}));
              next[fromPart]!.text=source.text.slice(0,from)+source.text.slice(from+marker.length);
              const destination=fromPart===index&&to>from?to-marker.length:to;
              const content=next[index]!.text;next[index]!.text=content.slice(0,destination)+marker+content.slice(destination);
              write(next);target.dispatchEvent(new FocusEvent('focusout',{bubbles:true}));
            }}
            label={part.category?`Текст /${part.category}`:target.getAttribute('aria-label')||target.placeholder||'Текст записи'}
            onChange={(text,caret)=>{
              const prefix=parts.slice(0,index).map(p=>p.category?`/${p.category} ${p.text.replaceAll('\n','\n\t')}`:p.text).join('\n');
              const position=caret===undefined?undefined:(index?prefix.length+1:0)+(part.category?part.category.length+2:0)+text.slice(0,caret).replaceAll('\n',part.category?'\n\t':'\n').length;
              write(parts.map((p,i)=>i===index?{...p,text}:p),undefined,position);
            }}
            onSelect={(start,end)=>{
              const prefix=parts.slice(0,index).map(p=>p.category?`/${p.category} ${p.text.replaceAll('\n','\n\t')}`:p.text).join('\n');
              const offset=(position:number)=>(index?prefix.length+1:0)+(part.category?part.category.length+2:0)+part.text.slice(0,position).replaceAll('\n',part.category?'\n\t':'\n').length;
              target.setSelectionRange(offset(start),offset(end));
            }}/>:<textarea
            data-no-slash data-source-start={sourceStart(index)} data-source-indented={Boolean(part.category)}
            aria-label={
              part.category
                ? `Текст /${part.category}`
                : target.getAttribute("aria-label") || target.placeholder || "Текст записи"
            }
            placeholder={part.category ? "Напиши здесь…" : fixedPrompts.length&&parts.slice(index+1).some(p=>p.fixed)?'':target.placeholder}
            readOnly={target.readOnly}
            rows={fixedPrompts.length || part.category || part.text.includes('[[image:') ? 1 : target.rows}
            value={imageVisibleText(part.text)}
            className="min-h-8 w-full cursor-text resize-none overflow-hidden bg-transparent text-sm leading-6 caret-current outline-none"
            style={!part.category ? {fontSize:getComputedStyle(target).fontSize,fontWeight:getComputedStyle(target).fontWeight,fontFamily:getComputedStyle(target).fontFamily,lineHeight:getComputedStyle(target).lineHeight} : undefined}
            ref={(element) => {
              if (element) {
                const minimum=fixedPrompts.length || part.category || target.dataset.blockId || part.text.includes('[[image:') ? 32 : target.rows*24;
                const signature=`${minimum}:${element.value}`;
                if (element.dataset.measuredText === signature) return;
                element.dataset.measuredText = signature;
                resizeTextarea(element,minimum);
              }
            }}
            onChange={(event) => {
              if(target.readOnly)return;
              const next = parts.map((p, i) =>
                i === index ? { ...p, text: mergeImageText(event.target.value, p.text) } : p,
              );
              const prefix = next
                .slice(0, index)
                .map((p) =>
                  p.category ? `/${p.category} ${p.text.replaceAll("\n", "\n\t")}` : p.text,
                )
                .join("\n");
              const typed = event.target.value.slice(0, event.target.selectionStart);
              write(
                next,
                undefined,
                (index ? prefix.length + 1 : 0) +
                  (part.category ? part.category.length + 2 : 0) +
                  next[index]!.text.slice(0,imageSourceOffset(next[index]!.text,typed.length)).replaceAll("\n", part.category ? "\n\t" : "\n").length,
              );
            }}
            onBlur={() => target.dispatchEvent(new FocusEvent("focusout", { bubbles: true }))}
            onSelect={event=>syncSelection(index,event.currentTarget.selectionStart,event.currentTarget.selectionEnd)}
            onPaste={(event) => {
              if (event.clipboardData.files.length || event.clipboardData.getData("application/x-golden-journal-blocks") || (target.dataset.richImagePaste==='true'&&hasRichImages(event.clipboardData))) {
                event.preventDefault();
                syncSelection(index,event.currentTarget.selectionStart,event.currentTarget.selectionEnd);
                target.dispatchEvent(
                  new ClipboardEvent("paste", {
                    bubbles: true,
                    clipboardData: event.clipboardData,
                  }),
                );
              }
            }}
            onDragOver={event=>{if(target.dataset.imagePaste==='true'&&!target.readOnly&&isFileDrag(event.dataTransfer)){event.preventDefault();event.stopPropagation();event.dataTransfer.dropEffect='copy';}}}
            onDrop={event=>{if(target.dataset.imagePaste!=='true'||target.readOnly||!isFileDrag(event.dataTransfer))return;syncSelection(index,event.currentTarget.selectionStart,event.currentTarget.selectionEnd);if(forwardImageDrop(target,event.dataTransfer)){event.preventDefault();event.stopPropagation();}}}
            onKeyDown={(event) => {
              if (event.defaultPrevented || event.nativeEvent.isComposing) return;
              if (!target.readOnly && ["Backspace", "Delete"].includes(event.key)) {
                const field = event.currentTarget;
                if (field.selectionStart !== field.selectionEnd) return;
                const backward = event.key === "Backspace";
                const boundary = backward ? field.selectionStart === 0 : field.selectionEnd === field.value.length;
                if (!boundary) return;
                const adjacent=parts[backward?index-1:index+1];
                if(adjacent?.fixed){event.preventDefault();return;}
                if (!part.category && !part.text.trim() && parts.length > 1) {
                  event.preventDefault();
                  const next = parts.filter((_, i) => i !== index);
                  const destination = Math.max(0, index - 1);
                  write(next, destination);
                  requestAnimationFrame(() => {
                    const neighbor = target.previousElementSibling?.querySelector<HTMLTextAreaElement>(`[data-slash-part="${destination}"] textarea`);
                    if (neighbor) neighbor.setSelectionRange(neighbor.value.length, neighbor.value.length);
                  });
                  target.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
                  return;
                }
                const neighborIndex = backward ? index - 1 : index + 1;
                const neighbor = parts[neighborIndex];
                if (neighbor) {
                  event.preventDefault();
                  if (!part.category && !neighbor.category) {
                    const left = backward ? neighbor : part, right = backward ? part : neighbor;
                    const next = [...parts]; const first = Math.min(index, neighborIndex);
                    next.splice(first, 2, { text: left.text + right.text }); write(next, first);
                    requestAnimationFrame(() => { const field = target.previousElementSibling?.querySelector<HTMLTextAreaElement>(`[data-slash-part="${first}"] textarea`); field?.setSelectionRange(left.text.length, left.text.length); });
                    target.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
                  } else {
                    const field = target.previousElementSibling?.querySelector<HTMLTextAreaElement>(`[data-slash-part="${neighborIndex}"] textarea`);
                    field?.focus(); const position = backward ? field?.value.length ?? 0 : 0; field?.setSelectionRange(position, position);
                  }
                  return;
                }
                syncSelection(index, field.selectionStart, field.selectionEnd);
                const forwarded = new KeyboardEvent("keydown", { key: event.key, bubbles: true, cancelable: true });
                if (!target.dispatchEvent(forwarded)) event.preventDefault();
                return;
              }
              if (part.category && event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                const next = [...parts];
                next.splice(index + 1, 0, { text: "" });
                write(next, index + 1);
              }
            }}
          />}
        </div>
      ))}
    </div>
  );
});
