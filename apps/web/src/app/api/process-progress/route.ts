import {handler,ok,requireValue} from '@/server/api';
import {listProcessReports,patchProcessReport} from '@/server/process-progress';
import {demoProcessReports,PROCESS_START,processDate} from '@/lib/process-equity';
export const GET=handler(()=>ok({reports:listProcessReports(),demo:demoProcessReports(),today:processDate(),now:Date.now(),start:PROCESS_START}));
export const POST=handler(async(request:Request)=>{const input=await request.json();requireValue(input&&typeof input==='object'&&!Array.isArray(input),'Некорректный запрос');return ok({report:patchProcessReport(input)});});
