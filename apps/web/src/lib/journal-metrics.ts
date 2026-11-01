import type {JournalEntry,Term} from '@/server/personal-journal';
import {isScenarioEntry} from './trade-accounting';
import {actualRR,missedRR,scenarioPotentialRR} from './trade-potential';
import {journalPnl,missedTradePnl,journalUnrealisedPnl} from './journal-pnl';
import type {FilterGroup} from './journal-filters';
export function journalMetrics(entries:JournalEntry[],terms:Term[],filters?:FilterGroup){
 const names=new Map(terms.map(t=>[t.id,t.name]));
 const unique=[...new Map(entries.map(e=>[e.id,e])).values()];
 const result=(e:JournalEntry)=>(e.terms.result??[]).map(id=>names.get(id)).find(n=>['Win','Loss','BE','Breakeven'].includes(n??''));
 const executed=unique.filter(e=>!isScenarioEntry(e,names)&&result(e));
 const wins=executed.filter(e=>result(e)==='Win').length,losses=executed.filter(e=>result(e)==='Loss').length;
 const sum=(values:(number|null)[])=>{const known=values.filter((v):v is number=>v!=null&&Number.isFinite(v));return {value:known.length?known.reduce((a,b)=>a+b,0):null,known:known.length};};
 const realised=sum(executed.map(actualRR));
 const missed=sum(executed.map(missedRR));
 const missedCash=sum(executed.map(e=>journalUnrealisedPnl(e,names,filters)));
 const missedTrades=unique.filter(e=>(e.terms.result??[]).some(id=>names.get(id)?.toLowerCase()==='missed'));
 const missedTradesRR=sum(missedTrades.map(e=>{const rr=scenarioPotentialRR(e);return rr===null?null:Math.max(0,rr);}));
 const missedTradesCash=sum(missedTrades.map(e=>missedTradePnl(e,names,filters)));
 const pnl=sum(executed.map(e=>journalPnl(e,names,filters)));
 const totalCash=sum([missedCash.value,missedTradesCash.value]).value;
 const hits=wins;
 const safe=executed.filter(e=>{const rr=actualRR(e);return rr!==null?rr>=0:result(e)!=='Loss'&&e.classification?.detail!=='be-minus';}).length;
 const avg=(key:'mae'|'mfe')=>{const s=sum(executed.map(e=>e[key]));return {value:s.value===null?null:s.value/s.known,known:s.known};};
 return {trades:executed.length,wins,losses,winRate:wins+losses?wins/(wins+losses)*100:null,hitRate:executed.length?hits/executed.length*100:null,hits,hitAssessed:executed.length,survivalRate:executed.length?safe/executed.length*100:null,safe,realised,missed,missedCash,missedTradesRR,missedTradesCash,pnl,totalCash,total:missed.value===null&&missedTradesRR.value===null?null:(missed.value??0)+(missedTradesRR.value??0),mae:avg('mae'),mfe:avg('mfe')};
}
