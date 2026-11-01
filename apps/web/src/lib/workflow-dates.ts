export function workflowDate(value?:string|null,full=false){
 if(!value||!Number.isFinite(Date.parse(value)))return 'Нет данных';
 return new Intl.DateTimeFormat('ru-RU',{timeZone:'Asia/Qyzylorda',day:'numeric',month:full?'long':'short',year:'numeric',...(full?{hour:'2-digit',minute:'2-digit'}:{})}).format(new Date(value));
}
export function workflowStatusAge(value?:string|null,now=Date.now()){
 if(!value||!Number.isFinite(Date.parse(value)))return 'Нет истории статуса';
 const days=Math.max(0,Math.floor((now-Date.parse(value))/86400000));
 return days===0?'Сегодня':`${days} дн. в статусе`;
}
