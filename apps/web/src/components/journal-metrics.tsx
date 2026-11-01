"use client";
import {useEffect,useRef,useState} from 'react';
import {SlidersHorizontal,GripVertical,ArrowUp,ArrowDown} from 'lucide-react';
import {JournalPopover} from './journal-popover';
import {metricLayout,moveMetric} from '@/lib/journal-metric-layout';
import type {JournalEntry,Term} from '@/server/personal-journal';
import {journalMetrics} from '@/lib/journal-metrics';
import type {FilterGroup} from '@/lib/journal-filters';
export function JournalMetrics({entries,terms,filters}:{entries:JournalEntry[];terms:Term[];filters?:FilterGroup}){
 const m=journalMetrics(entries,terms,filters);
 const [layout,setLayout]=useState(()=>metricLayout(null));
 const [ready,setReady]=useState(false);
 const dragged=useRef<string|null>(null);
 const [over,setOver]=useState<string|null>(null);
 useEffect(()=>{try{setLayout(metricLayout(JSON.parse(localStorage.getItem('journal-metric-layout-v1')||'null')));}catch{}setReady(true);},[]);
 useEffect(()=>{if(ready)try{localStorage.setItem('journal-metric-layout-v1',JSON.stringify(layout));}catch{}},[layout,ready]);
 const n=(v:number|null,suffix='')=>v===null?'—':`${v.toLocaleString('ru-RU',{maximumFractionDigits:2})}${suffix}`;
 const cards=[
 {label:'Сделки / Записи',value:`${m.trades} / ${new Set(entries.map(e=>e.id)).size}`,hint:'исполнено / всего записей',title:'Сделки: Win, БУ и Loss. Записи: все категории по текущим фильтрам. Каждая идея считается один раз.'},
 {label:'Win Rate',value:n(m.winRate,'%'),hint:`${m.wins} W / ${m.losses} L · без БУ`,rate:m.winRate,title:'Win ÷ (Win + Loss). Missed, гипотезы и неопознанные исключены.'},
 {label:'Hit Rate',value:n(m.hitRate,'%'),hint:`${m.hits} W / ${m.trades} сделок`,rate:m.hitRate,title:'Win ÷ (Win + БУ + Loss). Missed, гипотезы и неопознанные исключены.'},
 {label:'Survival Rate',value:n(m.survivalRate,'%'),hint:`${m.safe} без убытка / ${m.trades}`,rate:m.survivalRate,title:'Доля открытых сделок без убытка. При известном фактическом RR используется его знак.'},
 {label:'Realised RR',value:n(m.realised.value,'R'),hint:`${m.realised.known}/${m.trades} сделок с RR`,tone:m.realised.value===null?'':m.realised.value>0?'text-emerald-400':m.realised.value<0?'text-rose-400':'',title:'Фактический RR один раз на идею, не по количеству аккаунтов.'},
 {label:'PNL',value:`${m.pnl.value!==null&&m.pnl.value>0?'+':''}${n(m.pnl.value,' $')}`,tone:m.pnl.value===null||m.pnl.value===0?'':m.pnl.value>0?'text-emerald-400':'text-rose-400',hint:`${m.pnl.known}/${m.trades} сделок с PNL`,title:'Фактический PNL выбранных аккаунтов. Пустые значения не считаются нулём; сумма может быть неполной.'},
 {label:'Unrealised RR',value:`${n(m.missed.value,'R')} · ${n(m.missedCash.value,' $')}`,hint:`${m.missed.known} оценок RR · ${m.missedCash.known}/${m.trades} с оценкой $ · без Missed`,total:m.total,totalCash:m.totalCash,title:'Недобор Win / БУ / Loss: «Мог заработать» минус фактический PNL по выбранным аккаунтам, минимум 0. В скобках — вместе с Missed. Это оценка, не прибыль; незаполненные суммы не считаются нулём.'},
 {label:'Avg MAE',value:n(m.mae.value),hint:`тики · ${m.mae.known}/${m.trades} оценено`,title:'Средний MAE по открытым сделкам с заполненным значением. Пустые не считаются нулём.'},
 {label:'Avg MFE',value:n(m.mfe.value),hint:`тики · ${m.mfe.known}/${m.trades} оценено`,title:'Средний MFE по открытым сделкам с заполненным значением. Пустые не считаются нулём.'},
 {label:'Missed trades',value:`${n(m.missedTradesRR.value,'R')} · ${n(m.missedTradesCash.value,' $')}`,hint:`Не заработано · ${m.missedTradesCash.known} сделок с оценкой $ · выбранные аккаунты`,title:'RR и потенциальная сумма только Missed. Деньги совпадают со столбцом PNL; не входят в фактическую прибыль и баланс.'},
 ];
 const ordered=layout.order.flatMap(id=>{const card=cards.find(c=>c.label===id);return card?[card]:[];});
 return <section aria-label="Статистика журнала" className="space-y-2">
 <div className="flex justify-end"><JournalPopover label="Настройка сводки" align="end" className="w-60" trigger={<button type="button" aria-label="Настроить карточки статистики" title="Настроить сводку" className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"><SlidersHorizontal className="size-3.5"/>Сводка</button>}>
 <div className="mb-2 px-2 text-xs text-muted-foreground">Показывать карточки</div>
 {ordered.map((c,i)=><div key={c.label} className="flex items-center gap-1 rounded px-2 py-1 text-xs"><label className="flex min-w-0 flex-1 items-center gap-2"><input type="checkbox" checked={!layout.hidden.includes(c.label)} onChange={()=>setLayout(old=>({...old,hidden:old.hidden.includes(c.label)?old.hidden.filter(id=>id!==c.label):[...old.hidden,c.label]}))}/>{c.label}</label>
 <button type="button" aria-label={`Поднять ${c.label}`} disabled={i===0} className="rounded p-1 hover:bg-accent disabled:opacity-20" onClick={()=>setLayout(old=>({...old,order:moveMetric(old.order,c.label,old.order[i-1]!)}))}><ArrowUp className="size-3"/></button>
 <button type="button" aria-label={`Опустить ${c.label}`} disabled={i===ordered.length-1} className="rounded p-1 hover:bg-accent disabled:opacity-20" onClick={()=>setLayout(old=>({...old,order:moveMetric(old.order,c.label,old.order[i+1]!)}))}><ArrowDown className="size-3"/></button></div>)}
 <button type="button" className="mt-2 w-full rounded p-2 text-left text-xs text-muted-foreground hover:bg-accent" onClick={()=>setLayout(metricLayout(null))}>Вернуть по умолчанию</button>
 </JournalPopover></div>
 <div className="grid grid-cols-2 gap-3 md:grid-cols-4 2xl:grid-cols-5">{ordered.filter(c=>!layout.hidden.includes(c.label)).map(c=><div key={c.label} data-metric-card={c.label} title={c.title} draggable
 onDragStart={event=>{dragged.current=c.label;event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('application/x-journal-metric',c.label);}}
 onDragOver={event=>{if(dragged.current){event.preventDefault();event.dataTransfer.dropEffect='move';setOver(c.label);}}}
 onDrop={event=>{const from=dragged.current;if(!from)return;event.preventDefault();setLayout(old=>({...old,order:moveMetric(old.order,from,c.label)}));dragged.current=null;setOver(null);}}
 onDragEnd={()=>{dragged.current=null;setOver(null);}}
 className={`group relative min-w-0 cursor-grab rounded-xl border bg-card px-4 py-3.5 active:cursor-grabbing ${over===c.label?'border-sky-400':'border-white/[0.06]'}`}>
 <GripVertical aria-hidden="true" className="absolute right-2 top-2 size-3 text-muted-foreground opacity-0 group-hover:opacity-60"/>
 <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{c.label}</div>
 <div className={`mt-2 flex flex-wrap items-baseline gap-x-1.5 text-xl font-semibold tabular-nums ${c.tone??''}`}>{c.value}{(c.total!=null||c.totalCash!=null)&&<span className="text-sm text-muted-foreground" title="Упущено вместе с Missed">({n(c.total??null,'R')}{c.totalCash!=null?` · ${n(c.totalCash,' $')}`:''})</span>}</div>
 <p className="mt-1 text-[10px] text-muted-foreground">{c.hint}</p>
 {c.rate!=null&&<div className="mt-2 h-1 overflow-hidden rounded-full bg-foreground/10"><div className="h-full rounded-full bg-sky-400/75" style={{width:`${Math.max(0,Math.min(100,c.rate))}%`}}/></div>}
 </div>)}</div></section>;
}
