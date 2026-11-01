import {it,expect} from 'vitest';
import {journalPnl,journalDisplayPnl,missedTradePnl} from '../src/lib/journal-pnl';
import {journalMetrics} from '../src/lib/journal-metrics';
import {sortJournalEntries} from '../src/lib/journal-row-order';
import {emptyPotential} from '../src/lib/trade-potential';
import type {JournalEntry,Term} from '../src/server/personal-journal';
const terms=['Missed','Win','Hypothesis'].map(name=>({id:name,name})) as Term[];
const names=new Map(terms.map(t=>[t.id,t.name]));
const row=(extra={})=>({id:'m',terms:{result:['Missed']},realisedR:2,realisedTicks:null,riskTicks:50,accounts:[{accountId:'a',pnlCash:300,riskCash:100},{accountId:'b',pnlCash:600,riskCash:200}],...extra}) as unknown as JournalEntry;
const filter={kind:'group' as const,id:'f',conjunction:'and' as const,children:[{kind:'rule' as const,id:'a',property:'account',operator:'any',values:['a'],value:'',end:''}]};
it('shows saved scenario cash in table and summary, never in actual PNL',()=>{
 const e=row();
 expect(journalDisplayPnl(e,names)).toBe(900);
 expect(journalPnl(e,names)).toBeNull();
 expect(journalMetrics([e,e],terms)).toMatchObject({trades:0,pnl:{value:null},missedTradesCash:{value:900,known:1}});
 expect(journalDisplayPnl(e,names,filter)).toBe(300);
 expect(journalMetrics([e],terms,filter).missedTradesCash.value).toBe(300);
});
it('uses explicit potential overrides, preserves zero, calculates missing cash from risk',()=>{
 expect(missedTradePnl(row({potential:{...emptyPotential(),enabled:true,rr:4,accountCash:{a:0}}}),names)).toBe(800);
 expect(missedTradePnl(row({accounts:[{accountId:'a',pnlCash:null,riskCash:100}]}),names)).toBe(200);
 expect(missedTradePnl(row({accounts:[]}),names)).toBeNull();
 expect(missedTradePnl(row({accounts:[{accountId:'a',pnlCash:null,riskCash:null}]}),names)).toBeNull();
 expect(journalDisplayPnl(row({terms:{result:['Hypothesis']}}),names)).toBeNull();
});
it('sorts by visible estimates without changing actual trade cash',()=>{
 const win=row({id:'w',terms:{result:['Win']}}),miss=row();
 expect(journalPnl(win,names)).toBe(900);
 const small=row({id:'small',accounts:[{accountId:'a',pnlCash:20}]});
 expect(sortJournalEntries([miss,small],terms,{key:'pnlCash',direction:'asc'}).map(e=>e.id)).toEqual(['small','m']);
});
