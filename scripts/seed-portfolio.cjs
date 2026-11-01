// Fictional portfolio fixtures. The personal project can never be a seed target.
const {resolve,basename,join}=require('node:path');
const Database=require(require.resolve('better-sqlite3',{paths:[resolve(__dirname,'../apps/web')]}));
const root=resolve(__dirname,'..');
const {mkdirSync,readFileSync}=require('node:fs');
if(JSON.parse(readFileSync(join(root,'package.json'),'utf8')).name!=='golden-tablet-portfolio')throw Error('Portfolio-only seed; refusing another project.');
mkdirSync(join(root,'apps/web/data'),{recursive:true});
const db=new Database(join(root,'apps/web/data/journal.db'));
db.exec(readFileSync(join(__dirname,'portfolio-schema.sql'),'utf8'));
db.pragma('foreign_keys=ON');
if(db.prepare("SELECT count(*) n FROM personal_journal_entries WHERE id NOT LIKE 'portfolio-%'").get().n)throw Error('Non-demo journal data found; no changes made.');
const now='2026-10-30T17:00:00Z';

if(process.argv.includes('--refresh')){
 const backup=join(root,'apps/web/data','before-demo-refresh-'+Date.now()+'.db');
 db.exec(`VACUUM INTO '${backup.replaceAll("'","''")}'`);
 db.transaction(()=>{
  for(const table of ['trade_rule_checks','trade_excursions'])db.prepare(`DELETE FROM ${table} WHERE trade_key LIKE 'portfolio-trade-%'`).run();
  db.prepare("DELETE FROM trades WHERE key LIKE 'portfolio-trade-%'").run();
  db.prepare("DELETE FROM executions WHERE id LIKE 'portfolio-trade-%'").run();
  db.prepare("DELETE FROM personal_journal_entry_terms WHERE entry_id LIKE 'portfolio-trade-%'").run();
  db.prepare("DELETE FROM personal_journal_account_results WHERE entry_id LIKE 'portfolio-trade-%'").run();
  db.prepare("DELETE FROM personal_journal_entries WHERE id LIKE 'portfolio-trade-%'").run();
  for(const table of ['personal_session_entries','personal_workflow_cards','notes','personal_process_report_history'])db.prepare(`DELETE FROM ${table} WHERE id LIKE 'portfolio-%'`).run();
  db.prepare('DELETE FROM personal_trading_reviews WHERE updated_at=?').run(now);
  db.prepare('DELETE FROM journal_days WHERE updated_at=?').run(now);
  db.prepare('DELETE FROM personal_process_reports WHERE updated_at=?').run(now);
  for(const table of ['personal_account_profiles','personal_account_phases','personal_account_movements'])db.prepare(`DELETE FROM ${table} WHERE account_id LIKE 'portfolio-%'`).run();
  db.prepare("DELETE FROM prop_receipts WHERE id LIKE 'portfolio-%'").run();
  db.prepare("DELETE FROM prop_entries WHERE id LIKE 'portfolio-%'").run();
  db.prepare("DELETE FROM prop_accounts WHERE id LIKE 'portfolio-%'").run();
  db.prepare("DELETE FROM personal_account_firms WHERE id LIKE 'portfolio-firm-%'").run();
  db.prepare("DELETE FROM personal_journal_terms WHERE id IN ('portfolio-meridian','portfolio-atlas','portfolio-northstar','portfolio-personal')").run();
  db.prepare("DELETE FROM accounts WHERE id IN ('portfolio-meridian','portfolio-atlas','portfolio-northstar','portfolio-personal')").run();
  if(db.prepare("SELECT 1 FROM sqlite_master WHERE name='journal_analytics_state'").get())db.exec('DELETE FROM journal_analytics_state');
 })();
 console.log('Backup:',backup);
}

