"use client";
import {rrDivisor} from '@/lib/trade-rr';
import type {JournalEntry,Term} from '@/server/personal-journal';
import {emptyPotential,accountPotential,type TradePotential} from '@/lib/trade-potential';
import {isScenarioEntry} from '@/lib/trade-accounting';
const field='mt-1 w-full rounded border bg-transparent px-3 py-2 text-sm text-foreground outline-none focus:border-sky-400';
export function TradePotentialEditor({entry,onSave}:{entry:JournalEntry;terms:Term[];onSave:(p:TradePotential)=>void}){
 const p=entry.potential??{...emptyPotential(),measurement:'remaining' as const};
 const update=(patch:Partial<TradePotential>)=>onSave({...p,...patch});
 return <section className="mb-3 rounded-lg border p-3" aria-label="Упущенный потенциал">
 <label className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={p.enabled} onChange={e=>update({enabled:e.target.checked})}/>Упущенный потенциал</label>
 {p.enabled&&<div className="mt-3 space-y-3">
 <select aria-label="Тип упущенного потенциала" value={p.measurement??'total'} onChange={e=>update({measurement:e.target.value as TradePotential['measurement']})} className="w-full rounded-lg border bg-background px-3 py-2 text-sm"><option value="remaining">Дополнительно после выхода</option><option value="total">Полный результат до цели</option></select>
 <p className="text-xs leading-5 text-muted-foreground">{p.measurement==='remaining'?'Только недобранный ход, сверх реализованного результата.':'Весь возможный результат от входа. Реализованная часть вычитается автоматически.'}</p>
 <div className="grid grid-cols-2 gap-3">
 {(['rr','ticks'] as const).map(key=><label key={key} className="text-xs text-muted-foreground">{key==='rr'?'RR':'Тики'}<input key={entry.id+key+String(p[key])+JSON.stringify(entry.rrBasis)+String(p.ticks)} aria-label={key==='rr'?'Потенциальный RR':'Потенциальные тики'} className={field} type="number" step="any" defaultValue={(key==='rr'&&entry.rrBasis&&entry.rrBasis.mode!=='manual'?(p.ticks!=null&&rrDivisor(entry)!=null?Number((p.ticks/rrDivisor(entry)!).toFixed(8)):null):p[key])??''} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}} onBlur={e=>{
 const value=e.target.value.trim()===''?null:Number(e.target.value);if(value!==null&&!Number.isFinite(value))return;
 const risk=rrDivisor(entry);
 update(risk!=null&&risk>0?(key==='rr'?{rr:value,ticks:value===null?null:value*risk}:{ticks:value,rr:value===null?null:value/risk}):{[key]:value});
 }}/></label>)}
 </div></div>}
 </section>;
}
export function AccountPotentialField({entry,accountId,terms,onSave}:{entry:JournalEntry;accountId:string;terms:Term[];onSave:(p:TradePotential)=>void}){
 const p=entry.potential;if(!p?.enabled)return null;
 const scenario=isScenarioEntry(entry,new Map(terms.map(t=>[t.id,t.name])));
 const estimate=accountPotential(entry,accountId,scenario);
 const name=terms.find(t=>t.id===accountId)?.name??'Аккаунт';
 return <label className="mt-3 block border-t pt-3 text-xs text-muted-foreground">Мог заработать
 <span className="mt-1 flex items-center rounded border focus-within:border-sky-400">
 <input key={entry.id+accountId+String(p.accountCash[accountId])+String(estimate.cash)} aria-label={'Потенциальный PNL: '+name} title="Оценка, не фактический PNL. Очисти ручное значение для автоматического расчёта." className="min-w-0 flex-1 bg-transparent py-2 pl-3 text-sm text-foreground outline-none" type="number" step="any" defaultValue={p.accountCash[accountId]??''} placeholder={estimate.cash===null?'—':String(Number(estimate.cash.toFixed(2)))} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}} onBlur={e=>{
 const value=e.target.value.trim()===''?null:Number(e.target.value);if(value!==null&&!Number.isFinite(value))return;
 const accountCash={...p.accountCash};if(value===null)delete accountCash[accountId];else accountCash[accountId]=value;
 onSave({...p,accountCash});
 }}/><span className="px-3 text-sm text-foreground" aria-hidden="true">$</span>
 </span>
 </label>;
}
