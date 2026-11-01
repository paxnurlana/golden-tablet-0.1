import {it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {TradePotentialEditor,AccountPotentialField} from '../src/components/trade-potential-editor';
import {emptyPotential} from '../src/lib/trade-potential';
import type {JournalEntry,Term} from '../src/server/personal-journal';
const terms=[{id:'a',name:'Account A'},{id:'m',name:'Missed'}] as Term[];
const entry={id:'one',terms:{result:['m']},realisedR:null,riskTicks:50,accounts:[{accountId:'a',riskCash:100,pnlCash:null}],potential:{...emptyPotential(),enabled:true,rr:3,ticks:150}} as unknown as JournalEntry;
it('keeps only the switch and two compact fields above accounts',()=>{
 const html=renderToStaticMarkup(<TradePotentialEditor entry={entry} terms={terms} onSave={()=>{}}/>);
 expect(html).toContain('aria-label="Потенциальный RR"');expect(html).toContain('aria-label="Потенциальные тики"');
 expect(html).not.toContain('Основание');expect(html).not.toContain('Комментарий');expect(html).not.toContain('Account A');expect(html).not.toContain('Не оценено');
 const disabled=renderToStaticMarkup(<TradePotentialEditor entry={{...entry,potential:{...entry.potential!,enabled:false}}} terms={terms} onSave={()=>{}}/>);
 expect(disabled).not.toContain('aria-label="Потенциальный RR"');
});
it('shows money inside the linked account only while enabled and preserves manual overrides',()=>{
 const html=renderToStaticMarkup(<AccountPotentialField entry={entry} accountId="a" terms={terms} onSave={()=>{}}/>);
 expect(html).toContain('Мог заработать');expect(html).toContain('placeholder="300"');
 const manual=renderToStaticMarkup(<AccountPotentialField entry={{...entry,potential:{...entry.potential!,accountCash:{a:280}}}} accountId="a" terms={terms} onSave={()=>{}}/>);
 expect(manual).toContain('value="280"');
 expect(renderToStaticMarkup(<AccountPotentialField entry={{...entry,potential:{...entry.potential!,enabled:false}}} accountId="a" terms={terms} onSave={()=>{}}/>)).toBe('');
});
