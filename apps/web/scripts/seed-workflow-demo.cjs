const Database=require('better-sqlite3');
const {resolve}=require('node:path');
const batch='workflow-demo-2026-10-09';
const samples={inbox:['Проверить пробой VAH со стопом 50 тиков','Собрать примеры D shape','Разобрать входы относительно VWAP'],doing:['Бэктест пробоя Value Area за октябрь','Проверка циклов ATR','Разбор ошибок повторного входа'],done:['Подготовить план торговой сессии','Собрать скриншоты сделок','Записать выводы по торговой неделе']};
(async()=>{
  let response=await fetch('http://127.0.0.1:3001/api/workflow');
  if(!response.ok)throw new Error('Workflow read failed');
  const existing=(await response.json()).cards;
  const ids=[];
  for(const [status,tasks] of Object.entries(samples))for(const task of tasks){
    const text=`DEMO · ${batch} · ${task}`;
    const found=existing.find(card=>card.text===text);
    if(found){ids.push(found.id);continue;}
    response=await fetch('http://127.0.0.1:3001/api/workflow',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'create',category:'задача',status,text})});
    if(!response.ok)throw new Error(await response.text());
    ids.push((await response.json()).id);
  }
  const db=new Database(resolve(__dirname,'../data/journal.db'));
  try{db.prepare('INSERT INTO personal_demo_batches(id,manifest,created_at) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET manifest=excluded.manifest').run(batch,JSON.stringify({batch,workflowCards:ids}),new Date().toISOString());}finally{db.close();}
  console.log(JSON.stringify({batch,cards:ids.length}));
})().catch(error=>{console.error(error);process.exitCode=1;});
