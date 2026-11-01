import {rrDivisor,realisedRR} from './trade-rr';
import type {JournalEntry,Term} from '@/server/personal-journal';
import {isScenarioEntry} from './trade-accounting';
export type TradePotential={measurement?:'total'|'remaining';enabled:boolean;rr:number|null;ticks:number|null;basis:''|'planned'|'after-exit';comment:string;accountCash:Record<string,number>};
export const emptyPotential=():TradePotential=>({enabled:false,rr:null,ticks:null,basis:'',comment:'',accountCash:{}});
export function validatePotential(raw:unknown):TradePotential {
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Некорректный потенциал');
  const p=raw as Record<string,unknown>;
  const number=(v:unknown)=>{if(v==null)return null;if(typeof v!=='number'||!Number.isFinite(v)||Math.abs(v)>1e12)throw new Error('Некорректное число потенциала');return v;};
  if(typeof p.enabled!=='boolean'||!['','planned','after-exit'].includes(String(p.basis))||typeof p.comment!=='string'||p.comment.length>10000||!p.accountCash||typeof p.accountCash!=='object'||Array.isArray(p.accountCash))throw new Error('Некорректный потенциал');
  const accountCash:Record<string,number>={};
  for(const [id,v] of Object.entries(p.accountCash)){if(!id||id.length>100)throw new Error('Некорректный аккаунт');const n=number(v);if(n!==null)accountCash[id]=n;}
  if(p.measurement!==undefined&&!['total','remaining'].includes(String(p.measurement)))throw new Error('Некорректный тип потенциала');
  return {...(p.measurement?{measurement:p.measurement as TradePotential['measurement']}:{}),enabled:p.enabled,rr:number(p.rr),ticks:number(p.ticks),basis:p.basis as TradePotential['basis'],comment:p.comment,accountCash};
}
export const actualRR=realisedRR;
function potentialValue(e:JournalEntry){
 const p=e.potential;if(!p?.enabled)return null;const basis=rrDivisor(e);
 return e.rrBasis&&e.rrBasis.mode!=='manual'?(p.ticks!=null&&basis!=null?p.ticks/basis:null):p.rr??(p.ticks!=null&&basis!=null?p.ticks/basis:null);
}
export function potentialRR(e:JournalEntry){const value=potentialValue(e);if(value===null)return null;return e.potential?.measurement==='remaining'?((actualRR(e)??0)+value):value;}
export function missedRR(e:JournalEntry){const potential=potentialRR(e),actual=actualRR(e);return potential===null||actual===null?null:Math.max(0,potential-actual);}
// Unopened ideas have no realised result to subtract. Legacy scenario RR stays readable.
export function scenarioPotentialRR(e:JournalEntry){
  const p=e.potential;
  if(p?.enabled)return potentialValue(e);
  return actualRR(e);
}
export function opportunityRR(e:JournalEntry,names:Map<string,string>){
  return isScenarioEntry(e,names)?scenarioPotentialRR(e):missedRR(e);
}
export function accountPotential(e:JournalEntry,accountId:string,scenario=false){
  const a=e.accounts.find(a=>a.accountId===accountId),p=e.potential;
  if(!a||!p?.enabled)return {cash:null,missed:null,manual:false};
  const rr=scenario?scenarioPotentialRR(e):potentialRR(e),override=p.accountCash[accountId];
  // Account riskCash is tied to the actual stop, never the normalized reporting R.
  const ticks=p.ticks==null?null:p.ticks+(p.measurement==='remaining'&&!scenario?(e.realisedTicks??0):0);
  const cashFromTicks=ticks!=null&&e.riskTicks!=null&&e.riskTicks>0&&a.riskCash!=null&&a.riskCash>0?ticks/e.riskTicks*a.riskCash:null;
  const cash=override??(e.rrBasis?cashFromTicks:(rr!=null&&a.riskCash!=null&&a.riskCash>0?rr*a.riskCash:null));
  return {cash,missed:scenario?null:cash!=null&&a.pnlCash!=null?Math.max(0,cash-a.pnlCash):null,manual:override!=null};
}
export function accountPotentialSummary(entries:JournalEntry[],accountId:string,terms:Term[]){
  const names=new Map(terms.map(t=>[t.id,t.name]));
  const rows=entries.filter(e=>e.mode==='Forward'&&!isScenarioEntry(e,names)&&e.accounts.some(a=>a.accountId===accountId)).map(e=>{
    const rr=potentialRR(e),realised=actualRR(e),money=accountPotential(e,accountId);
    return {id:e.id,tradeNo:e.tradeNo,date:e.date,actualRR:realised,potentialRR:rr,missedRR:rr!=null&&realised!=null?Math.max(0,rr-realised):null,...money};
  });
  const sum=(values:(number|null)[])=>{const known=values.filter((v):v is number=>v!==null);return known.length?known.reduce((a,b)=>a+b,0):null;};
  const scenarios=[...new Map(entries.filter(e=>e.mode==='Forward'&&isScenarioEntry(e,names)&&e.accounts.some(a=>a.accountId===accountId)).map(e=>[e.id,e])).values()].map(e=>({id:e.id,tradeNo:e.tradeNo,date:e.date,rr:scenarioPotentialRR(e),cash:accountPotential(e,accountId,true).cash}));
  return {scenarios,scenarioRR:sum(scenarios.map(e=>e.rr===null?null:Math.max(0,e.rr))),scenarioCash:sum(scenarios.map(e=>e.cash)),trades:rows.length,actualRR:sum(rows.map(r=>r.actualRR)),potentialCash:sum(rows.map(r=>r.cash)),missedCash:sum(rows.map(r=>r.missed)),missedRR:sum(rows.map(r=>r.missedRR)),cashCompared:rows.filter(r=>r.missed!==null).length,rrCompared:rows.filter(r=>r.missedRR!==null).length,rows:rows.filter(r=>r.potentialRR!==null||r.cash!==null)};
}
