const Database = require('better-sqlite3');
const { randomUUID } = require('node:crypto');
const { resolve } = require('node:path');
const db = new Database(resolve(__dirname, '../data/journal.db'));
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');
const batch = 'review-demo-2026-10-09';
const now = new Date().toISOString();
const manifest = { batch, month: '2026-10', entries: [], terms: [], reviews: [], preservedReviews: [] };
const mondayDates = ['2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26'];
const outcomes = [[2,-1,1.5,0,2,-0.5],[-1,2,0,-1,1,-0.5],[-1,-1.5,2,-1,-2,-0.5],[1.5,2,-1,0,3,-0.5],[-1,0,-2,1,-1.5,-0.5]];
const dayOffsets = [0,1,2,3,4,4];
const add = (key, offset) => { const d = new Date(key+'T12:00:00Z'); d.setUTCDate(d.getUTCDate()+offset); return d.toISOString().slice(0,10); };
try {
  db.transaction(() => {
    db.exec('CREATE TABLE IF NOT EXISTS personal_demo_batches (id TEXT PRIMARY KEY, manifest TEXT NOT NULL, created_at TEXT NOT NULL)');
    if (db.prepare('SELECT id FROM personal_demo_batches WHERE id=?').get(batch)) throw new Error('This demo batch already exists; refusing duplicate seed.');
    const term = (kind, name) => {
      const existing = db.prepare('SELECT id FROM personal_journal_terms WHERE kind=? AND name=?').get(kind,name);
      if (existing) return existing.id;
      const id = randomUUID();
      db.prepare('INSERT INTO personal_journal_terms(id,kind,name,description) VALUES (?,?,?,?)').run(id,kind,name,'Temporary Trading Review demo: '+batch);
      manifest.terms.push(id); return id;
    };
    const account = term('account','DEMO · Review preview USD');
    const instrument = term('instrument','XAUUSD');
    const results = Object.fromEntries(['Win','Loss','BE'].map(name => [name,term('result',name)]));
    let tradeNo = db.prepare('SELECT COALESCE(MAX(trade_no),0) AS n FROM personal_journal_entries').get().n;
    for (let w=0; w<5; w++) {
      const byDay = new Map();
      for (let i=0; i<6; i++) {
        const date=add(mondayDates[w],dayOffsets[i]); const rr=outcomes[w][i];
        const id=randomUUID(); const direction=i%2 ? 'Short':'Long';
        const label=rr>0?'Win':rr<0?'Loss':'BE';
        db.prepare(`INSERT INTO personal_journal_entries
          (id,trade_no,date,mode,direction,opened_at,closed_at,risk_ticks,realised_ticks,realised_r,mfe,mae,quick_note,body_title,body_text,created_at,updated_at)
          VALUES (?,?,?,'Forward',?,?,?,?,?,?,?,?,?,?,?, ?,?)`)
          .run(id,++tradeNo,date,direction,`${9+i}:15`.padStart(5,'0'),`${10+i}:05`.padStart(5,'0'),50,rr*50,rr,Math.max(0,rr*50)+20,rr<0?50:15,`DEMO · ${batch} · Week ${w+1}`,`DEMO ${w*6+i+1} · ${direction} XAUUSD`,'Тестовая сделка для проверки Trading Review. Удалить вместе с демо-пакетом.',now,now);
        for (const t of [results[label],instrument]) db.prepare('INSERT INTO personal_journal_entry_terms(entry_id,term_id) VALUES (?,?)').run(id,t);
        db.prepare('INSERT INTO personal_journal_account_results(entry_id,account_id,risk_pct,pnl_cash,pnl_pct) VALUES (?,?,1,?,?)').run(id,account,rr*100,rr);
        manifest.entries.push(id); byDay.set(date,(byDay.get(date)||0)+rr);
      }
      for (const [date, rr] of byDay) {
        if (db.prepare("SELECT key FROM personal_trading_reviews WHERE key=? AND kind='day'").get(date)) { manifest.preservedReviews.push(date); continue; }
        const record={key:date,kind:'day',preNarrative:w%2?'Short':'Long',preAtr:180+w*25,preText:'DEMO · Проверка отображения дневной карточки',mindsetText:'',sessionText:'',nyNarrative:rr>0?'Long':rr<0?'Short':'Neutral',nyAtr:200+w*30,postText:'DEMO · Временные тестовые данные',complete:false,dayStatus:rr>0?'Win Day':rr<0?'Loss Day':'BE',vpOpen:[w%2?'Outside Value Area':'Inside Value Area'],vwapOpen:[w%2?'0 to −1σ':'0 to +1σ'],vpShape:[['D','b','P','Thin','B (double distribution)'][w]]};
        db.prepare('INSERT INTO personal_trading_reviews(key,kind,content,updated_at) VALUES (?,?,?,?)').run(date,'day',JSON.stringify(record),now);
        manifest.reviews.push({key:date,kind:'day'});
      }
    }
    db.prepare('INSERT INTO personal_demo_batches(id,manifest,created_at) VALUES (?,?,?)').run(batch,JSON.stringify(manifest),now);
  }).immediate();
  console.log(JSON.stringify({batch, entries:manifest.entries.length, createdDailyCards:manifest.reviews.length, preservedDailyCards:manifest.preservedReviews, weeks:mondayDates}));
} finally { db.close(); }
