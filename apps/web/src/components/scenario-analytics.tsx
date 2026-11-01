"use client";
import Link from 'next/link';
import {isScenarioEntry} from '@/lib/trade-accounting';
import {scenarioPotentialRR} from '@/lib/trade-potential';
import {DETAILS} from '@/lib/trade-classification';
import type {JournalEntry,Term} from '@/server/personal-journal';
import {PotentialRRHint} from './potential-rr-hint';
export function ScenarioAnalytics({entries,terms}:{entries:JournalEntry[];terms:Term[]}){
 const names=new Map(terms.map(t=>[t.id,t.name]));
 const rows=[...new Map(entries.filter(e=>isScenarioEntry(e,names)).map(e=>[e.id,e])).values()];
 if(!rows.length)return null;
 const total=(group:JournalEntry[])=>{const values=group.flatMap(e=>{const rr=scenarioPotentialRR(e);return rr===null?[]:[Math.max(0,rr)];});return {rr:values.length?values.reduce((a,b)=>a+b,0):null,known:values.length};};
 const category=(e:JournalEntry)=>(e.terms.result??[]).map(id=>names.get(id)).find(name=>name&&['missed','miss','hypothesis','hypotesys','hypothesys','нло','неопознанный трейд'].includes(name.toLowerCase()))??'Сценарий';
 const key=(e:JournalEntry)=>category(e)+'|'+(e.classification?.detail??'');
 return <details className="rounded-xl border border-border/70 bg-card/30 p-4">
 <summary className="cursor-pointer text-sm font-medium">Неоткрытые идеи · {rows.length}<PotentialRRHint value={total(rows).rr}/></summary>
 <p className="mt-3 text-xs text-muted-foreground">Оценка за выбранный период и по текущим фильтрам. Не входит в фактический RR, прибыль и баланс. Без оценки — не ноль.</p>
 {(['Forward','Back'] as const).map(mode=>{
 const group=rows.filter(e=>e.mode===mode);if(!group.length)return null;
 return <div key={mode} className="mt-4 space-y-2">
 <h3 className="text-sm font-medium">{mode==='Forward'?'Live':'Historical'} · {group.length} идей<PotentialRRHint value={total(group).rr}/></h3>
 {[...new Set(group.map(key))].map(k=>{
 const items=group.filter(e=>key(e)===k),first=items[0]!,stats=total(items);
 const reason=DETAILS.find(d=>d.id===first.classification?.detail)?.label??'Причина не указана';
 return <div key={k} className="rounded-lg border border-border/60 px-3 py-2 text-sm">
 <span>{category(first)} · {reason} · {items.length} идей</span><PotentialRRHint value={stats.rr}/>
 <p className="mt-1 text-xs text-muted-foreground">Оценено {stats.known} из {items.length}</p>
 <div className="mt-2 flex flex-wrap gap-2">{items.map(e=><Link key={e.id} href={'/trades?entry='+e.id} className="rounded px-2 py-1 text-xs hover:bg-accent">#{e.tradeNo} · {e.date}<PotentialRRHint value={scenarioPotentialRR(e)}/></Link>)}</div>
 </div>;
 })}
 </div>;
 })}
 </details>;
}
