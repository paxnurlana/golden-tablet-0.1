const Database = require('better-sqlite3');
const { randomUUID } = require('node:crypto');
const { resolve } = require('node:path');
const batch = 'workflow-sources-demo-2026-10-09';
const db = new Database(resolve(__dirname, '../data/journal.db'));
db.pragma('busy_timeout = 5000');
const categories = ['задача', 'идея', 'мысль', 'вопрос', 'research', 'playbook'];
const messages = ['Пересмотреть входы от VAH', 'Проверить acceptance перед пробоем', 'Повторный тест уровня выглядит надёжнее', 'Как влияет ATR на стоп?', 'Собрать выборку ORB Long и Short', 'Ждать закрепления над VAH перед входом', 'Сравнить стопы 30 и 50 тиков', 'Проверить возврат к VWAP', 'Не торопиться после импульса', 'Как меняется результат после открытия NY?'];
const manifest = { batch, entryBackups: [], sessions: [], reviewBackups: [], workflowCards: [] };
const payloads = [];
const now = new Date().toISOString();
function commands(index, count) {
  return Array.from({length: count}, (_, j) => `/${categories[(index+j)%6]} DEMO · ${batch} · ${index+1}.${j+1} · ${messages[j%10]}`).join('\n');
}
(async () => {
  if (db.prepare('SELECT id FROM personal_demo_batches WHERE id=?').get(batch)) throw new Error('Demo batch already exists; no duplicate seed.');
  const old = JSON.parse(db.prepare('SELECT manifest FROM personal_demo_batches WHERE id=?').get('review-demo-2026-10-09').manifest);
  const entries = old.entries.map(id => db.prepare('SELECT * FROM personal_journal_entries WHERE id=?').get(id));
  const selected = [...new Map(entries.map(row => [row.date, row])).values()].slice(0,10);
  if (selected.length !== 10) throw new Error('Expected 10 existing DEMO trades on distinct dates');
  await fetch('http://127.0.0.1:3001/api/workflow').then(r => { if(!r.ok) throw new Error('Workflow unavailable'); });
  db.transaction(() => {
    selected.forEach((row, i) => {
      const text = commands(i,10), blockId = randomUUID();
      manifest.entryBackups.push({id:row.id, body_text:row.body_text, body_blocks_json:row.body_blocks_json});
      const blocks = [...(row.body_blocks_json ? JSON.parse(row.body_blocks_json) : [{id:randomUUID(),kind:'text',text:row.body_text}]), {id:blockId,kind:'text',text}];
      db.prepare('UPDATE personal_journal_entries SET body_blocks_json=?,body_text=?,updated_at=? WHERE id=?').run(JSON.stringify(blocks),blocks.filter(b=>b.kind==='text').map(b=>b.text).join('\n'),now,row.id);
      payloads.push({source:`journal-body:${row.id}:${blockId}`,url:`/trades?entry=${row.id}`,label:`Journal · Trade #${row.trade_no} · ${row.date} · ${row.opened_at}`,text});
      const sessionId=randomUUID(), sessionBlock=randomUUID(), hour=9+i, minute=(7+i*4)%60;
      const time=`${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
      const sessionText=commands(i,1);
      db.prepare('INSERT INTO personal_session_entries(id,day_key,created_at,blocks) VALUES (?,?,?,?)').run(sessionId,row.date,`${row.date}T${time}:00+05:00`,JSON.stringify([{id:sessionBlock,kind:'text',text:sessionText}]));
      manifest.sessions.push(sessionId);
      payloads.push({source:`journal-body:${sessionId}:${sessionBlock}`,url:`/journal?review=day&date=${row.date}`,label:`Daily Review · ${row.date} · Live Session · ${time}`,text:sessionText});
    });
    for (const [kind,key,label,i] of [['week','2026-10-12','Weekly Review',10],['month','2026-10-01','Month Review',11]]) {
      const previous=db.prepare('SELECT content FROM personal_trading_reviews WHERE key=? AND kind=?').get(key,kind);
      manifest.reviewBackups.push({key,kind,content:previous?.content??null});
      const record=previous?JSON.parse(previous.content):{key,kind,preNarrative:'',preAtr:null,preText:'',sessionText:'',nyNarrative:'',nyAtr:null,postText:'',complete:false};
      const text=commands(i,6); record.postText=[record.postText,text].filter(Boolean).join('\n');
      db.prepare('INSERT INTO personal_trading_reviews(key,kind,content,updated_at) VALUES (?,?,?,?) ON CONFLICT(key,kind) DO UPDATE SET content=excluded.content,updated_at=excluded.updated_at').run(key,kind,JSON.stringify(record),now);
      // The source key matches the label-based field identity used by GlobalSlash.
      const fieldLabel=kind==='month'?'Итоги месяца':'Итоги недели';
      payloads.push({source:`review:${kind}:${key}:postText:${fieldLabel}`,url:`/journal?review=${kind}&date=${key}`,label:`${label} · ${key} · ${fieldLabel}`,text:record.postText});
    }
    db.prepare('INSERT INTO personal_demo_batches(id,manifest,created_at) VALUES (?,?,?)').run(batch,JSON.stringify({...manifest,payloads}),now);
  }).immediate();
  for(const payload of payloads) {
    const response=await fetch('http://127.0.0.1:3001/api/workflow',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    if(!response.ok) throw new Error(await response.text());
  }
  const sources=new Set(payloads.map(p=>p.source));
  const cards=db.prepare('SELECT id,source,slot FROM personal_workflow_cards').all().filter(c=>sources.has(c.source));
  db.transaction(()=>{
    cards.forEach((card,i)=>db.prepare('UPDATE personal_workflow_cards SET status=? WHERE id=?').run(['inbox','doing','done'][i%3],card.id));
    manifest.workflowCards=cards.map(c=>c.id);
    db.prepare('UPDATE personal_demo_batches SET manifest=? WHERE id=?').run(JSON.stringify({...manifest,payloads}),batch);
  }).immediate();
  console.log(JSON.stringify({batch,trades:10,tradeMarks:100,dailySessions:10,weeklyMarks:6,monthlyMarks:6,cards:cards.length}));
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>db.close());
