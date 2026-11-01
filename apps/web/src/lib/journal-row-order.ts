import type {JournalEntry,Term} from '@/server/personal-journal';
import {journalDisplayPnl} from './journal-pnl';
import type {FilterGroup} from './journal-filters';
export type JournalSort={key:string;direction:'asc'|'desc'}|null;
export function sortJournalEntries(entries:JournalEntry[],terms:Term[],sort:JournalSort,manual:string[]=[],filters?:FilterGroup){
  const names=new Map(terms.map(t=>[t.id,t.name]));
  const positions=new Map(manual.map((id,i)=>[id,i]));
  const value=(e:JournalEntry,key:string):string|number|null=>{
    if(key==='pnlCash')return journalDisplayPnl(e,names,filters);
    if(['tradeNo','realisedR','mfe','mae'].includes(key))return (e as unknown as Record<string,number|null>)[key]??null;
    if(key==='account')return e.accounts.map(a=>names.get(a.accountId)??'').sort().join(', ')||null;
    if(['result','type','instrument','setup','storyline'].includes(key))return (e.terms[key as keyof typeof e.terms]??[]).map(id=>names.get(id)??'').sort().join(', ')||null;
    return String((e as unknown as Record<string,unknown>)[key]??'')||null;
  };
  return [...entries].sort((a,b)=>{
    if(!sort)return (positions.get(a.id)??Number.MAX_SAFE_INTEGER)-(positions.get(b.id)??Number.MAX_SAFE_INTEGER);
    const x=value(a,sort.key),y=value(b,sort.key);
    if(x===null||y===null)return x===y?0:x===null?1:-1;
    const comparison=typeof x==='number'&&typeof y==='number'?x-y:String(x).localeCompare(String(y),'ru',{numeric:true});
    return comparison*(sort.direction==='asc'?1:-1);
  });
}
