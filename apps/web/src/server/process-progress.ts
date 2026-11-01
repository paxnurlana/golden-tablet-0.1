import {randomUUID} from 'node:crypto';
import {reviewConnection,validReviewKey} from './trading-review';
import {requireValue} from './api';
import {emptyProcessReport,processCriteria,processDate,processWeekday,type ProcessReport} from '@/lib/process-equity';
function connection(){const db=reviewConnection();db.exec(`CREATE TABLE IF NOT EXISTS personal_process_reports(date TEXT PRIMARY KEY,content TEXT NOT NULL,revision INTEGER NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS personal_process_report_history(id TEXT PRIMARY KEY,date TEXT NOT NULL,revision INTEGER NOT NULL,content TEXT NOT NULL,changed_at TEXT NOT NULL);`);return db;}
export function listProcessReports(){const db=connection();try{return (db.prepare('SELECT content,revision,updated_at FROM personal_process_reports ORDER BY date').all() as {content:string;revision:number;updated_at:string}[]).map(row=>({...JSON.parse(row.content),revision:row.revision,updatedAt:row.updated_at}) as ProcessReport);}finally{db.close();}}
export function patchProcessReport(input:Record<string,unknown>){
 requireValue(input.demo!==true,'Демо нельзя сохранять в реальные рапорты');
 requireValue(validReviewKey(input.date)&&input.date<=processDate(),'Некорректная дата рапорта');const date=input.date;
 requireValue(typeof input.op==='string','Не указано действие');
 const db=connection();try{return db.transaction(()=>{
  const existing=db.prepare('SELECT * FROM personal_process_reports WHERE date=?').get(date) as {content:string;revision:number}|undefined;
  const report:ProcessReport=existing?JSON.parse(existing.content):emptyProcessReport(date);
  const criteria=processCriteria(report);
  const score=(value:unknown,max=1)=>{requireValue(value===null||typeof value==='number'&&Number.isInteger(value)&&value>=-3&&value<=max,'Некорректный балл');return value as number|null;};
  const text=(value:unknown,max=100000)=>{requireValue(typeof value==='string'&&value.length<=max,'Некорректный текст');return value;};
  if(input.op==='item'){
   const item=report.items.find(i=>i.id===input.id);requireValue(item,'Критерий не найден');
   if(input.text!==undefined)item.text=text(input.text);
   if(input.score!==undefined)item.score=score(input.score);
   if(input.name!==undefined){requireValue(!criteria.some(c=>c.id===item.id),'Основной критерий нельзя переименовать');item.name=text(input.name,200);requireValue(item.name.trim(),'Введите название');}
  }else if(input.op==='add'){
   requireValue(report.items.length<24,'Слишком много критериев');const name=text(input.name,200).trim();requireValue(name,'Введите название');report.items.push({id:randomUUID(),name,text:'',score:null});
  }else if(input.op==='remove'){
   requireValue(typeof input.id==='string'&&!criteria.some(c=>c.id===input.id),'Основной критерий нельзя удалить');report.items=report.items.filter(i=>i.id!==input.id);
  }else if(input.op==='weekly'){
   requireValue([0,6].includes(processWeekday(date)),'Недельная самооценка доступна в выходные');
   if(input.text!==undefined)report.weekly.text=text(input.text);
   if(input.score!==undefined)report.weekly.score=score(input.score,3);
  }else requireValue(false,'Неизвестное действие');
  const content=JSON.stringify({...report,revision:0,updatedAt:null}),now=new Date().toISOString();
  const revision=(existing?.revision??0)+1;
  db.prepare('INSERT INTO personal_process_reports(date,content,revision,created_at,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(date) DO UPDATE SET content=excluded.content,revision=excluded.revision,updated_at=excluded.updated_at').run(date,content,revision,now,now);
  db.prepare('INSERT INTO personal_process_report_history(id,date,revision,content,changed_at) VALUES (?,?,?,?,?)').run(randomUUID(),date,revision,content,now);
  return {...report,revision,updatedAt:now};
 }).immediate();}finally{db.close();}
}
