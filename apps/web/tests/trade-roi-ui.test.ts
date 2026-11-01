// The former broker-table screen was replaced by PersonalJournalClient.
// Retain its financial-format regressions without mounting the removed screen.
import { expect, it, vi } from 'vitest';
import { netReturnOnEntry } from '@golden-tablet/journal-core';
import { fmtPercent } from '../src/lib/utils';
vi.mock('../src/components/personal-journal-client',()=>({PersonalJournalClient:()=>null}));
import { PersonalJournalClient } from '../src/components/personal-journal-client';
import TradesPage from '../src/app/trades/page';
const roi=(extra:Record<string,unknown>)=>fmtPercent(netReturnOnEntry({avgEntry:100,quantity:1,netPnl:10,assetClass:'equity',...extra}),2);
it('formats actual derivative returns with the correct notional',()=>{
 expect(roi({assetClass:'futures',avgEntry:31157.25,quantity:4,contractMultiplier:2,netPnl:283})).toBe('0.11%');
 expect(roi({assetClass:'option',avgEntry:2.47,contractMultiplier:100,netPnl:-1.3})).toBe('-0.53%');
});
it('distinguishes unknown returns, true zero and negative entry prices',()=>{
 expect(roi({assetClass:'futures'})).toBe('–');
 expect(roi({avgEntry:0})).toBe('–');
 expect(roi({avgEntry:-100,netPnl:-10})).toBe('-10.00%');
 expect(roi({netPnl:0})).toBe('0.00%');
});
it('opens the canonical journal from the trades route',()=>{
 expect(TradesPage().type).toBe(PersonalJournalClient);
});
