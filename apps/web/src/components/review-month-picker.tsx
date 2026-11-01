"use client";
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronDown } from 'lucide-react';
const months=['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
export function ReviewMonthPicker({value,today,open,onChange}:{value:string;today:string;open:boolean;onChange:(value:string)=>void}){
  const [year,setYear]=useState(Number(value.slice(0,4))||2026);
  const [years,setYears]=useState(false);
  const [start,setStart]=useState(2020);
  useEffect(()=>{if(open){const selected=Number(value.slice(0,4));setYear(selected);setStart(Math.max(1900,Math.min(2189,selected-5)));setYears(false);}},[open,value]);
  const move=(delta:number)=>years?setStart(s=>Math.max(1900,Math.min(2189,s+delta*12))):setYear(y=>Math.max(1900,Math.min(2200,y+delta)));
  const button='grid size-10 place-items-center rounded-lg text-muted-foreground hover:bg-foreground/10 hover:text-foreground disabled:opacity-30';
  return <div className="p-3 sm:p-4">
    <div className="mb-4 flex items-center justify-between gap-2">
      <button type="button" aria-label={years?'Предыдущие годы':'Предыдущий год'} disabled={years?start===1900:year===1900} className={button} onClick={()=>move(-1)}><ArrowLeft className="size-4"/></button>
      <button type="button" aria-label="Выбрать год" aria-expanded={years} className="flex items-center gap-2 rounded-lg px-4 py-2 text-xl font-semibold tabular-nums hover:bg-foreground/10" onClick={()=>setYears(v=>!v)}>{years?`${start} — ${start+11}`:year}<ChevronDown className={`size-4 transition-transform ${years?'rotate-180':''}`}/></button>
      <button type="button" aria-label={years?'Следующие годы':'Следующий год'} disabled={years?start===2189:year===2200} className={button} onClick={()=>move(1)}><ArrowRight className="size-4"/></button>
    </div>
    <div className="grid grid-cols-3 gap-2">
      {years?Array.from({length:12},(_,i)=>start+i).map(item=><button type="button" key={item} aria-pressed={item===year} className={`min-h-12 rounded-xl px-3 py-3 text-base tabular-nums ${item===year?'bg-foreground text-background font-semibold':'bg-foreground/[0.035] hover:bg-foreground/10'}`} onClick={()=>{setYear(item);setYears(false);}}>{item}</button>):months.map((name,i)=>{
        const selected=year===Number(value.slice(0,4))&&i+1===Number(value.slice(5));
        const current=year===Number(today.slice(0,4))&&i+1===Number(today.slice(5));
        return <button type="button" key={name} aria-pressed={selected} className={`relative min-h-12 rounded-xl px-2 py-3 text-sm sm:text-base ${selected?'bg-foreground text-background font-semibold':'bg-foreground/[0.035] hover:bg-foreground/10'}`} onClick={()=>onChange(`${year}-${String(i+1).padStart(2,'0')}`)}>{name}{current&&!selected&&<span className="absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-current"/>}</button>;
      })}
    </div>
    <button type="button" className="mt-4 w-full rounded-xl border border-border/70 py-3 text-sm font-medium hover:bg-foreground/10" onClick={()=>onChange(today.slice(0,7))}>Текущий месяц</button>
  </div>;
}
