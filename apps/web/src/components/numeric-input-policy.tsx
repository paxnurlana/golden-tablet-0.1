"use client";
import {useEffect} from 'react';
/** Shared rule for every native numeric field, including dynamically opened panels. */
export function NumericInputPolicy() {
  useEffect(()=>{
    const wheel=(event:WheelEvent)=>{
      const field=document.activeElement;
      if(field instanceof HTMLInputElement&&field.type==='number'&&event.target instanceof Node&&field.contains(event.target))field.blur();
      // Do not cancel the wheel: the page must keep scrolling normally.
    };
    const key=(event:KeyboardEvent)=>{
      if(event.isComposing||!['ArrowUp','ArrowDown'].includes(event.key))return;
      if(event.target instanceof HTMLInputElement&&event.target.type==='number')event.preventDefault();
    };
    document.addEventListener('wheel',wheel,{capture:true,passive:true});
    document.addEventListener('keydown',key,true);
    return()=>{document.removeEventListener('wheel',wheel,true);document.removeEventListener('keydown',key,true);};
  },[]);
  return null;
}
