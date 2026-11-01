// @vitest-environment jsdom
import {it,expect,vi} from 'vitest';
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {JournalToolbar} from '../src/components/journal-toolbar';
it('quickly clears conditions and search without changing the period or mode',async()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  const onFilters=vi.fn(),onQuery=vi.fn(),onPeriod=vi.fn(),onMode=vi.fn();
  try {
    await act(async()=>root.render(<JournalToolbar period={{preset:'month',from:'',to:''}} onPeriod={onPeriod} mode="Forward" onMode={onMode} filters={{kind:'group',id:'root',conjunction:'and',children:[]}} onFilters={onFilters} query="gold" onQuery={onQuery} terms={[]} columns={[]} hidden={[]} onHidden={()=>{}} onCreate={()=>{}}/>));
    const button=host.querySelector<HTMLButtonElement>('[aria-label="Быстро сбросить фильтры и поиск"]');
    expect(button).not.toBeNull();
    await act(async()=>button!.click());
    expect(onFilters).toHaveBeenCalledWith(expect.objectContaining({children:[]}));
    expect(onQuery).toHaveBeenCalledWith('');expect(onPeriod).not.toHaveBeenCalled();expect(onMode).not.toHaveBeenCalled();
  }finally{await act(async()=>root.unmount());host.remove();}
});
