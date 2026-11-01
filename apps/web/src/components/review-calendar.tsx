"use client";
import { calendarMonthFromDays, type DayStats } from '@golden-tablet/journal-core';
import { reviewStats, type ReviewRecord } from '@/lib/trading-review';
import type { JournalEntry, Term } from '@/server/personal-journal';
import { MonetaryValue } from './privacy';
import { calendarInsights } from '@/lib/calendar-insights';
import Link from 'next/link';
import {JournalResultIcon} from './journal-icons';
import {isScenarioEntry} from '@/lib/trade-accounting';
import {missedDominatesDay} from '@/lib/review-context';
import {PotentialRRHint} from './potential-rr-hint';
import {opportunityRR} from '@/lib/trade-potential';

export function reviewCalendarData(month:string, entries:JournalEntry[], terms:Term[]) {
  const scoped=[...new Map(entries.filter(e=>e.mode==='Forward' && e.date.startsWith(month)).map(e=>[e.id,e])).values()];
  const dates=[...new Set(scoped.map(e=>e.date))].sort();
  const stats=new Map(dates.map(date=>[date,reviewStats(scoped.filter(e=>e.date===date),terms)]));
  const days:DayStats[]=dates.map(date=>{const s=stats.get(date)!;return {date,netPnl:s.cash??0,grossPnl:s.cash??0,fees:0,trades:s.trades,wins:0,losses:0,breakevens:0,volume:0};});
  const calendar=calendarMonthFromDays(days,Number(month.slice(0,4)),Number(month.slice(5,7)),1);
  const completeDays=days.filter(d=>d.trades>0 && stats.get(d.date)!.cash!==null && stats.get(d.date)!.cashMissing===0);
  const insights=calendarInsights(calendarMonthFromDays(completeDays,calendar.year,calendar.month));
  return {calendar,stats,insights,total:reviewStats(scoped,terms)};
}

