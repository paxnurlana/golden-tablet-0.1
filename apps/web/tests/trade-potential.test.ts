import {it,expect} from 'vitest';
import {emptyPotential,validatePotential,accountPotential,accountPotentialSummary,potentialRR,actualRR,missedRR,scenarioPotentialRR} from '../src/lib/trade-potential';
import type {JournalEntry,Term} from '../src/server/personal-journal';
const terms=[{id:'win',name:'Win'},{id:'hyp',name:'Hypothesis'}] as Term[];
const entry=(extra={})=>({id:'idea',tradeNo:1,date:'2026-10-07',mode:'Forward',riskTicks:50,realisedR:1,realisedTicks:50,terms:{result:['win']},accounts:[{accountId:'a',riskCash:100,pnlCash:100},{accountId:'b',riskCash:200,pnlCash:200}],potential:{...emptyPotential(),enabled:true,rr:3,basis:'planned'},...extra}) as JournalEntry;
it('separates total potential from missed gain and uses each saved account risk',()=>{
 const e=entry();expect(accountPotential(e,'a')).toMatchObject({cash:300,missed:200});expect(accountPotential(e,'b')).toMatchObject({cash:600,missed:400});expect(e.realisedR).toBe(1);expect(e.accounts[0]!.pnlCash).toBe(100);
});
it('keeps missing and disabled estimates unknown but needs no separate basis',()=>{
 expect(potentialRR(entry({potential:emptyPotential()}))).toBeNull();
 expect(potentialRR(entry({potential:{...emptyPotential(),enabled:true,rr:3}}))).toBe(3);
 expect(accountPotential(entry({accounts:[{accountId:'a',pnlCash:100}]}),'a').cash).toBeNull();
});
it('supports ticks, zero manual override and nonnegative shortfall',()=>{
 const e=entry({potential:{...emptyPotential(),enabled:true,basis:'after-exit',ticks:150,accountCash:{a:0}}});
 expect(potentialRR(e)).toBe(3);expect(accountPotential(e,'a')).toEqual({cash:0,missed:0,manual:true});
 expect(accountPotential({...e,accounts:[{accountId:'a',pnlCash:null,riskPct:null,pnlPct:null}]},'a').missed).toBeNull();
});
it('counts each idea once per account and excludes scenarios and Historical',()=>{
 const real=entry(),hyp=entry({id:'hyp',terms:{result:['hyp']}}),back=entry({id:'back',mode:'Back'});
 const summary=accountPotentialSummary([real,hyp,back,entry({id:'missing',potential:emptyPotential(),realisedR:null,realisedTicks:null})],'a',terms);
 expect(summary).toMatchObject({trades:2,actualRR:1,missedCash:200,missedRR:2,cashCompared:1,rrCompared:1});
});
it('rejects nonfinite and malformed payloads',()=>{
 expect(()=>validatePotential({...emptyPotential(),rr:Infinity})).toThrow();
 expect(()=>validatePotential({...emptyPotential(),enabled:'yes'})).toThrow();
 expect(()=>validatePotential({...emptyPotential(),accountCash:{a:'300'}})).toThrow();
});

it('normalizes realized and additional RR by 50 ticks without inflating cash from the 20-tick stop',()=>{
 const e=entry({rrBasis:{mode:'standard',ticks:50},riskTicks:20,realisedTicks:100,realisedR:5,accounts:[{accountId:'a',riskCash:200,pnlCash:1000}],potential:{...emptyPotential(),enabled:true,measurement:'remaining',ticks:50,rr:2.5}});
 expect(actualRR(e)).toBe(2);expect(potentialRR(e)).toBe(3);expect(missedRR(e)).toBe(1);
 expect(accountPotential(e,'a')).toMatchObject({cash:1500,missed:500});
 expect(actualRR({...e,realisedTicks:-20})).toBe(-.4);
 expect(actualRR({...e,rrBasis:{mode:'stop',ticks:50}})).toBe(5);
 expect(actualRR({...e,rrBasis:{mode:'manual',ticks:50},realisedR:2})).toBe(2);
 expect(accountPotential({...e,rrBasis:{mode:'manual',ticks:50}},'a')).toMatchObject({cash:1500,missed:500});
 expect(scenarioPotentialRR(e)).toBe(1);
});
it('interprets full potential independently and preserves legacy manually recorded RR',()=>{
 const e=entry({rrBasis:{mode:'standard',ticks:50},riskTicks:20,realisedTicks:100,potential:{...emptyPotential(),enabled:true,measurement:'total',ticks:150,rr:7.5}});
 expect(potentialRR(e)).toBe(3);expect(missedRR(e)).toBe(1);
 const legacy=entry({riskTicks:20,realisedTicks:100,realisedR:2});expect(actualRR(legacy)).toBe(2);expect(potentialRR(legacy)).toBe(3);
 expect(()=>validatePotential({...emptyPotential(),measurement:'wrong'})).toThrow();
});
