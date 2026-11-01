export const JOURNAL_METRIC_IDS=['Сделки / Записи','Win Rate','Hit Rate','Survival Rate','Realised RR','PNL','Unrealised RR','Avg MAE','Avg MFE','Missed trades'];
export function metricLayout(raw:unknown){
 const saved=raw&&typeof raw==='object'?raw as {order?:unknown;hidden?:unknown}:{};
 const valid=(value:unknown)=>Array.isArray(value)?[...new Set(value.filter((id):id is string=>typeof id==='string'&&JOURNAL_METRIC_IDS.includes(id)))]:[];
 const order=valid(saved.order);
 return {order:[...order,...JOURNAL_METRIC_IDS.filter(id=>!order.includes(id))],hidden:valid(saved.hidden)};
}
export function moveMetric(order:string[],from:string,to:string){
 if(from===to||!order.includes(from)||!order.includes(to))return order;
 const next=order.filter(id=>id!==from);next.splice(order.indexOf(to),0,from);return next;
}