const days=Array.from({length:30},(_,i)=>'2026-10-'+String(i+1).padStart(2,'0')).filter(d=>![0,6].includes(new Date(d+'T12:00:00Z').getUTCDay()));
const weekStart=date=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return d.toISOString().slice(0,10);};
const accounts=[
 {id:'portfolio-meridian',name:'FTMO · Demo 50K',firm:'FTMO',size:50000,market:'CFD',quantity:.5},
 {id:'portfolio-atlas',name:'The5ers · Demo 100K',firm:'The5ers',size:100000,market:'CFD',quantity:1},
 {id:'portfolio-northstar',name:'FundedNext · Demo 25K',firm:'FundedNext',size:25000,market:'CFD',quantity:.25},
 {id:'portfolio-personal',name:'Личный · 10K',firm:null,size:10000,market:'CFD',quantity:.1},
];
const setups=[
 {id:'portfolio-pb-breakout',name:'Opening Range Breakout',description:'Пробой утреннего диапазона с подтверждением объёмом. Вход после закрытия свечи за границей диапазона.',rules:['Контекст старшего таймфрейма поддерживает вход','Пробой подтверждён закрытием свечи','Риск определён до входа','Выход по плану, без переноса цели из-за эмоций']},
 {id:'portfolio-pb-vwap',name:'VWAP Pullback',description:'Продолжение движения после возврата к VWAP. Требуется реакция цены и понятная точка отмены идеи.',rules:['Есть направленный контекст','Получена реакция у VWAP','Стоп за локальной структурой','Цель не менее 1R']},
 {id:'portfolio-pb-value',name:'Value Area Rejection',description:'Возврат в диапазон после неудачной попытки закрепиться за Value Area. Демонстрационная модель.',rules:['Определены VAH, VAL и POC','За границей нет принятия цены','Вход после возврата в диапазон','Цель — следующая зона объёма']},
];
const outcomes=[1.5,-1,2,0,1.2,-1,2.4,1.8,-1,1.4];
const textBlock=(text,id='text')=>[{id,kind:'text',text}];
const insert=(table,row)=>{const keys=Object.keys(row);db.prepare(`INSERT OR IGNORE INTO ${table} (${keys.join(',')}) VALUES (${keys.map(()=>'?').join(',')})`).run(...Object.values(row));};
const term=(id,kind,name,description='')=>{insert('personal_journal_terms',{id,kind,name,description,logo:''});return id;};
const link=(entryId,termId)=>insert('personal_journal_entry_terms',{entry_id:entryId,term_id:termId});
const rows=[];
db.transaction(()=>{
 for(const [id,name] of [['all','All notes'],['trade-notes','Trade notes'],['daily-journal','Daily journal'],['session-recaps','Session recaps'],['my-notes','My notes']])insert('folders',{id,name,kind:'system',created_at:now});
 for(const name of ['Win','Loss','BE','Missed','НЛО','Hypothesis'])if(!db.prepare("SELECT id FROM personal_journal_terms WHERE kind='result' AND name=?").get(name))term('portfolio-default-'+name,'result',name);
 // Replace only the stock generated demo account, never user-created accounts.
 for(const legacy of db.prepare("SELECT id FROM accounts WHERE broker='demo' AND name='Demo data'").all()){
  for(const table of ['trade_excursions','trade_rule_checks'])db.prepare(`DELETE FROM ${table} WHERE trade_key IN (SELECT key FROM trades WHERE account_id=?)`).run(legacy.id);
  db.prepare('DELETE FROM trades WHERE account_id=?').run(legacy.id);
  db.prepare('DELETE FROM executions WHERE account_id=?').run(legacy.id);
  db.prepare('DELETE FROM accounts WHERE id=?').run(legacy.id);
 }
 insert('settings',{key:'timeZone',value:'Asia/Almaty'});
 insert('settings',{key:'multipliers',value:JSON.stringify({GC:100,XAUUSD:100})});
 insert('settings',{key:'journalDefaults',value:JSON.stringify({breakeven:5,breakevenMode:'money',feeRules:[],riskRules:[]})});
 const results=Object.fromEntries(['Win','Loss','Breakeven'].map(name=>{const existing=db.prepare("SELECT id FROM personal_journal_terms WHERE kind='result' AND name IN (?,?)").get(name,name==='Breakeven'?'BE':name);return [name,existing?.id??term('portfolio-result-'+name.toLowerCase(),'result',name)];}));
 const gold=term('portfolio-xau','instrument','XAUUSD','Золото · учебные котировки, не реальные сигналы.');
 const gc=term('portfolio-gc','instrument','GC','Фьючерс на золото · пример учёта контрактов.');
 const trigger=term('portfolio-trigger','trigger','Подтверждённый ретест','Закрытие свечи и реакция от уровня.');
 const storyline=term('portfolio-story','storyline','Продолжение импульса','Движение после возврата к опорной зоне.');
 const vp=term('portfolio-vp','vp','Возврат в Value Area');
 const vwap=term('portfolio-vwap','vwap','Реакция от VWAP');
 for(const setup of setups){term(setup.id,'setup',setup.name,setup.description);insert('playbooks',{id:setup.id,name:setup.name,description:setup.description,rules_json:JSON.stringify(setup.rules),created_at:now});}
 for(const [a,account] of accounts.entries()){
  term(account.id,'account',account.name,'Вымышленный аккаунт для демонстрации приложения.');
  const firmId=account.firm?'portfolio-firm-'+a:'';
  if(account.firm)insert('personal_account_firms',{id:firmId,name:account.firm,logo:''});
  const profile={kind:account.firm?'prop':'personal',market:account.market,firmId,accountSize:account.size,openingBalance:account.size,startDate:days[0],stage:'Funded',drawdownType:'Static',drawdown:account.firm?account.size*.08:0,dailyLimit:account.firm?account.size*.04:null,phase1Target:account.firm?account.size*.08:0,phase2Target:account.firm?account.size*.05:0,traderShare:account.firm?80:100,purchasePrice:account.firm?[249,399,149][a]:0,leverage:account.market==='CFD'?100:null};
  insert('personal_account_profiles',{account_id:account.id,profile_json:JSON.stringify(profile)});
  insert('personal_account_phases',{id:account.id+'-phase',account_id:account.id,stage:account.firm?'Funded':'Личный',date:days[0]});
  insert('accounts',{id:account.id,name:account.name,broker:account.firm??'Personal demo',kind:'manual',currency:'USD',initial_balance:account.size,created_at:now});
  let balance=account.size;
  const accountDays=Array.from({length:10},(_,i)=>days[(Math.floor(i*days.length/10)+a)%days.length]).sort();
  for(const [i,date] of accountDays.entries()){
   const rr=outcomes[(i+a*2)%10],result=rr>0?'Win':rr<0?'Loss':'Breakeven';
   const id=`portfolio-trade-${a+1}-${i+1}`,no=i*4+a+1,setup=setups[(i+a)%3];
   const riskTicks=50,realisedTicks=rr*50,riskCash=500*account.quantity,fee=account.market==='Futures'?5:2*account.quantity;
   const gross=rr*riskCash,pnl=Number((gross-fee).toFixed(2));
   const direction=(i+a)%2?'Short':'Long',sign=direction==='Long'?1:-1;
   const opened=`${date}T${String(14+a).padStart(2,'0')}:05:00Z`,closed=`${date}T${String(14+a).padStart(2,'0')}:${String(23+i%3*8).padStart(2,'0')}:00Z`;
   const entry=Number((4000+i*6+a*.7).toFixed(2)),exit=Number((entry+sign*realisedTicks*.1).toFixed(2));
   const extra=result==='Breakeven'?1:rr>0&&i%3===0?.6:null;
   const detail=result==='Loss'?'loss-stop':result==='Breakeven'?'be-target':extra?'win-manual':'win-target';
   const note=result==='Win'?'Дождался подтверждения и реализовал сценарий.':result==='Loss'?'Идея отменена: стоп исполнен по плану.':'Защитил позицию после замедления; движение продолжилось без меня.';
   const body=`ДЕМОНСТРАЦИОННАЯ СДЕЛКА · ${account.name}\n\nКонтекст: ${setup.description}\n\nПлан: дождаться подтверждения, заранее определить стоп ${riskTicks} тиков и цель. Направление: ${direction}.\n\nИсполнение: ${note}\n\nРазбор: ${extra?'После выхода осталось '+extra+'R потенциала. Следующий шаг — сравнить выход со структурой рынка.':'Решение оценивается по соблюдению плана, а не только по знаку PNL.'}\n\nДневной разбор: /journal?review=day&date=${date}`;
   insert('personal_journal_entries',{id,trade_no:no,date,mode:'Forward',direction,type:'',opened_at:`${String(19+a).padStart(2,'0')}:05`,closed_at:`${String(19+a).padStart(2,'0')}:${String(23+i%3*8).padStart(2,'0')}`,risk_ticks:riskTicks,realised_ticks:realisedTicks,realised_r:rr,mfe:Math.round(Math.max(realisedTicks,0)+(extra??.3)*50),mae:rr<0?50:8+(i*3+a)%22,quick_note:`${setup.name} · ${note}`,body_title:`${setup.name} · ${date}`,body_text:body,body_blocks_json:JSON.stringify(textBlock(body,id+'-body')),classification_json:JSON.stringify({detail,tags:[],targetHit:extra?false:result==='Win'}),potential_json:JSON.stringify({enabled:extra!==null,rr:extra,ticks:extra===null?null:extra*50,measurement:'remaining',basis:'after-exit',comment:'Учебный пример недобранного движения',accountCash:{}}),rr_basis_json:JSON.stringify({mode:'standard',ticks:50}),created_at:opened,updated_at:closed});
   for(const t of [account.market==='Futures'?gc:gold,results[result],setup.id,trigger,storyline,vp,vwap])link(id,t);
   insert('personal_journal_account_results',{entry_id:id,account_id:account.id,risk_pct:riskCash/balance*100,risk_cash:riskCash,base_balance:balance,pnl_cash:pnl,pnl_pct:pnl/balance*100,quantity:account.quantity,quantity_unit:account.market==='Futures'?'contracts':'lots'});
   const openId=id+'-open',closeId=id+'-close';
   for(const [exId,side,price,time] of [[openId,direction==='Long'?'buy':'sell',entry,opened],[closeId,direction==='Long'?'sell':'buy',exit,closed]])insert('executions',{id:exId,account_id:account.id,symbol:account.market==='Futures'?'GC':'XAUUSD',side,quantity:account.quantity,price,fee:fee/2,executed_at:time,asset_class:account.market==='Futures'?'futures':'cfd',source:'portfolio-demo',content_hash:exId,created_at:now});
   insert('trades',{key:id,account_id:account.id,symbol:account.market==='Futures'?'GC':'XAUUSD',asset_class:account.market==='Futures'?'futures':'cfd',direction:direction.toLowerCase(),status:result==='Win'?'win':result==='Loss'?'loss':'breakeven',opened_at:opened,closed_at:closed,quantity:account.quantity,open_quantity:0,avg_entry:entry,avg_exit:exit,gross_pnl:gross,fees:fee,net_pnl:pnl,execution_count:2,execution_ids_json:JSON.stringify([openId,closeId]),exits_json:JSON.stringify([{executionId:closeId,quantity:account.quantity,grossPnl:gross}]),duration_ms:Date.parse(closed)-Date.parse(opened),notes:note,tags_json:JSON.stringify(['Demo',setup.name]),mistakes_json:JSON.stringify(extra?['Ранний выход']:[]),playbook_id:setup.id,rating:result==='Win'?4:3,stop_loss:entry-sign*5,profit_target:entry+sign*(Math.max(rr,1.5)+(extra??0))*5,reviewed_at:now});
   setup.rules.forEach((rule,k)=>insert('trade_rule_checks',{id:id+'-rule-'+k,trade_key:id,playbook_id:setup.id,rule,followed:extra&&k===3?0:1}));
   balance+=pnl;rows.push({id,no,date,rr,pnl,account:account.id,result});
  }
  if(account.firm){
   const propId=account.id+'-prop';
   insert('prop_accounts',{id:propId,firm:account.firm,name:account.name,program:'funded',status:'active',currency:'USD',size_minor:account.size*100,journal_account_id:account.id,opened_on:days[0],notes:'Фирма реальная; счёт, условия, сделки и денежные операции вымышленные. Неофициальная демонстрация.',created_at:now,updated_at:now});
   insert('prop_entries',{id:propId+'-purchase',account_id:propId,firm:account.firm,kind:'expense',category:'evaluation',currency:'USD',amount_minor:profile.purchasePrice*100,split_bps:10000,fee_minor:0,occurred_on:days[0],status:'completed',reference:'DEMO-FEE-'+a,notes:'Пример учёта покупки аккаунта',created_at:now,updated_at:now});
   const payout=[500,1000,750][a],payoutId=propId+'-payout';
   insert('prop_entries',{id:payoutId,account_id:propId,firm:account.firm,kind:'payout',category:'other',currency:'USD',amount_minor:payout*100,split_bps:8000,fee_minor:0,occurred_on:days.at(-1),due_on:days.at(-1),status:'completed',reference:'DEMO-PAYOUT-'+a,notes:'Учебная выплата: доля трейдера 80%',created_at:now,updated_at:now});
   insert('personal_account_movements',{id:account.id+'-payout',account_id:account.id,kind:'payout',date:days.at(-1),amount:payout*.8,received:payout*.8,note:'Учебная выплата, также отражена в Prop firms'});
   insert('prop_receipts',{id:payoutId+'-receipt',payout_id:payoutId,kind:'receipt',amount_minor:payout*80,occurred_on:days.at(-1),reference:'DEMO-RECEIPT-'+a,notes:'Демонстрационное поступление',created_at:now});
  }
 }
 for(const [i,date] of days.entries()){
  const trades=rows.filter(r=>r.date===date),net=trades.reduce((s,r)=>s+r.pnl,0);
  const review={key:date,kind:'day',preNarrative:i%2?'Short':'Long',preAtr:420+i*17,preText:`План сессии: отметить границы Value Area и утренний диапазон. Рассматривать ${i%2?'короткие':'длинные'} позиции только после реакции от уровня.\n\nСценарий A: продолжение после ретеста. Сценарий B: возврат в диапазон при неудачном пробое. Все цифры — учебные.`,mindsetText:'Состояние спокойное. Цель — исполнить подготовленный сценарий и не увеличивать риск после убытка. До начала сессии проверены уровни и размер позиции.',sessionText:'Подробные наблюдения вынесены в карточки Live Session ниже.',nyNarrative:i%2?'Short':'Long',nyAtr:410+i*16,postText:`1) Что я сделал сегодня хорошо\nДождался подтверждения и записал основания решений.\n\n2) Что я сделал сегодня плохо\n${i%3===0?'В одном из входов вышел раньше структурной цели.':'Не все наблюдения записал сразу после сделки.'}\n\n3) Что мне нужно сделать, чтобы стать лучше\n${i%3===0?'До входа определить условия сопровождения и проверить их после закрытия.':'Оставлять короткую запись сразу после решения.'}\n\nИтоги дня\nРазобраны ${trades.length} сделки. Суммарный PNL: ${net.toFixed(2)} USD. См. связанные сделки ниже.\n/задача Проверить один пример ${setups[i%3].name} на истории.`,complete:true,dayStatus:net>0?'Win Day':net<0?'Loss Day':'BE',vpOpen:['Inside Value Area'],vwapOpen:['At VWAP (0σ)'],vpShape:[['D','P','b'][i%3]],preSessionVpOpen:['Near POC'],preSessionVpShape:['D']};
  insert('personal_trading_reviews',{key:date,kind:'day',content:JSON.stringify(review),updated_at:now});
  insert('journal_days',{date,note:review.postText,updated_at:now});
  for(let j=0;j<3;j++){
   const text=[`Подготовка завершена. ${review.preNarrative}: жду подтверждение у границы диапазона. Сценарий отменяется при принятии цены за противоположной границей.`,`Исполнение: ${trades.map(t=>'#'+t.no+' '+t.result+' '+t.rr+'R').join('; ')}. Риск по каждому аккаунту определён заранее.`,`Сессия завершена. Сверил действия с планом.\n/мысль ${i%2?'Пауза перед входом полезна, если у неё есть конкретное условие завершения.':'Перевод в БУ должен опираться на структуру, а не на желание защитить цифру.'}`][j];
   insert('personal_session_entries',{id:`portfolio-live-${i}-${j}`,day_key:date,created_at:`${date}T${[13,15,17][j]}:00:00Z`,blocks:JSON.stringify(textBlock(text,`portfolio-live-text-${i}-${j}`)),review_kind:'day'});
  }
  const criteria=[['preparation','Подготовка'],['risk','Риск и ограничения'],['execution','Вход и реализация возможностей'],['management','Сопровождение и выход']];
  const scores=[[1,1,1,0],[1,1,-1,0],[1,0,1,1],[0,1,-1,0],[1,1,1,1]][i%5];
  const report={criteriaVersion:2,date,items:criteria.map(([id,name],k)=>({id,name,text:['Разметил уровни и два сценария до открытия.','Размер позиции и лимит потерь зафиксированы заранее.','Сравнил фактический вход с условием подтверждения.','Проверил, было ли основание для изменения стопа и выхода.'][k],score:scores[k]})),weekly:{text:'',score:null},revision:0,updatedAt:null};
  insert('personal_process_reports',{date,content:JSON.stringify(report),revision:1,created_at:now,updated_at:now});
  insert('personal_process_report_history',{id:'portfolio-report-'+date,date,revision:1,content:JSON.stringify(report),changed_at:now});
 }
 for(const [w,date] of [...new Set(days.map(weekStart))].entries()){
  const weekRows=rows.filter(r=>weekStart(r.date)===date);
  const review={key:date,kind:'week',preNarrative:'Работа по плану',preAtr:null,preText:'Цель недели: разделять качество входа и качество сопровождения. Перед каждой сессией подготовить два сценария.',mindsetText:'Учебный недельный обзор: наблюдать повторяющиеся решения без оценки себя по одной сделке.',sessionText:'Проверить модели Opening Range Breakout, VWAP Pullback и Value Area Rejection. Собрать примеры ранних выходов.',nyNarrative:'',nyAtr:null,postText:`Неделя завершена: ${weekRows.length} сделок, ${weekRows.filter(r=>r.rr>0).length} прибыльных. Итог ${weekRows.reduce((s,r)=>s+r.pnl,0).toFixed(2)} USD.\n\nХорошо: риск остался в пределах плана.\nУлучшение: меньше вмешиваться в позицию без изменения сценария.\nСледующая цель: разобрать пять ранних выходов и сформулировать одно проверяемое правило.`,complete:true};
  insert('personal_trading_reviews',{key:date,kind:'week',content:JSON.stringify(review),updated_at:now});
  insert('personal_session_entries',{id:'portfolio-week-note-'+w,day_key:date,created_at:date+'T13:00:00Z',blocks:JSON.stringify(textBlock('Заметки недели\nСначала фиксирую наблюдение, затем проверяю его на серии примеров. '+(w?'Уже легче отличать запланированный выход от эмоционального.':'Первые примеры показали, что ранний БУ иногда мешает реализации цели.'))),review_kind:'week'});
 }
 const month={key:'2026-10-01',kind:'month',preNarrative:'Последовательное исполнение',preAtr:null,preText:'Демонстрационный месяц: четыре аккаунта и полный октябрь торговых сессий.',sessionText:'Собраны примеры входов, сопровождения и разбора результата.',nyNarrative:'',nyAtr:null,postText:'Главный вывод: оцениваю подготовку, риск, вход и выход отдельно. Для следующего месяца выбираю одну измеримую задачу — выполнять правила сопровождения.',complete:true};
 insert('personal_trading_reviews',{key:month.key,kind:'month',content:JSON.stringify(month),updated_at:now});
 const cards=[['задача','Проверить один пример Opening Range Breakout на истории.','doing'],['задача','Подготовить уровни до начала сессии','done'],['задача','Добавить в плейбук два примера ретеста VWAP','inbox'],['идея','Проверить отдельную модель выхода на следующей зоне объёма','inbox'],['мысль','Качество решения и результат отдельной сделки — разные вещи','done'],['вопрос','Когда перевод в БУ действительно отменяет риск идеи?','inbox'],['research','Сравнить вход по закрытию свечи и вход на ретесте','doing'],['playbook','Opening Range Breakout: пробой → ретест → продолжение','done'],['закон','Размер риска определяется до входа и не увеличивается после убытка','done'],['закон','Перенос стопа требует изменения рыночной структуры','doing'],['мысль','Короткая заметка после решения полезнее длинного спора во время входа','inbox']];
 for(const [i,[category,text,status]] of cards.entries()){
  const date=days[i%10],id='portfolio-workflow-'+i;
  insert('personal_workflow_cards',{id,source:i===0?'review:day:2026-10-01:postText':'manual:'+id,url:i===0?'/journal?review=day&date=2026-10-01':'/workflow',label:i===0?'Daily Review · 2026-10-01 · Итоги дня':'Демонстрационная запись',slot:0,category,text,status,detached:0,updated_at:now,created_at:date+'T17:00:00Z',status_changed_at:date+'T17:00:00Z',blocks:JSON.stringify(textBlock('Контекст: учебная запись для демонстрации Workflow.\n\nСледующий шаг: выбрать один пример, записать наблюдение и проверить результат на серии сделок.'))});
 }
 const notes=[['Начни здесь','Это вымышленные данные Golden Tablet.\n\n1. Открой Dashboard для общей статистики.\n2. В Journal выбери аккаунт и сделку.\n3. В Trading Review открой любой будний день октября или неделю.\n4. Посмотри связанные задачи в Workflow и оценки в Progress.'],['Как читать дневной разбор','Подготовка → Live Session → итоги → Daily Report Card.\n\nСделки связаны с днём по дате. Недельный обзор объединяет пять торговых дней.'],['Два условия хорошего входа','До входа есть контекст и триггер. После входа есть заранее выбранная точка отмены идеи.'],['Недельная исследовательская задача','Собрать пять примеров раннего выхода. Сравнить поведение после выхода и проверить, что было известно до решения.']];
 notes.forEach(([title,content],i)=>insert('notes',{id:'portfolio-note-'+i,folder_id:i===1?'daily-journal':'my-notes',title,content,tags_json:JSON.stringify(['Demo','Process']),created_at:now,updated_at:now}));
 insert('note_templates',{id:'portfolio-note-template',name:'Короткий разбор решения',content:'Что я увидел?\nКакое условие запустило действие?\nЧто отменяло идею?\nЧто проверю на следующем примере?'});
})();
const summaries=accounts.map(a=>({name:a.name,trades:rows.filter(r=>r.account===a.id).length,wins:rows.filter(r=>r.account===a.id&&r.rr>0).length,pnl:Number(rows.filter(r=>r.account===a.id).reduce((s,r)=>s+r.pnl,0).toFixed(2))}));
if(summaries.some(a=>a.trades!==10||a.wins!==6||a.pnl<=0))throw Error('Demo accounting assertion failed');
if(db.pragma('foreign_key_check').length)throw Error('Broken fixture relation');
console.log(JSON.stringify({demo:true,dates:[days[0],days.at(-1)],accounts:summaries,totals:{journal:db.prepare('SELECT count(*) n FROM personal_journal_entries').get().n,coreTrades:db.prepare('SELECT count(*) n FROM trades').get().n}},null,2));
db.close();
