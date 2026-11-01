"use client";
import { forwardRef, useEffect, useRef, useState, type TextareaHTMLAttributes } from "react";
import { SlashBlockEditor } from "./slash-block-editor";
import {isFileDrag,forwardImageDrop} from '@/lib/image-drop';
export const SlashTextarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & {"data-no-slash"?: boolean; "data-workflow-source"?: string; "data-block-id"?: string}>((props, forwarded) => {
  const ref=useRef<HTMLTextAreaElement|null>(null);
  const [target,setTarget]=useState<HTMLTextAreaElement|null>(null);
  useEffect(()=>{const element=ref.current;if(!element||props['data-no-slash'])return;element.dataset.workflowFieldLabel=element.getAttribute('aria-label')||element.labels?.[0]?.textContent?.trim()||element.placeholder||'Заметка';setTarget(element);},[props['data-no-slash']]);
  useEffect(()=>{target?.dispatchEvent(new Event('workflow-refresh'));},[props.value,props.readOnly,target]);
  return <>{target&&<SlashBlockEditor target={target}/>}<textarea {...props} data-image-paste={Boolean(props.onPaste)}
    onDragOver={event=>{props.onDragOver?.(event);if(props.onPaste&&!props.readOnly&&isFileDrag(event.dataTransfer)){event.preventDefault();event.stopPropagation();event.dataTransfer.dropEffect='copy';}}}
    onDrop={event=>{props.onDrop?.(event);if(!event.defaultPrevented&&props.onPaste&&forwardImageDrop(event.currentTarget,event.dataTransfer)){event.preventDefault();event.stopPropagation();}}}
    style={{...props.style,...(target?{display:'none'}:{})}} ref={element=>{ref.current=element;if(typeof forwarded==='function')forwarded(element);else if(forwarded)forwarded.current=element;}} /></>;
});
SlashTextarea.displayName='SlashTextarea';
