const path = require('node:path');
const Database = require('../apps/web/node_modules/better-sqlite3');
const file = path.resolve(__dirname, '../apps/web/data/journal.db');
async function main() {
  const db = new Database(file);
  db.pragma('busy_timeout = 5000');
  try {
    const batch = db.prepare('SELECT * FROM personal_demo_batches WHERE id=?').get('review-demo-2026-10-09');
    const source = JSON.parse(db.prepare('SELECT manifest FROM personal_demo_batches WHERE id=?').get('workflow-sources-demo-2026-10-09').manifest);
    const manifest = JSON.parse(batch.manifest);
    const reviews = db.prepare('SELECT * FROM personal_trading_reviews').all();
    const removeReviews = reviews.filter(r => manifest.reviews.some(x => x.key === r.key && x.kind === r.kind) && r.updated_at === batch.created_at && JSON.parse(r.content).preText === 'DEMO · Проверка отображения дневной карточки');
    const edits = [];
    for (const r of reviews.filter(r => !removeReviews.includes(r))) {
      const record = JSON.parse(r.content);
      let changed = false;
      for (const field of ['preText','mindsetText','sessionText','postText']) {
        const payload = source.payloads.find(p => p.source.startsWith(`review:${r.kind}:${r.key}:${field}:`));
        if (payload && record[field] === payload.text) { record[field] = ''; changed = true; }
      }
      if (manifest.reviews.some(x => x.key === r.key && x.kind === r.kind)) {
        const mondays=['2026-09-28','2026-10-05','2026-10-12','2026-10-19','2026-10-26'];
        const w=mondays.findLastIndex(k => k <= r.key);
        const offset=Math.round((Date.parse(r.key)-Date.parse(mondays[w]))/86400000);
        const sums=[[2,-1,1.5,0,1.5],[-1,2,0,-1,0.5],[-1,-1.5,2,-1,-2.5],[1.5,2,-1,0,2.5],[-1,0,-2,1,-2]];
        const rr=sums[w][offset];
        const defaults={preNarrative:'',preAtr:null,preText:'',nyNarrative:'',nyAtr:null,postText:'',dayStatus:'',vpOpen:[],vwapOpen:[],vpShape:[]};
        const original={preNarrative:w%2?'Short':'Long',preAtr:180+w*25,preText:'DEMO · Проверка отображения дневной карточки',nyNarrative:rr>0?'Long':rr<0?'Short':'Neutral',nyAtr:200+w*30,postText:'DEMO · Временные тестовые данные',dayStatus:rr>0?'Win Day':rr<0?'Loss Day':'BE',vpOpen:[w%2?'Outside Value Area':'Inside Value Area'],vwapOpen:[w%2?'0 to −1σ':'0 to +1σ'],vpShape:[['D','b','P','Thin','B (double distribution)'][w]]};
        for (const key of Object.keys(original)) if (JSON.stringify(record[key])===JSON.stringify(original[key])) { record[key]=defaults[key]; changed=true; }
      }
      if (changed) edits.push({r, content:JSON.stringify(record)});
    }
    const sessions = db.prepare('SELECT * FROM personal_session_entries').all().filter(s => source.sessions.includes(s.id) && JSON.parse(s.blocks).every(b => b.kind === 'text' && (!b.text.trim() || source.payloads.some(p => p.source.startsWith(`journal-body:${s.id}:`) && p.text === b.text))));
    const cards = db.prepare('SELECT * FROM personal_workflow_cards WHERE deleted_at IS NULL').all().filter(c => /^DEMO · workflow-(sources-)?demo-2026-10-09 ·/.test(c.text) && JSON.parse(c.blocks).every(b => b.kind === 'text' && !b.text.trim()) && (source.workflowCards.includes(c.id) || source.payloads.some(p => p.text.split('\n').some(line => line.replace(/^\/\S+\s+/, '') === c.text))));
    const summary = {dailyCards:removeReviews.length,reviewFields:edits.length,demoSessions:sessions.length,workflowCards:cards.length};
    if (!process.argv.includes('--apply')) { console.log(JSON.stringify(summary)); return; }
    const backup = file.replace(/\.db$/, `.before-review-cleanup-${Date.now()}.db`);
    await db.backup(backup);
    const protectedBefore = db.prepare('SELECT * FROM personal_journal_entries').all();
    db.transaction(() => {
      for (const r of removeReviews) if (db.prepare('DELETE FROM personal_trading_reviews WHERE key=? AND kind=? AND content=? AND updated_at=?').run(r.key,r.kind,r.content,r.updated_at).changes !== 1) throw Error('Review changed during cleanup');
      for (const e of edits) if (db.prepare('UPDATE personal_trading_reviews SET content=?,updated_at=? WHERE key=? AND kind=? AND content=?').run(e.content,new Date().toISOString(),e.r.key,e.r.kind,e.r.content).changes !== 1) throw Error('Review changed during cleanup');
      for (const s of sessions) if (db.prepare('DELETE FROM personal_session_entries WHERE id=? AND blocks=?').run(s.id,s.blocks).changes !== 1) throw Error('Session changed during cleanup');
      for (const c of cards) db.prepare('UPDATE personal_workflow_cards SET deleted_at=? WHERE id=? AND text=? AND blocks=? AND deleted_at IS NULL').run(new Date().toISOString(),c.id,c.text,c.blocks);
      if (JSON.stringify(protectedBefore) !== JSON.stringify(db.prepare('SELECT * FROM personal_journal_entries').all())) throw Error('Unexpected trade mutation');
    }).immediate();
    console.log(JSON.stringify({...summary,backup,remainingActiveDemo:db.prepare("SELECT COUNT(*) n FROM personal_workflow_cards WHERE deleted_at IS NULL AND text LIKE 'DEMO%'").get().n}));
  } finally { db.close(); }
}
main().catch(e => { console.error(e); process.exitCode=1; });
