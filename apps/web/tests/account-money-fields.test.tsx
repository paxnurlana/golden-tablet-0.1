// @vitest-environment jsdom
import {it,expect,vi} from 'vitest';
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {AccountMoneyFields} from '../src/components/account-money-fields';
const account={accountId:'qa',riskPct:null,pnlCash:null,pnlPct:null};
it('shows signed percentages immediately and commits the paired values on blur',async()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const commit=vi.fn();
  try{
    await act(async()=>root.render(<AccountMoneyFields account={account} base={50000} onCommit={commit}/>));
    const cash=host.querySelector<HTMLInputElement>('[aria-label="PNL Cash · $"]')!;cash.focus();
    await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(cash,'-300');cash.dispatchEvent(new Event('input',{bubbles:true}));});
    expect(host.querySelector<HTMLInputElement>('[aria-label="P&L · %"]')!.value).toBe('-0.6');
    await act(async()=>cash.blur());expect(commit).toHaveBeenLastCalledWith(expect.objectContaining({pnlCash:-300,pnlPct:-0.6,editedField:'pnlCash'}));
  }finally{await act(async()=>root.unmount());host.remove();}
});
it('preserves typing and fills the paired field when the balance arrives asynchronously',async()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  try{
    await act(async()=>root.render(<AccountMoneyFields account={account} base={null} onCommit={()=>{}}/>));
    const cash=host.querySelector<HTMLInputElement>('[aria-label="Risk · $"]')!;cash.focus();
    await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(cash,'300');cash.dispatchEvent(new Event('input',{bubbles:true}));});
    await act(async()=>root.render(<AccountMoneyFields account={account} base={50000} onCommit={()=>{}}/>));
    expect(cash.value).toBe('300');expect(host.querySelector<HTMLInputElement>('[aria-label="Risk · %"]')!.value).toBe('0.6');
  }finally{await act(async()=>root.unmount());host.remove();}
});
