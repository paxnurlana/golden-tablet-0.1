import type {JournalEntry} from '@/server/personal-journal';
import type {FilterNode} from './journal-filters';
import {matchesFilters} from './journal-filters';
import {isScenarioEntry} from './trade-accounting';
import {accountPotential,scenarioPotentialRR} from './trade-potential';
// Financial scope follows the same filter tree; an ALL-account rule still selects each participating account.
export function scopedAccounts(entry:JournalEntry,filter?:FilterNode){
 if(!filter)return entry.accounts;
 const normalize=(node:FilterNode):FilterNode=>node.kind==='group'?{...node,children:node.children.map(normalize)}:node.property==='account'&&node.operator==='all'?{...node,operator:'any'}:node;
 const tree=normalize(filter);
 return entry.accounts.filter(account=>matchesFilters({...entry,accounts:[account]},tree.kind==='group'?tree:{kind:'group',id:'money',conjunction:'and',children:[tree]}));
}
export function journalPnl(entry:JournalEntry,names:Map<string,string>,filter?:FilterNode){
 if(isScenarioEntry(entry,names))return null;
 const values=scopedAccounts(entry,filter).map(a=>a.pnlCash).filter((v):v is number=>v!=null&&Number.isFinite(v));
 return values.length?values.reduce((a,b)=>a+b,0):null;
}
/** Scenario estimate only: never actual income or account balance. */
export function missedTradePnl(entry:JournalEntry,names:Map<string,string>,filter?:FilterNode){
 if(!(entry.terms.result??[]).some(id=>names.get(id)?.toLowerCase()==='missed'))return null;
 const rr=scenarioPotentialRR(entry);
 const values=scopedAccounts(entry,filter).map(account=>
  accountPotential(entry,account.accountId,true).cash??account.pnlCash??
  (rr!==null&&account.riskCash!=null&&account.riskCash>0?rr*account.riskCash:null)
 ).filter((v):v is number=>v!=null&&Number.isFinite(v));
 return values.length?values.reduce((a,b)=>a+b,0):null;
}
export function journalDisplayPnl(entry:JournalEntry,names:Map<string,string>,filter?:FilterNode){
 return journalPnl(entry,names,filter)??missedTradePnl(entry,names,filter);
}
/** Shortfall on executed trades, using saved per-account potential minus actual cash. */
export function journalUnrealisedPnl(entry:JournalEntry,names:Map<string,string>,filter?:FilterNode){
 if(isScenarioEntry(entry,names))return null;
 const values=scopedAccounts(entry,filter).map(account=>accountPotential(entry,account.accountId).missed)
  .filter((value):value is number=>value!==null&&Number.isFinite(value));
 return values.length?values.reduce((a,b)=>a+b,0):null;
}
