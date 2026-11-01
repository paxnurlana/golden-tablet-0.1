import {isScenarioEntry} from './trade-accounting';
import type {JournalEntry} from '@/server/personal-journal';
export type JournalTradeScope='All'|'Realised'|'Unrealised';
export function matchesTradeScope(entry:JournalEntry,names:Map<string,string>,scope:JournalTradeScope){
 if(scope==='All')return true;
 const scenario=isScenarioEntry(entry,names);
 return scope==='Unrealised'?scenario:!scenario&&(entry.terms.result??[]).some(id=>['win','loss','be','breakeven'].includes((names.get(id)??'').trim().toLowerCase()));
}
