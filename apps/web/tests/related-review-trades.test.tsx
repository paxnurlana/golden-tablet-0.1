import {it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {RelatedReviewTrades} from '../src/components/related-review-trades';
it('shows result, asset, direction and cash without treating unknown PNL as zero',()=>{
  const entry={id:'qa',tradeNo:8,terms:{result:['w'],instrument:['a']},direction:'Short',classification:{detail:'win-manual'},realisedR:1,quickNote:'Trade context',accounts:[{pnlCash:290},{pnlCash:null}]} as any;
  const terms=[{id:'w',name:'Win'},{id:'a',name:'XAUUSD'}] as any;
  const html=renderToStaticMarkup(<RelatedReviewTrades entries={[entry]} terms={terms}/>);
  for(const text of ['#8','XAUUSD','Short','+290 $','1 без PNL','/trades?entry=qa'])expect(html).toContain(text);
  expect(html).not.toContain('Trade context');expect(html).toContain('grid-cols-1');expect(html).toContain('xl:grid-cols-3');expect(html).not.toContain('sm:w-[360px]');
  expect(html).toContain('min-h-[112px]');expect(html).toContain('mt-auto flex');
  expect(html).toContain('text-xs leading-4 text-muted-foreground');expect(html).toContain('font-semibold tabular-nums text-foreground');
  const unknown=renderToStaticMarkup(<RelatedReviewTrades entries={[{...entry,accounts:[{pnlCash:null}]}]} terms={terms}/>);
  expect(unknown).not.toContain('0 $');expect(unknown).toContain('—');
});
