import {it,expect,vi} from 'vitest';
vi.mock('../src/components/charts/calendar-daily-chart',()=>({CalendarDailyChart:()=>null}));
import {reviewCalendarData,ReviewCalendar} from '../src/components/review-calendar';
import {renderToStaticMarkup} from 'react-dom/server';
import type {JournalEntry,Term} from '../src/server/personal-journal';
import {missedDominatesDay} from '../src/lib/review-context';
it('colors a Missed-dominated day orange without adding its scenarios to actual results',()=>{
 expect(missedDominatesDay([['Missed'],['Missed'],['Win'],['Loss']])).toBe(true);
 expect(missedDominatesDay([['Missed'],['Loss']])).toBe(false);
 expect(missedDominatesDay([['Missed'],['BE'],['BE']])).toBe(false);
 const terms=[{id:'m',name:'Missed'}] as Term[];
 const entries=[make('m1','2026-10-15',[],{terms:{result:['m']},realisedR:2}),make('m2','2026-10-15',[],{terms:{result:['m']},realisedR:1})];
 const html=renderToStaticMarkup(<ReviewCalendar month="2026-10" today="2026-10-16" entries={entries} terms={terms} reviews={[]} onDay={()=>{}}/>);
 expect(html).toContain('bg-orange-500/10');
 expect(reviewCalendarData('2026-10',entries,terms).stats.get('2026-10-15')).toMatchObject({trades:0,rr:null,cash:null});
});
const terms=[{id:'win',name:'Win'}] as Term[];
const make=(id:string,date:string,accounts:unknown[],extra={})=>({id,date,mode:'Forward',terms:{result:['win']},accounts,realisedR:1,realisedTicks:null,...extra}) as JournalEntry;
it('uses denser day fills and deep red losses while preserving the current day marker',()=>{
 const html=renderToStaticMarkup(<ReviewCalendar month="2026-10" today="2026-10-16" entries={[make('gain','2026-10-15',[]),make('loss','2026-10-16',[],{realisedR:-1}),make('flat','2026-10-14',[],{realisedR:0})]} terms={terms} reviews={[]} onDay={()=>{}}/>);
 expect(html).toContain('bg-rose-500/10');expect(html).toContain('bg-emerald-500/10');expect(html).toContain('bg-blue-500/5');expect(html).toContain('aria-current="date"');expect(html).not.toContain('bg-red-700/40');
});
it('groups Monday through Sunday with weekend days in the last two columns',()=>{
  const entries=[make('sun','2026-10-11',[{accountId:'1',pnlCash:100}]),make('mon','2026-10-12',[{accountId:'1',pnlCash:200}])];
  const {calendar}=reviewCalendarData('2026-10',entries,terms);
  expect(calendar.weeks[0]!.days.map(d=>d?.date??null)).toEqual([null,null,null,'2026-10-01','2026-10-02','2026-10-03','2026-10-04']);
  expect(calendar.weeks[1]!.days[6]?.date).toBe('2026-10-11');
  expect(calendar.weeks[1]!.weekNetPnl).toBe(100);
  expect(calendar.weeks[2]!.days[0]?.date).toBe('2026-10-12');
  expect(calendar.weeks[2]!.weekNetPnl).toBe(200);
  const html=renderToStaticMarkup(<ReviewCalendar month="2026-10" today="2026-10-11" entries={entries} terms={terms} reviews={[]} onDay={()=>{}}/>);
  expect(html.match(/data-current-week="true"/g)).toHaveLength(8);
});
it('shows three clickable trade icons and a remaining-count button',()=>{
  const entries=Array.from({length:5},(_,i)=>make(`trade-${i}`,'2026-10-12',[],{tradeNo:i+1}));
  const html=renderToStaticMarkup(<ReviewCalendar month="2026-10" today="2026-10-14" entries={entries} terms={terms} reviews={[]} onDay={()=>{}}/>);
  expect(html.match(/href="\/trades\?entry=/g)).toHaveLength(3);
  expect(html).toContain('Ещё 2 записей дня');
  expect(html).toContain('Открыть дневную карту 2026-10-12');
});
it('uses canonical Forward ideas once, sums account cash, and preserves missing PNL',()=>{
  const one=make('a','2026-10-12',[{accountId:'1',pnlCash:100},{accountId:'2',pnlCash:200}]);
  const missing=make('b','2026-10-13',[{accountId:'1',pnlCash:null}],{realisedR:null});
  const back=make('c','2026-10-14',[{accountId:'1',pnlCash:900}],{mode:'Back'});
  const out=make('d','2026-09-30',[{accountId:'1',pnlCash:900}]);
  const data=reviewCalendarData('2026-10',[one,one,missing,back,out],terms);
  expect(data.total).toMatchObject({trades:2,rr:1,cash:300,cashMissing:1,rrMissing:1});
  expect(data.stats.get('2026-10-13')?.cash).toBeNull();
  expect(data.insights.days.map(d=>d.date)).toEqual(['2026-10-12']);
  expect(data.calendar.weeks.flatMap(w=>w.days).filter(Boolean)).toHaveLength(31);
});
