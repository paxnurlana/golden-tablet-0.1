import {it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {PotentialRRHint} from '../src/components/potential-rr-hint';
import {reviewStats} from '../src/lib/trading-review';
import {emptyPotential} from '../src/lib/trade-potential';
import type {JournalEntry,Term} from '../src/server/personal-journal';
import {ScenarioAnalytics} from '../src/components/scenario-analytics';
import {ReviewCalendar} from '../src/components/review-calendar';
import {accountPotentialSummary} from '../src/lib/trade-potential';
it('shows only a quiet numeric RR question label, with explanation in its tooltip',()=>{
 expect(renderToStaticMarkup(<PotentialRRHint value={2}/>)).toContain('>(2RR?)</span>');
 expect(renderToStaticMarkup(<PotentialRRHint value={null}/>)).toBe('');
 expect(renderToStaticMarkup(<PotentialRRHint value={0}/>)).toBe('');
});
it('shows five missed ideas and seven estimated R without changing actual totals',()=>{
 const terms=[{id:'missed',name:'Missed'},{id:'win',name:'Win'}] as Term[];
 const ideas=Array.from({length:5},(_,i)=>({id:'miss'+i,tradeNo:i+1,date:'2026-10-15',mode:'Forward',realisedR:null,realisedTicks:null,riskTicks:50,terms:{result:['missed']},classification:{detail:i<3?'missed-fear':'missed-overlooked'},accounts:[{accountId:'a',riskCash:100,pnlCash:null}],potential:{...emptyPotential(),enabled:true,rr:i===0?3:1}} as JournalEntry));
 const stats=reviewStats([...ideas,ideas[0]!],terms);
 expect(stats).toMatchObject({trades:0,rr:null,cash:null,missedRR:7,scenarioRR:7,scenarioCount:5,potentialEvaluated:5});
 const summary=renderToStaticMarkup(<ScenarioAnalytics entries={ideas} terms={terms}/>);
 expect(summary).toContain('(7RR?)');expect(summary).toContain('Зассал открываться');expect(summary).toContain('Проморгал');
 const calendar=renderToStaticMarkup(<ReviewCalendar month="2026-10" today="2026-10-15" entries={ideas} terms={terms} reviews={[]} onDay={()=>{}}/>);
 expect(calendar).toContain('(7RR?)');
 const account=accountPotentialSummary(ideas,'a',terms);
 expect(account).toMatchObject({trades:0,actualRR:null,missedCash:null,scenarioRR:7,scenarioCash:700});
 expect(account.scenarios).toHaveLength(5);
});
it('uses legacy scenario RR only as fallback and never doubles an explicit estimate',()=>{
 const terms=[{id:'m',name:'Missed'}] as Term[];
 const legacy={id:'old',mode:'Forward',terms:{result:['m']},accounts:[],realisedR:2,realisedTicks:null,riskTicks:50} as unknown as JournalEntry;
 expect(reviewStats([legacy],terms)).toMatchObject({rr:null,missedRR:2});
 expect(reviewStats([{...legacy,potential:{...emptyPotential(),enabled:true,rr:3}}],terms)).toMatchObject({rr:null,missedRR:3});
 expect(reviewStats([{...legacy,realisedR:null}],terms)).toMatchObject({missedRR:null,potentialEvaluated:0});
});
it('aggregates only assessed shortfalls once per idea without altering actual RR or cash',()=>{
 const e={id:'one',realisedR:1,realisedTicks:50,riskTicks:50,terms:{result:['win']},accounts:[{accountId:'a',pnlCash:100,pnlPct:null},{accountId:'b',pnlCash:200,pnlPct:null}],potential:{...emptyPotential(),enabled:true,rr:3,basis:'planned'}} as JournalEntry;
 expect(reviewStats([e,e],[{id:'win',name:'Win'}] as Term[])).toMatchObject({rr:1,cash:300,missedRR:2,potentialEvaluated:1,trades:1});
 expect(reviewStats([{...e,potential:{...e.potential!,basis:''}}],[{id:'win',name:'Win'}] as Term[])).toMatchObject({rr:1,cash:300,missedRR:2,potentialEvaluated:1});
});
