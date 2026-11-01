import {it,expect} from 'vitest';
import {emptyProcessReport,processDaySteps,processLinePoints,processReportsThrough,processComplete,demoProcessReports,LEGACY_PROCESS_CRITERIA,processCriteria} from '../src/lib/process-equity';
const now=Date.parse('2026-10-18T10:00:00Z');
function report(date:string,scores:(number|null)[]){const r=emptyProcessReport(date);r.items.forEach((item,i)=>item.score=scores[i]??null);return r;}
it('builds a continuous cumulative line, includes origin and aggregates days without hiding zero',()=>{
 const first=report('2026-10-12',[1,1,1,-1]),second=report('2026-10-13',[-1,1,1,1]);
 const steps=processLinePoints([first,second],'criteria',now),daily=processLinePoints([first,second],'days',now);
 expect(steps.map(p=>p.value)).toEqual([0,1,2,3,2,1,2,3,4]);
 expect(daily.map(p=>p.value)).toEqual([0,2,4]);expect(daily[1]!.steps).toHaveLength(4);
 expect(processLinePoints([report('2026-10-12',[1,-1,1,-1])],'days',now).at(-1)).toMatchObject({value:0,change:0});
});
it('adds one explicit cap correction, never a hidden change',()=>{
 const serious=processDaySteps(report('2026-10-12',[1,-2,1,1]),now);expect(serious).toHaveLength(5);expect(serious.at(-1)).toMatchObject({kind:'correction',value:-1});expect(serious.reduce((a,b)=>a+b.value,0)).toBe(0);
 const critical=processDaySteps(report('2026-10-12',[1,-3,1,1]),now);expect(critical.at(-1)).toMatchObject({kind:'correction',value:-3});
 expect(processDaySteps(report('2026-10-12',[-3,-3,-3,-3]),now)).toHaveLength(4);
});
it('keeps partial scores after the former deadline and never penalizes missing reports',()=>{
 const partial=report('2026-10-19',[1,1,1,null]),deadline=Date.parse('2026-10-19T22:00:00Z');
 for(const time of [deadline-1,deadline,deadline+86400000]){
  expect(processDaySteps(partial,time).map(s=>s.value)).toEqual([1,1,1]);
  expect(processDaySteps(partial,time).every(s=>s.provisional)).toBe(true);
  expect(processDaySteps(emptyProcessReport(partial.date),time)).toEqual([]);
 }
 partial.items[3]!.score=1;expect(processDaySteps(partial,deadline+100).map(s=>s.value)).toEqual([1,1,1,1]);expect(processComplete(partial)).toBe(true);
 partial.items[0]!.score=0;expect(processComplete(partial)).toBe(true);
});
it('keeps missing weekdays empty in the calendar and excludes them from the line',()=>{
 const later=Date.parse('2026-10-26T10:00:00Z');
 const reports=processReportsThrough([],Date.parse('2026-10-25T10:00:00Z'));
 expect(reports.map(r=>r.date)).toEqual(['2026-10-19','2026-10-20','2026-10-21','2026-10-22','2026-10-23']);
 expect(processLinePoints(reports,'criteria',later)).toEqual([]);
 expect(processLinePoints(reports,'days',later)).toEqual([]);
 const partial=report('2026-10-20',[1,0,null,null]);
 const withScores=processReportsThrough([partial],later);
 expect(processLinePoints(withScores,'days',later).map(p=>p.value)).toEqual([0,1]);
});
it('supports extra criteria and independent weekend improvement without a Weekly Report Card',()=>{
 const r=report('2026-10-12',[1,1,1,1]);r.items.push({id:'extra',name:'Focus',text:'',score:-2});const steps=processDaySteps(r,now);expect(steps).toHaveLength(6);expect(steps.reduce((a,b)=>a+b.value,0)).toBe(0);
 const weekend=emptyProcessReport('2026-10-17');weekend.weekly={text:'Studied',score:3};expect(processDaySteps(weekend,now)).toMatchObject([{kind:'weekly',value:3}]);
});
it('recomputes future openings but preserves future daily results when an older score changes',()=>{
 const first=report('2026-10-12',[1,1,1,0]),second=report('2026-10-13',[1,1,0,0]);
 const before=processLinePoints([first,second],'days',now);first.items[0]!.score=-1;const after=processLinePoints([first,second],'days',now);
 expect(before[2]!.value-after[2]!.value).toBe(2);expect(before[2]!.change).toBe(after[2]!.change);
});
it('keeps deterministic demos separate and starts them on Sep 28',()=>{
 const demo=demoProcessReports();expect(demo[0]!.date).toBe('2026-09-28');expect(demo.every(r=>r.demo)).toBe(true);expect(demo).toEqual(demoProcessReports());expect(processLinePoints(demo,'days',now).length).toBeGreaterThan(10);
});
it('keeps original criteria semantics for unversioned reports and uses management for new ones',()=>{
 const old={...emptyProcessReport('2026-10-12'),criteriaVersion:undefined,items:LEGACY_PROCESS_CRITERIA.map(c=>({...c,text:'Historical answer',score:1}))};
 expect(processComplete(old)).toBe(true);expect(processCriteria(old).at(-1)!.id).toBe('improvement');
 expect(processDaySteps(old,now).at(-1)!.name).toBe('Daily Improvement');
 const current=emptyProcessReport('2026-10-12');expect(current.criteriaVersion).toBe(2);expect(current.items.at(-1)!.id).toBe('management');
 expect(current.items.map(i=>i.name)).toEqual(['Подготовка','Риск и ограничения','Вход и реализация возможностей','Сопровождение и выход']);
});
