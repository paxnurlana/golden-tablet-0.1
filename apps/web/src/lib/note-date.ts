export function noteDate(createdAt:string){
 const parts=new Intl.DateTimeFormat('ru-RU',{timeZone:'Asia/Qyzylorda',weekday:'short',day:'numeric',month:'long',year:'numeric'}).formatToParts(new Date(createdAt));
 const get=(type:Intl.DateTimeFormatPartTypes)=>parts.find(p=>p.type===type)?.value??'';
 const month=get('month');return `${get('weekday').toUpperCase()} ${get('day')} ${month.charAt(0).toUpperCase()+month.slice(1)} ${get('year')}`;
}
