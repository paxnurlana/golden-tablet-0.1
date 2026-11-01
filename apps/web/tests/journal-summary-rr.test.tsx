import {it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {JournalTradeSummary} from '../src/components/journal-trade-summary';
it('shows only the parenthesized potential for unopened ideas',()=>{
 const html=renderToStaticMarkup(<JournalTradeSummary tradeNo={12} results={['Missed']} rr={null} missed={1} scenario/>);
 expect(html).toContain('(1RR?)');
 expect(html).not.toContain('RR сценария');
 expect(html).not.toContain('—');
});
it('keeps actual RR alongside the quiet potential for executed trades',()=>{
 const html=renderToStaticMarkup(<JournalTradeSummary tradeNo={1} results={['Win']} rr={2} missed={1}/>);
 expect(html).toContain('+2R');expect(html).toContain('(1RR?)');
});
