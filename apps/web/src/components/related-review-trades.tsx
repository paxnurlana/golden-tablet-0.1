"use client";
import Link from 'next/link';
import {Circle,ArrowUpRight} from 'lucide-react';
import {JournalResultIcon,JournalResultBadge,JournalTermIcon} from './journal-icons';
import {DETAILS} from '@/lib/trade-classification';
import {isScenarioEntry} from '@/lib/trade-accounting';
import {opportunityRR} from '@/lib/trade-potential';
import {PotentialRRHint} from './potential-rr-hint';
import type {JournalEntry,Term} from '@/server/personal-journal';
const value=(n:number|null,suffix:string)=>n===null?'—':`${n>0?'+':''}${new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(n)}${suffix}`;
const tone=(n:number|null)=>n===null?'text-muted-foreground':'text-foreground';
export function RelatedReviewTrades({entries,terms,beforeOpen}:{entries:JournalEntry[];terms:Term[];beforeOpen?:()=>Promise<boolean>}) {
  const names=(entry:JournalEntry,kind:string)=>(entry.terms[kind as keyof typeof entry.terms]??[]).map(id=>terms.find(t=>t.id===id)?.name).filter(Boolean) as string[];
  return <section className="space-y-2 pt-2" aria-label="Связанные записи Journal">
    <h3 className="text-sm font-semibold">Связанные сделки <span className="text-muted-foreground">· {entries.length}</span></h3>
    <div className="grid grid-cols-1 items-stretch gap-2 sm:grid-cols-2 xl:grid-cols-3">
    {entries.length?entries.map(entry=>{
      const result=names(entry,'result')[0];const detail=DETAILS.find(d=>d.id===entry.classification?.detail);
      const description=[detail?.label,...names(entry,'setup')].filter(Boolean).join(' · ');
      const scenario=isScenarioEntry(entry,new Map(terms.map(t=>[t.id,t.name])));
      const amounts=entry.accounts.flatMap(a=>a.pnlCash===null?[]:[a.pnlCash]);
      const cash=amounts.length?amounts.reduce((a,b)=>a+b,0):null;
      const missing=entry.accounts.filter(a=>a.pnlCash===null).length;
      return <Link key={entry.id} href={`/trades?entry=${entry.id}`} onClick={event=>{if(beforeOpen){event.preventDefault();const href=event.currentTarget.href;void beforeOpen().then(ok=>{if(ok)window.location.assign(href);});}}} className="flex min-h-[112px] min-w-0 flex-col gap-2 rounded-lg border bg-card/30 px-3 py-3 text-sm hover:bg-accent/50">
        <div className="flex min-w-0 items-center gap-2">
          {result?<JournalResultIcon name={result} detail={entry.classification?.detail} missed={opportunityRR(entry,new Map(terms.map(t=>[t.id,t.name])))} className="size-7"/>:<Circle className="size-7 shrink-0 text-muted-foreground"/>}
          <b className="tabular-nums">#{entry.tradeNo}</b>{result&&<JournalResultBadge name={result}/>}<ArrowUpRight className="ml-auto size-3.5 text-muted-foreground"/>
        </div>
        <p className="min-h-4 truncate text-xs leading-4 text-muted-foreground" title={description||(scenario?'Неоткрытая идея · не входит в реальные итоги':undefined)}>{description||(scenario?'Неоткрытая идея':'\u00a0')}</p>
        <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1"><span>{names(entry,'instrument').join(', ')||'Без Asset'}</span>{entry.direction&&<span className="inline-flex items-center gap-1"><JournalTermIcon kind="direction" name={entry.direction}/>{entry.direction}</span>}<span className={`font-semibold tabular-nums ${tone(entry.realisedR)}`}>{!scenario&&value(entry.realisedR,'R')}<PotentialRRHint value={opportunityRR(entry,new Map(terms.map(t=>[t.id,t.name])))}/></span><span className={`font-semibold tabular-nums ${tone(cash)}`}>{value(cash,' $')}</span><span className="text-xs text-muted-foreground">{entry.accounts.length} акк.</span>{missing>0&&<span className="text-xs text-muted-foreground">{missing} без PNL</span>}</div>
      </Link>;
    }):<p className="text-sm text-muted-foreground">Связанных сделок пока нет.</p>}
    </div>
  </section>;
}
