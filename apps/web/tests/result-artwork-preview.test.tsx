import {it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {JournalResultIcon} from '../src/components/journal-icons';

it('renders the approved artwork in every outcome and secondary-color combination',()=>{
  const examples=[
    ['Win','Win',undefined],['Small win','Win','win-small'],['Неполный Win','Win','win-manual'],
    ['Loss','Loss',undefined],['Loss → TP','Loss','loss-target'],
    ['БУ','Breakeven',undefined],['БУ: минус','Breakeven','be-minus'],
    ['БУ: спас от стопа','Breakeven','be-saved'],['БУ: упущен TP','Breakeven','be-target'],
    ['Missed','Missed',undefined],['Hypothesis','Hypothesis',undefined],['Unknown','Неопознанный трейд',undefined],
  ] as const;
  const html=renderToStaticMarkup(<html lang="ru"><head><meta charSet="utf-8"/><title>Утверждённые иконки — проверка</title>
    <style>{`body{background:#191919;color:#f4f4f5;font:15px system-ui;margin:36px}h1{font-size:22px}p{color:#a1a1aa}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;max-width:1080px}.card{background:#242424;border:1px solid #333;border-radius:12px;padding:20px;display:flex;align-items:center;gap:20px;min-height:90px}.card>div{margin-left:auto}.size-7{width:28px;height:28px}.size-16{width:64px;height:64px}.size-full{width:100%;height:100%}span[role=img]{display:inline-flex;flex-shrink:0;align-items:center;justify-content:center}small{display:block;color:#999;margin-top:8px}`}</style>
  </head><body><h1>B — Refined Materials</h1><p>Целиком окрашенные значки · без рамок и разделения · прежний размер 28 px</p><div className="grid">{examples.map(([label,name,detail])=><section className="card" key={label}>
    <JournalResultIcon name={name} detail={detail} className="size-16"/><div><JournalResultIcon name={name} detail={detail}/><small>{label}</small></div>
  </section>)}</div></body></html>);
  expect((html.match(/data-result-symbol="artwork"/g)??[]).length).toBe(24);
  if(process.env.ICON_ARTWORK_REVIEW==='1') console.log('ICON_REVIEW_START'+JSON.stringify('<!doctype html>'+html)+'ICON_REVIEW_END');
});
