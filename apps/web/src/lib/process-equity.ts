export const PROCESS_START='2026-10-19';
export const LEGACY_PROCESS_CRITERIA=[{id:'preparation',name:'Preparation',hint:'Подготовка, состояние и анализ рынка'},{id:'risk',name:'Risk Discipline',hint:'Риск, лимиты и управление позицией'},{id:'execution',name:'Execution Quality',hint:'Сетапы, подтверждение и качество действий'},{id:'improvement',name:'Daily Improvement',hint:'Разбор дня и конкретное улучшение'}] as const;
export const PROCESS_CRITERIA=[
 {id:'preparation',name:'Подготовка',hint:'Анализ рынка, сценарии, уровни и состояние перед сессией.'},
 {id:'risk',name:'Риск и ограничения',hint:'Объём, первоначальный стоп, риск на идею и лимит потерь. Не увеличивал ли риск после убытка?'},
 {id:'execution',name:'Вход и реализация возможностей',hint:'Сетап, подтверждение и своевременный вход. Без FOMO и пропусков по своей вине; нет сетапа — можно не входить.'},
 {id:'management',name:'Сопровождение и выход',hint:'Перевод в БУ, перенос стопа, удержание позиции и исполнение TP по плану. Обычный стоп по правилам — не ошибка.'},
] as const;
export type ProcessItem={id:string;name:string;text:string;score:number|null};
export type ProcessReport={criteriaVersion?:1|2;date:string;items:ProcessItem[];weekly:{text:string;score:number|null};revision:number;updatedAt:string|null;demo?:boolean};
export const processCriteria=(report:ProcessReport)=>report.criteriaVersion===2?PROCESS_CRITERIA:LEGACY_PROCESS_CRITERIA;
export type ProcessStep={date:string;name:string;value:number;kind:'criterion'|'extra'|'correction'|'weekly';provisional:boolean};
export type ProcessPoint={key:string;date:string;label:string;value:number;change:number;steps:ProcessStep[]};
export const processDate=(now=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Almaty',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
export const shiftProcessDate=(date:string,days:number)=>new Date(Date.parse(date+'T12:00:00Z')+days*86400000).toISOString().slice(0,10);
export const processWeekday=(date:string)=>new Date(date+'T12:00:00Z').getUTCDay();
export const emptyProcessReport=(date:string):ProcessReport=>({criteriaVersion:2,date,items:PROCESS_CRITERIA.map(c=>({...c,text:'',score:null})),weekly:{text:'',score:null},revision:0,updatedAt:null});
export const processComplete=(report:ProcessReport)=>processCriteria(report).every(c=>report.items.find(i=>i.id===c.id)?.score!=null);
export function processDaySteps(report:ProcessReport,_now=Date.now()):ProcessStep[]{
 const weekday=processWeekday(report.date),complete=processComplete(report),criteria=processCriteria(report);
 const ordered=[...criteria.flatMap(c=>{const item=report.items.find(i=>i.id===c.id);return item?[item]:[];}),...report.items.filter(i=>!criteria.some(c=>c.id===i.id))];
 const steps:ProcessStep[]=ordered.filter(i=>i.score!==null).map(i=>({date:report.date,name:i.name,value:i.score!,kind:criteria.some(c=>c.id===i.id)?'criterion':'extra',provisional:!complete}));
 const scores=steps.map(s=>s.value),sum=scores.reduce((a,b)=>a+b,0);
 const cap=scores.includes(-3)?-3:scores.includes(-2)?0:null;
 if(cap!==null&&sum>cap)steps.push({date:report.date,name:'Ограничение дня',value:cap-sum,kind:'correction',provisional:!complete});
 if((weekday===0||weekday===6)&&report.weekly.score!==null)steps.push({date:report.date,name:'Weekly Improvement',value:report.weekly.score,kind:'weekly',provisional:false});
 return steps;
}
export function processLinePoints(reports:ProcessReport[],frame:'criteria'|'days',now=Date.now()):ProcessPoint[]{
 const unique=[...new Map(reports.map(r=>[r.date,r])).values()].sort((a,b)=>a.date.localeCompare(b.date));
 let equity=0;const points:ProcessPoint[]=[];
 for(const report of unique)for(const [index,step] of processDaySteps(report,now).entries()){
  if(!points.length)points.push({key:'origin',date:report.date,label:'Начало',value:0,change:0,steps:[]});
  equity+=step.value;
  const key=frame==='criteria'?`${report.date}:${index}`:report.date;
  const previous=points.at(-1);
  if(previous?.key===key){previous.value=equity;previous.change+=step.value;previous.steps.push(step);}
  else points.push({key,date:report.date,label:frame==='criteria'?step.name:'Итог дня',value:equity,change:step.value,steps:[step]});
 }
 return points;
}
export function processReportsThrough(reports:ProcessReport[],now=Date.now()){
 const map=new Map(reports.map(r=>[r.date,r]));const today=processDate(new Date(now));
 for(let date=PROCESS_START;date<=today;date=shiftProcessDate(date,1)){
  const day=processWeekday(date);if(day!==0&&day!==6&&!map.has(date))map.set(date,emptyProcessReport(date));
 }
 return [...map.values()].sort((a,b)=>a.date.localeCompare(b.date));
}
export function demoProcessReports(){
 const patterns=[[1,1,1,1],[1,-1,1,0],[1,-2,1,1],[0,1,-1,1],[1,-3,0,1],[1,1,-1,-1],[-1,0,1,1],[0,0,0,0]];
 const reports:ProcessReport[]=[];
 for(let date='2026-09-28';date<='2026-10-16';date=shiftProcessDate(date,1)){
  if([0,6].includes(processWeekday(date)))continue;
  const report=emptyProcessReport(date),index=reports.length;
  report.demo=true;report.items.forEach((item,i)=>{item.score=patterns[index%patterns.length]![i]!;item.text=`Демо-пример: ${item.name}. Оценка за соблюдение процесса, не за PNL.`;});
  if(index===3)report.items.push({id:'demo-extra',name:'Контроль отвлечений',text:'Разовый дополнительный критерий',score:-1});
  if(index===9)report.items.push({id:'demo-extra-1',name:'Работа с уровнем',text:'Разовый критерий',score:1},{id:'demo-extra-2',name:'Контроль внимания',text:'Разовый критерий',score:0});
  reports.push(report);
 }
 return reports;
}