export function ReviewCalendar({month,today,entries,terms,reviews,onDay}: {month:string;today:string;entries:JournalEntry[];terms:Term[];reviews:ReviewRecord[];onDay:(date:string)=>void}) {
  if(!month)return null;
  const {calendar,stats}=reviewCalendarData(month,entries,terms);
  const termNames=new Map(terms.map(t=>[t.id,t.name]));
  const cash=(n:number|null)=>n===null?'—':`${n>0?'+':''}${n.toLocaleString('ru-RU')} $`;
  const rr=(n:number|null)=>n===null?'—':`${n>0?'+':''}${Number(n.toFixed(2))}R`;
  return <>
    <section aria-label="Календарь Trading Review" className="review-calendar rounded-xl bg-card/20 p-3 sm:p-4">
      <div className="review-calendar-grid">
        {['Пн','Вт','Ср','Чт','Пт','Сб','Вс','Неделя'].map(label=><div key={label} className={`px-2 pb-1 text-xs text-muted-foreground ${label==='Неделя'?'review-calendar-week-heading':''}`}>{label}</div>)}
        {calendar.weeks.map((week,index)=>{
          const currentWeek=week.days.some(day=>day?.date===today);
          const weekStats=reviewStats(entries.filter(e=>e.mode==='Forward' && week.days.some(d=>d?.date===e.date)),terms);
          return <div key={index} className="contents">{week.days.map((day,i)=>{
            if(!day)return <div key={i} className="review-calendar-day invisible"/>;
            const s=stats.get(day.date);
            const record=reviews.find(r=>r.kind==='day' && r.key===day.date);
            const sign=s?.rr??s?.cash??0;
            const dayEntries=[...new Map(entries.filter(e=>e.mode==='Forward'&&e.date===day.date).map(e=>[e.id,e])).values()].sort((a,b)=>Number(isScenarioEntry(a,termNames))-Number(isScenarioEntry(b,termNames))||a.tradeNo-b.tradeNo);
            const missedDay=missedDominatesDay(dayEntries.map(e=>(e.terms.result??[]).map(id=>termNames.get(id)??'')));
            return <div key={day.date} className="relative min-w-0">
            <button onClick={()=>onDay(day.date)} aria-current={day.date===today?'date':undefined} data-current-week={currentWeek || undefined} aria-label={`Открыть дневную карту ${day.date}${day.date===today?' · Сегодня':''}`} className={`review-calendar-day w-full h-full ${dayEntries.length?'!pb-8':''} ${missedDay?'bg-orange-500/10':s?.trades ? sign>0?'bg-emerald-500/10':sign<0?'bg-rose-500/10':'bg-blue-500/5':'bg-foreground/[0.025]'}`}>
              <div className="mb-2 flex w-full items-center justify-between text-muted-foreground"><span className={day.date===today?'review-calendar-today-number':''}>{Number(day.date.slice(8))}</span>{record && <span title="Есть дневная карта" className="size-1.5 shrink-0 rounded-full bg-sky-400"/>}</div>
              {!!s?.records && <><div className="whitespace-nowrap font-medium tabular-nums">{rr(s.rr)}{s.rrMissing>0?' *':''}</div>{s.missedRR!=null&&s.missedRR>0&&<div><PotentialRRHint value={s.missedRR} coverage={`оценено ${s.potentialEvaluated} из ${s.records}`}/></div>}<div className="max-w-full truncate tabular-nums"><MonetaryValue>{cash(s.cash)}{s.cashMissing>0?' *':''}</MonetaryValue></div><div className="mt-auto whitespace-nowrap pt-1 text-muted-foreground">Сделки: {s.trades}</div></>}
            </button>
            {!!dayEntries.length&&<div className="absolute bottom-2 left-2 right-1 flex items-center gap-1" aria-label={`Записи дня: ${dayEntries.length}`}>
              {dayEntries.slice(0,3).map((entry,i)=>{
                const scenario=isScenarioEntry(entry,termNames);
                const name=(entry.terms.result??[]).map(id=>termNames.get(id)).find(Boolean)??'';
                const boundary=scenario&&i>0&&!isScenarioEntry(dayEntries[i-1]!,termNames);
                const label=`Сделка #${entry.tradeNo} · ${name||'Без результата'}${scenario?' · сценарий':''}`;
                return <Link key={entry.id} href={`/trades?entry=${entry.id}`} aria-label={label} title={label} className={`flex size-6 shrink-0 items-center justify-center rounded hover:bg-foreground/10 ${boundary?'border-l border-foreground/25 pl-1':''}`}><JournalResultIcon name={name} detail={entry.classification?.detail} missed={opportunityRR(entry,termNames)} className="size-6"/></Link>;
              })}
              {dayEntries.length>3&&<button type="button" title="Открыть остальные сделки дня" aria-label={`Ещё ${dayEntries.length-3} записей дня`} onClick={()=>onDay(day.date)} className="rounded px-1 text-[10px] text-muted-foreground hover:bg-foreground/10">+{dayEntries.length-3}</button>}
            </div>}
            </div>;
          })}<div className="review-calendar-week" data-current-week={currentWeek || undefined}><span className={currentWeek?'font-medium text-foreground':'text-muted-foreground'}>{currentWeek?'Эта неделя':'Итог недели'}</span><div className="whitespace-nowrap font-medium tabular-nums"><MonetaryValue>{cash(weekStats.cash)}{weekStats.cashMissing?' *':''}</MonetaryValue></div><PotentialRRHint value={weekStats.missedRR} coverage={`оценено ${weekStats.potentialEvaluated} из ${weekStats.records}`}/><span className="whitespace-nowrap text-muted-foreground">Сделки: {week.weekTrades}</span></div></div>;
        })}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Синяя точка — есть дневная карта. Светлая подложка — текущая неделя, выделенная дата — сегодня · Asia/Qyzylorda.</p>
      <p className="mt-1 text-xs text-muted-foreground">Journal · Live · RR один раз на идею, PNL по аккаунтам. * Сумма неполная; незаполненные значения не считаются нулём.</p>
    </section>
  </>;
}
