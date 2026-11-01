import type {JournalEntry} from '@/server/personal-journal';
import type {FilterNode} from '@/lib/journal-filters';
import {journalDisplayPnl,journalUnrealisedPnl} from '@/lib/journal-pnl';

export function JournalPnlCell({entry,names,filters}:{entry:JournalEntry;names:Map<string,string>;filters?:FilterNode}){
 const value=journalDisplayPnl(entry,names,filters);
 const estimated=(entry.terms.result??[]).some(id=>names.get(id)?.toLowerCase()==='missed');
 const shortfall=journalUnrealisedPnl(entry,names,filters);
 const money=(cash:number)=>cash.toLocaleString('ru-RU',{maximumFractionDigits:2})+' $';
 return <span className="inline-flex flex-wrap items-baseline gap-x-1.5 tabular-nums">
  {value===null?<span>—</span>:<span title={estimated?'Потенциальный PNL Missed — не заработано и не входит в фактический PNL':undefined} className={estimated?'text-foreground':value>0?'text-emerald-400':value<0?'text-rose-400':'text-foreground'}>{!estimated&&value>0?'+':''}{money(value)}</span>}
  {shortfall!==null&&shortfall>0&&<span className="text-foreground" title="Упущенная сумма: «Мог заработать» минус фактический PNL, минимум 0. Не входит в доход и баланс.">({money(shortfall)})</span>}
 </span>;
}
