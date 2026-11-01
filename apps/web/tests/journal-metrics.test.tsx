import {it,expect} from 'vitest';
import {journalMetrics} from '../src/lib/journal-metrics';
import {emptyPotential} from '../src/lib/trade-potential';
import {renderToStaticMarkup} from 'react-dom/server';
import {JournalMetrics} from '../src/components/journal-metrics';
import type {JournalEntry,Term} from '../src/server/personal-journal';
const terms=['Win','Loss','BE','Missed','Hypothesis'].map(name=>({id:name,name})) as Term[];
const row=(id:string,result:string,rr:number|null,extra={})=>({id,terms:{result:[result]},realisedR:rr,realisedTicks:null,riskTicks:100,accounts:[],classification:{},mae:null,mfe:null,...extra}) as unknown as JournalEntry;
it('colors the PNL summary by its sign and leaves zero and unknown neutral',()=>{
 for(const [cash,color] of [[100,'text-emerald-400'],[-100,'text-rose-400'],[0,''],[null,'']] as const){
  const html=renderToStaticMarkup(<JournalMetrics entries={[row('pnl','Win',1,{accounts:[{accountId:'a',pnlCash:cash}]})]} terms={terms}/>);
  const pnl=html.split('data-metric-card="PNL"')[1]!.split('data-metric-card=')[0]!;
  if(color)expect(pnl).toContain(color);else{expect(pnl).not.toContain('text-emerald-400');expect(pnl).not.toContain('text-rose-400');}
  if(cash===100)expect(pnl).toContain('+100 $');
 }
});
it('separates actual rates and excursions from estimated scenarios, counts each idea once',()=>{
 const win=row('w','Win',5,{classification:{detail:'win-target'},mae:0,mfe:500});
 const be=row('b','BE',0,{classification:{detail:'be-target'},mae:20,mfe:200,potential:{...emptyPotential(),enabled:true,rr:3}});
 const loss=row('l','Loss',-1,{classification:{targetHit:false},mae:100,mfe:0});
 const miss=row('m','Missed',null,{potential:{...emptyPotential(),enabled:true,rr:7},mae:9000,mfe:9000});
 const m=journalMetrics([win,win,be,loss,miss,row('h','Hypothesis',null)],terms);
 expect(m).toMatchObject({trades:3,wins:1,losses:1,winRate:50,hitAssessed:3,hits:1,realised:{value:4,known:3},missed:{value:3,known:1},missedTradesRR:{value:7,known:1},total:10,mae:{value:40,known:3}});
 expect(m.hitRate).toBeCloseTo(100/3);expect(m.survivalRate).toBeCloseTo(200/3);
 expect(m.mfe.value).toBeCloseTo(700/3);
});
it('does not invent hit outcomes or treat empty data as zero',()=>{
 expect(journalMetrics([],terms)).toMatchObject({winRate:null,hitRate:null,survivalRate:null,total:null,mae:{value:null},mfe:{value:null}});
 expect(journalMetrics([row('w','Win',1)],terms)).toMatchObject({hitRate:100,hitAssessed:1});
 expect(journalMetrics([row('b','BE',-.1)],terms).survivalRate).toBe(0);
});
it('renders seven compact cards and the combined estimate without the old ideas block',()=>{
 const html=renderToStaticMarkup(<JournalMetrics entries={[row('w','Win',5),row('m','Missed',null,{potential:{...emptyPotential(),enabled:true,rr:10}})]} terms={terms}/>);
 for(const label of ['Win Rate','Hit Rate','Survival Rate','Realised RR','Unrealised RR','Avg MAE','Avg MFE'])expect(html).toContain(label);
 expect(html).toContain('10R');expect(html).toContain('Missed trades');expect(html).toContain('PNL');expect(html).not.toContain('Неоткрытые идеи');
});
it('uses all executed trades for hit rate, and scopes money without multiplying RR',()=>{
 const accounts=[{accountId:'a',pnlCash:100,riskCash:50},{accountId:'b',pnlCash:900,riskCash:500}];
 const filters={kind:'group' as const,id:'root',conjunction:'and' as const,children:[{kind:'rule' as const,id:'a',property:'account',operator:'any',value:'',values:['a'],end:''}]};
 const entries=[row('1','Win',1,{accounts}),row('2','Win',1,{accounts}),...Array.from({length:7},(_,i)=>row(`be${i}`,'BE',0)),row('miss','Missed',null,{accounts,potential:{...emptyPotential(),enabled:true,rr:2}}),row('hyp','Hypothesis',100)];
 const metrics=journalMetrics(entries,terms,filters);
 expect(metrics.hitRate).toBeCloseTo(2/9*100);expect(metrics.pnl.value).toBe(200);expect(metrics.realised.value).toBe(2);
 expect(metrics.missedTradesRR.value).toBe(2);expect(metrics.missedTradesCash.value).toBe(100);
});
