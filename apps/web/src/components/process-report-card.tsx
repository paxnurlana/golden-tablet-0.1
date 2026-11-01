"use client";
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {Plus,Trash2} from 'lucide-react';
import {SlashTextarea} from './slash-textarea';
import {postJson,useApi} from '@/lib/use-api';
import {emptyProcessReport,processCriteria,processComplete,processDaySteps,processWeekday,shiftProcessDate,type ProcessReport} from '@/lib/process-equity';
export type ProcessData={reports:ProcessReport[];demo:ProcessReport[];today:string;now:number;start:string};
type Patch=Record<string,unknown>;
export function useProcessData(){
 const api=useApi<ProcessData>('/api/process-progress');
 useEffect(()=>{const refresh=()=>api.refresh();const timer=setInterval(refresh,30000);window.addEventListener('process-progress-updated',refresh);window.addEventListener('focus',refresh);return()=>{clearInterval(timer);window.removeEventListener('process-progress-updated',refresh);window.removeEventListener('focus',refresh);};},[api.refresh]);return api;
}
function applyPatch(report:ProcessReport,patch:Patch):ProcessReport{
 if(patch.op==='weekly')return {...report,weekly:{...report.weekly,...(patch.text!==undefined?{text:String(patch.text)}:{}),...(patch.score!==undefined?{score:patch.score as number|null}:{})}};
 if(patch.op==='item')return {...report,items:report.items.map(i=>i.id===patch.id?{...i,...(patch.text!==undefined?{text:String(patch.text)}:{}),...(patch.score!==undefined?{score:patch.score as number|null}:{})}:i)};
 return report;
}
export function ProcessReportCard({date,demo=false}:{date:string;demo?:boolean}){
 const api=useProcessData();const [draft,setDraft]=useState(()=>emptyProcessReport(date));const draftRef=useRef(draft);draftRef.current=draft;
 const [hint,setHint]=useState(''),[error,setError]=useState(''),[extraName,setExtraName]=useState(''),[acting,setActing]=useState(false);
 const pending=useRef<Patch[]>([]),pumping=useRef(false),timer=useRef<ReturnType<typeof setTimeout>|null>(null),mounted=useRef(true);
 const key=`process-report-pending:${date}`;
 const store=()=>{try{if(pending.current.length)localStorage.setItem(key,JSON.stringify(pending.current));else localStorage.removeItem(key);}catch{}};
 async function pump(){
  if(pumping.current||demo)return;pumping.current=true;
  try{while(pending.current.length){
   const patch=pending.current[0]!;const result=await postJson<{report:ProcessReport}>('/api/process-progress',{date,...patch});
   pending.current.shift();store();if(mounted.current&&pending.current.length===0){setDraft(result.report);setHint('Сохранено');setError('');}
   window.dispatchEvent(new Event('process-progress-updated'));
  }}catch(cause){if(mounted.current){setHint('Черновик на устройстве');setError(cause instanceof Error?cause.message:'Не удалось сохранить');}}
  finally{pumping.current=false;}
 }
 useEffect(()=>{
  mounted.current=true;
  if(!demo)try{const saved=JSON.parse(localStorage.getItem(key)||'[]');if(Array.isArray(saved))pending.current=saved.filter(p=>p&&['item','weekly'].includes(p.op));}catch{}
  const retry=()=>void pump();window.addEventListener('online',retry);if(pending.current.length)void pump();
  return()=>{mounted.current=false;if(timer.current)clearTimeout(timer.current);if(pending.current.length)void pump();window.removeEventListener('online',retry);};
 },[date,demo]);
 useEffect(()=>{
  if(!api.data)return;const report=(demo?api.data.demo:api.data.reports).find(r=>r.date===date)??emptyProcessReport(date);
  if(report.revision<draftRef.current.revision)return;
  setDraft(pending.current.reduce(applyPatch,report));
 },[api.data,date,demo]);
 const locked=demo||!api.data||date>api.data.today;
 function change(patch:Patch,immediate=false){
  if(locked)return;setDraft(current=>applyPatch(current,patch));setHint('Сохраняем…');
  const from=pumping.current?1:0;const index=pending.current.findIndex((p,i)=>i>=from&&p.op===patch.op&&p.id===patch.id);
  if(index>=0)pending.current[index]={...pending.current[index],...patch};else pending.current.push(patch);
  store();if(timer.current)clearTimeout(timer.current);if(immediate)void pump();else timer.current=setTimeout(()=>void pump(),600);
 }
 async function action(op:'add'|'remove',id?:string){
  if(locked||acting)return;setActing(true);try{
   if(timer.current)clearTimeout(timer.current);await pump();if(pending.current.length||pumping.current)throw Error('Дождись сохранения текста и повтори');
   const result=await postJson<{report:ProcessReport}>('/api/process-progress',{date,op,...(op==='add'?{name:extraName}:{id})});setDraft(result.report);setExtraName('');setError('');window.dispatchEvent(new Event('process-progress-updated'));
  }catch(cause){setError(cause instanceof Error?cause.message:'Ошибка сохранения');}finally{setActing(false);}
 }
 const criteria=processCriteria(draft);
 const steps=processDaySteps(draft,api.data?.now??Date.now()),total=steps.length?steps.reduce((sum,s)=>sum+s.value,0):null;
 const scoreSelect=(value:number|null,onChange:(value:number|null)=>void,label:string,weekly=false)=><select aria-label={label} disabled={locked} value={value??''} onChange={e=>onChange(e.target.value===''?null:Number(e.target.value))} className="rounded-lg border bg-background px-3 py-2 text-sm font-semibold"><option value="">Балл</option>{(weekly?[3,2,1,0,-1,-2,-3]:[1,0,-1,-2,-3]).map(score=><option key={score} value={score}>{score>0?'+':''}{score}</option>)}</select>;
 const monday=shiftProcessDate(date,-((processWeekday(date)+6)%7));
 return <section aria-label={`Daily Report Card ${date}`} className="space-y-4">
 <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-xl font-semibold">Daily Report Card</h3><p className="mt-1 text-xs text-muted-foreground">{date} · {demo?'Демо · не влияет на реальные данные':processComplete(draft)?'Все критерии оценены':'Заполнено '+draft.items.filter(i=>criteria.some(c=>c.id===i.id)&&i.score!==null).length+'/4'}</p></div>
 <div className="flex items-center gap-3"><span className={`text-xl font-semibold tabular-nums ${total===null?'':total<0?'text-red-400':total>0?'text-emerald-400':'text-muted-foreground'}`}>{total===null?'—':(total>0?'+':'')+total}</span><Link className="text-xs text-sky-400 hover:underline" href={`/journal?review=day&date=${date}`}>Дневная карта ↗</Link></div></div>
 {draft.criteriaVersion!==2&&<p role="note" className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">Этот рапорт сохранён по прежним критериям. Названия, пояснения и оценки сохранены; Daily Improvement здесь означает разбор дня, не сопровождение сделки.</p>}
 {date> (api.data?.today??date)&&<p className="text-xs text-muted-foreground">Будущий день — оценки пока недоступны.</p>}
 {draft.items.map(item=><section key={item.id} className="rounded-xl border border-border/60 bg-card/40 p-4">
 <div className="mb-3 flex items-center justify-between gap-3"><div><h4 className="text-sm font-semibold">{item.name}</h4><p className="mt-1 text-xs text-muted-foreground">{criteria.find(c=>c.id===item.id)?.hint??'Дополнительный критерий · только этот день'}</p></div><div className="flex items-center gap-1">{scoreSelect(item.score,score=>change({op:'item',id:item.id,score},true),`Балл: ${item.name}`)}{!criteria.some(c=>c.id===item.id)&&<button type="button" disabled={locked||acting} aria-label={`Удалить критерий ${item.name}`} onClick={()=>void action('remove',item.id)} className="rounded p-2 text-muted-foreground hover:text-destructive"><Trash2 className="size-4"/></button>}</div></div>
 <SlashTextarea aria-label={`Пояснение: ${item.name}`} data-workflow-source={`process:${date}:${item.id}`} value={item.text} readOnly={locked} rows={2} placeholder="Что сделал и почему такая оценка? Короткое пояснение желательно." onChange={e=>change({op:'item',id:item.id,text:e.target.value})} onBlur={()=>void pump()} className="w-full resize-none bg-transparent text-sm leading-6 outline-none"/>
 </section>)}
 {!demo&&<div className="flex items-center gap-2"><input aria-label="Название дополнительного критерия" value={extraName} disabled={locked} onChange={e=>setExtraName(e.target.value)} placeholder="Разовый критерий на сегодня…" maxLength={200} className="min-w-0 flex-1 rounded-lg border bg-transparent px-3 py-2 text-sm"/><button type="button" disabled={locked||acting||!extraName.trim()} onClick={()=>void action('add')} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs disabled:opacity-40"><Plus className="size-3.5"/>Добавить</button></div>}
 {[0,6].includes(processWeekday(date))&&<section className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4"><div className="mb-3 flex items-center justify-between gap-2"><h4 className="text-sm font-semibold">Weekly Improvement · необязательно</h4>{scoreSelect(draft.weekly.score,score=>change({op:'weekly',score},true),'Балл за недельное улучшение',true)}</div><SlashTextarea value={draft.weekly.text} readOnly={locked} rows={2} aria-label="Недельная самооценка" placeholder="Над чем работал и почему такая оценка…" onChange={e=>change({op:'weekly',text:e.target.value})} onBlur={()=>void pump()} className="w-full resize-none bg-transparent text-sm outline-none"/><Link href={`/journal?review=week&date=${monday}`} className="mt-2 inline-block text-xs text-sky-400">Цель и разбор в Weekly Review ↗</Link></section>}
 {steps.some(s=>s.kind==='correction')&&<p className="text-xs text-amber-400">Автокорректировка: {steps.filter(s=>s.kind==='correction').reduce((sum,s)=>sum+s.value,0)} · наличие −2 ограничивает день максимумом 0, −3 — максимумом −3.</p>}
 <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span aria-live="polite">{hint||'Автосохранение · без кнопки сохранения'}</span>{draft.updatedAt&&<span>Обновлено: {new Date(draft.updatedAt).toLocaleString('ru-RU',{timeZone:'Asia/Almaty'})}</span>}</div>
 {(api.error||error)&&<p role="alert" className="text-sm text-destructive">{api.error||error}{error&&<button type="button" onClick={()=>void pump()} className="ml-2 underline">Повторить</button>}</p>}
 </section>;
}
