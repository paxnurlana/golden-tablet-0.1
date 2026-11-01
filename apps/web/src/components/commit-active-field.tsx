"use client";
import {useEffect} from "react";

/** Commit blur-based editors before an outside click can unmount their panel. */
export function CommitActiveField() {
  useEffect(()=>{
    function commit(event:Event) {
      const field=document.activeElement;
      if(!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLElement && field.isContentEditable))return;
      if(event.target instanceof Node && field.contains(event.target))return;
      field.blur();
    }
    function escape(event:KeyboardEvent) {if(event.key==='Escape')commit(new Event('editor-close'));}
    document.addEventListener('pointerdown',commit,true);
    document.addEventListener('click',commit,true);
    document.addEventListener('keydown',escape,true);
    return()=>{document.removeEventListener('pointerdown',commit,true);document.removeEventListener('click',commit,true);document.removeEventListener('keydown',escape,true);};
  },[]);
  return null;
}
