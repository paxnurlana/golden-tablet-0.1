// @vitest-environment jsdom
import {it,expect,vi} from 'vitest';
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {JournalCardProperties} from '../src/components/journal-card-properties';
it('Enter commits a numeric property through blur and exits editing',async()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const save=vi.fn(async()=>{});
  const entry={id:'qa',date:'2026-10-13',mode:'Forward',terms:{},accounts:[],classification:{},riskTicks:null,realisedTicks:null,realisedR:null,mfe:null,mae:null,openedAt:'',closedAt:'',quickNote:''} as any;
  try {
    await act(async()=>root.render(<JournalCardProperties entry={entry} terms={[]} save={save} create={async()=>{}} accounts={null} settingsContainer={null}/>));
    const input=host.querySelector<HTMLInputElement>('input[aria-label="Realised RR"]')!;
    await act(async()=>{input.focus();input.value='1.25';input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));});
    expect(save).toHaveBeenCalledWith(entry,{realisedR:1.25,rrBasis:{mode:'manual',ticks:50}});expect(document.activeElement).not.toBe(input);
  }finally{await act(async()=>root.unmount());host.remove();localStorage.clear();}
});

it('shows the normalized result and lets the user restore automatic stop calculation',async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});localStorage.clear();
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const save=vi.fn(async()=>{});
 const entry={id:'rr',date:'2026-10-30',mode:'Forward',terms:{},accounts:[],classification:{},riskTicks:20,realisedTicks:100,realisedR:5,rrBasis:{mode:'standard',ticks:50},mfe:null,mae:null,openedAt:'',closedAt:'',quickNote:''} as any;
 try{
  await act(async()=>root.render(<JournalCardProperties entry={entry} terms={[]} save={save} create={async()=>{}} accounts={null} settingsContainer={null}/>));
  expect(host.querySelector<HTMLInputElement>('[aria-label="Realised RR"]')!.value).toBe('2');
  expect(host.querySelector<HTMLInputElement>('[aria-label="Стандартный риск в тиках"]')!.value).toBe('50');
  const select=host.querySelector<HTMLSelectElement>('[aria-label="База расчёта R"]')!;
  await act(async()=>{select.value='stop';select.dispatchEvent(new Event('change',{bubbles:true}));});
  expect(save).toHaveBeenCalledWith(entry,{rrBasis:{mode:'stop',ticks:50}});
 }finally{await act(async()=>root.unmount());host.remove();localStorage.clear();}
});
