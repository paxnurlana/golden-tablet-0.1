"use client";
import {useMemo,useState,useEffect} from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {ArrowLeft,ArrowRight,X} from 'lucide-react';
import {calendarMonthFromDays} from '@golden-tablet/journal-core';
import dynamic from 'next/dynamic';
import {JournalSegmentControl} from './journal-segment-control';
import {ProcessReportCard,useProcessData} from './process-report-card';
import {processReportsThrough,processLinePoints,processDaySteps,processComplete,processDate,PROCESS_START,type ProcessReport} from '@/lib/process-equity';
const ProcessEquityChart=dynamic(()=>import('./process-equity-chart').then(m=>m.ProcessEquityChart),{ssr:false,loading:()=> <div className="h-[420px] animate-pulse rounded-xl bg-muted/20"/>});
export function ProcessProgress(){
 const api=useProcessData();const [demo,setDemo]=useState(false),[frame,setFrame]=useState<'criteria'|'days'>('days'),[month,setMonth]=useState('2026-10'),[date,setDate]=useState<string|null>(null);
 useEffect(()=>{try{const value=localStorage.getItem('process-equity-demo');if(value!==null)setDemo(value==='true');}catch{}},[]);
 const reports=useMemo(()=>!api.data?[]:demo?api.data.demo:processReportsThrough(api.data.reports,api.data.now),[api.data,demo]);
 const points=useMemo(()=>processLinePoints(reports,frame,api.data?.now),[reports,frame,api.data?.now]);
 const days=useMemo(()=>new Map(reports.map(r=>[r.date,{report:r,steps:processDaySteps(r,api.data?.now)}])),[reports,api.data?.now]);
 const calendar=useMemo(()=>calendarMonthFromDays([],Number(month.slice(0,4)),Number(month.slice(5,7)),1),[month]);
 function changeMonth(delta:number){const next=new Date(month+'-15T12:00:00Z');next.setUTCMonth(next.getUTCMonth()+delta);setMonth(next.toISOString().slice(0,7));}
 function score(report?:ProcessReport){if(!report)return null;const steps=processDaySteps(report,api.data?.now);return steps.length?steps.reduce((sum,s)=>sum+s.value,0):null;}
 return <main className="space-y-5 p-4 sm:p-6">
 <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-xl font-semibold">Progress</h1><p className="mt-1 text-xs text-muted-foreground">Process Equity · дисциплина отдельно от PNL</p></div><JournalSegmentControl label="Источник оценок" value={demo?'demo':'real'} options={[{value:'real',label:'Мои данные'},{value:'demo',label:'Демо'}]} onChange={value=>{const next=value==='demo';setDemo(next);setDate(null);try{localStorage.setItem('process-equity-demo',String(next));}catch{}}}/></div>
 {api.error&&<p role="alert" className="text-sm text-destructive">{api.error}</p>}
 <section className="rounded-xl border bg-card/30 p-3 sm:p-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div className="flex items-baseline gap-3"><h2 className="text-sm font-semibold">Накопленные баллы</h2><span className="text-xl font-semibold tabular-nums">{points.at(-1)?.value??0}</span><span className="text-xs text-muted-foreground">баллов</span></div><JournalSegmentControl label="Вид графика" value={frame} options={[{value:'criteria',label:'По критериям'},{value:'days',label:'По дням'}]} onChange={setFrame}/></div>
 {demo&&<p className="mb-3 rounded-lg bg-sky-500/10 px-3 py-2 text-xs text-sky-300">Демо с 28 сентября · примеры не записываются в реальные рапорты. Переключись на «Мои данные», чтобы начать свой учёт с 19 октября.</p>}
 <ProcessEquityChart points={points} frame={frame} onDay={setDate}/>
 <p className="text-[11px] text-muted-foreground">Шаг шкалы — 1 балл. Наведи на точку для подробностей, нажми — откроется рапорт. Ограничение дня показывается отдельной корректировкой. Месяц календаря не ограничивает график.</p></section>
 <section className="review-calendar rounded-xl border bg-card/20 p-3 sm:p-4" aria-label="Календарь Daily Report Card"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-semibold">Daily Report Cards</h2><div className="flex items-center gap-2"><button type="button" aria-label="Предыдущий месяц Progress" onClick={()=>changeMonth(-1)} className="rounded p-2 hover:bg-accent"><ArrowLeft className="size-4"/></button><input type="month" aria-label="Месяц рапортов" value={month} onChange={e=>{if(/^\d{4}-\d{2}$/.test(e.target.value))setMonth(e.target.value);}} className="rounded-lg border bg-transparent px-2 py-1.5 text-sm"/><button type="button" aria-label="Следующий месяц Progress" onClick={()=>changeMonth(1)} className="rounded p-2 hover:bg-accent"><ArrowRight className="size-4"/></button></div></div>
 <div className="review-calendar-grid">{['Пн','Вт','Ср','Чт','Пт','Сб','Вс','Неделя'].map(label=><div key={label} className={`px-2 pb-1 text-xs text-muted-foreground ${label==='Неделя'?'review-calendar-week-heading':''}`}>{label}</div>)}
 {calendar.weeks.map((week,index)=>{const weekScores=week.days.flatMap(day=>{const result=day?score(days.get(day.date)?.report):null;return result===null?[]:[result];});return <div key={index} className="contents">{week.days.map((day,i)=>{
  if(!day)return <div key={i} className="review-calendar-day invisible"/>;const row=days.get(day.date),value=score(row?.report),complete=row&&processComplete(row.report);
  return <button type="button" key={day.date} onClick={()=>setDate(day.date)} aria-label={`Рапорт ${day.date}`} aria-current={day.date===api.data?.today?'date':undefined} className={`review-calendar-day ${value===null?'bg-foreground/[0.025]':value<0?'bg-red-700/40':value>0?'bg-emerald-500/20':'bg-foreground/10'}`}><span className="mb-2 text-muted-foreground">{Number(day.date.slice(8))}</span><b className="text-base tabular-nums">{value===null?'—':(value>0?'+':'')+value}</b><span className="mt-2 text-[10px] text-muted-foreground">{complete?'Оценено':row?.steps.length?'Черновик':day.date<PROCESS_START&&!demo?'До начала учёта':'Открыть рапорт'}</span></button>;
 })}<div className="review-calendar-week"><span className="text-xs text-muted-foreground">Итог недели</span><b>{weekScores.length?weekScores.reduce((a,b)=>a+b,0):'—'}</b></div></div>;})}</div>
 <p className="mt-4 text-xs text-muted-foreground">Учитываются только выставленные оценки. Незаполненные дни и критерии не влияют на баллы.</p></section>
 <Dialog.Root open={!!date} onOpenChange={open=>{if(!open)setDate(null);}}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-[110] bg-black/60"/><Dialog.Content aria-describedby={undefined} className="fixed inset-y-3 right-3 z-[111] w-[min(850px,calc(100vw-24px))] overflow-y-auto rounded-xl border bg-background p-5 shadow-2xl sm:p-8"><div className="mb-5 flex items-center justify-between"><Dialog.Title className="text-sm text-muted-foreground">Progress / {date}</Dialog.Title><Dialog.Close aria-label="Закрыть рапорт" className="rounded p-2 hover:bg-accent"><X className="size-4"/></Dialog.Close></div>{date&&<ProcessReportCard key={`${demo}:${date}`} date={date} demo={demo}/>}</Dialog.Content></Dialog.Portal></Dialog.Root>
 </main>;
}
