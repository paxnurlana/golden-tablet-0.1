import type Database from 'better-sqlite3';
import { createHash } from 'node:crypto';

/** Journal is authoritative; the analytics tables are a disposable read model.
 * Only rows registered in our ownership table can be removed by this projection.
 */
export function projectJournalAnalytics(sql: Database.Database) {
  sql.exec(`CREATE TABLE IF NOT EXISTS journal_analytics_projection (
    trade_key TEXT PRIMARY KEY, entry_id TEXT NOT NULL, account_id TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS journal_analytics_state (id INTEGER PRIMARY KEY, fingerprint TEXT NOT NULL);`);
  if (!sql.prepare("SELECT 1 FROM sqlite_master WHERE name='personal_journal_entries'").get()) return;
  const entries = sql.prepare('SELECT * FROM personal_journal_entries ORDER BY id').all() as Record<string, any>[];
  const terms = sql.prepare('SELECT * FROM personal_journal_terms ORDER BY id').all() as Record<string, any>[];
  const relations = sql.prepare('SELECT * FROM personal_journal_entry_terms ORDER BY entry_id,term_id').all() as {entry_id:string;term_id:string}[];
  const results = sql.prepare('SELECT * FROM personal_journal_account_results ORDER BY entry_id,account_id').all() as Record<string, any>[];
  const profiles = (sql.prepare("SELECT 1 FROM sqlite_master WHERE name='personal_account_profiles'").get() ? sql.prepare('SELECT * FROM personal_account_profiles ORDER BY account_id').all() : []) as {account_id:string;profile_json:string}[];
  const fingerprint = createHash('sha256').update(JSON.stringify([entries,terms,relations,results,profiles])).digest('hex');
  if ((sql.prepare('SELECT fingerprint FROM journal_analytics_state WHERE id=1').get() as {fingerprint:string}|undefined)?.fingerprint === fingerprint) return;
  const json = (value:string) => {try {return JSON.parse(value || '{}');} catch {return {};}};
  const termMap = new Map(terms.map(t=>[t.id,t]));
  const profileMap = new Map(profiles.map(p=>[p.account_id,json(p.profile_json)]));
  sql.transaction(()=>{
    for (const term of terms.filter(t=>t.kind==='account')) {
      const profile = profileMap.get(term.id) ?? {};
      sql.prepare(`INSERT INTO accounts(id,name,broker,kind,currency,initial_balance,created_at,archived_at)
        VALUES(?,?,?,'manual','USD',?,?,?) ON CONFLICT(id) DO UPDATE SET
        name=excluded.name,initial_balance=excluded.initial_balance,archived_at=excluded.archived_at`)
        .run(term.id,term.name,'Journal',profile.openingBalance??profile.accountSize??0,new Date().toISOString(),term.deleted_at??null);
    }
    const active = new Set<string>();
    for (const entry of entries) {
      const linked = relations.filter(r=>r.entry_id===entry.id).map(r=>termMap.get(r.term_id)).filter(Boolean);
      const result = linked.find(t=>t!.kind==='result')?.name?.toLowerCase();
      const knownExecuted = ['win','loss','be','breakeven'].includes(result);
      for (const [index,account] of results.filter(r=>r.entry_id===entry.id).entries()) {
        // Seeded rows already use entry IDs. Adopt them so no duplicate totals exist.
        const key = index===0 ? entry.id : `${entry.id}@${account.account_id}`;
        const existing = sql.prepare('SELECT * FROM trades WHERE key=?').get(key) as Record<string,any>|undefined;
        if (existing?.account_id===account.account_id && entry.id.startsWith('portfolio-'))
          sql.prepare('INSERT OR IGNORE INTO journal_analytics_projection VALUES(?,?,?)').run(key,entry.id,account.account_id);
        if (entry.deleted_at || entry.mode!=='Forward' || !knownExecuted || account.pnl_cash===null || termMap.get(account.account_id)?.deleted_at) continue;
        const opened = `${entry.date}T${entry.opened_at||'12:00'}:00+05:00`;
        let closed = `${entry.date}T${entry.closed_at||entry.opened_at||'12:00'}:00+05:00`;
        if (Date.parse(closed)<Date.parse(opened)) closed = new Date(Date.parse(closed)+86400000).toISOString();
        const status = result==='win'?'win':result==='loss'?'loss':'breakeven';
        const setup = linked.find(t=>t!.kind==='setup');
        const fees = existing?.fees??0;
        const priorExits = json(existing?.exits_json ?? '[]');
        const projectedExits = Array.isArray(priorExits) && priorExits.length===1
          ? JSON.stringify([{...priorExits[0],quantity:account.quantity??1,grossPnl:account.pnl_cash+fees}]) : '[]';
        sql.prepare(`INSERT INTO trades(key,account_id,symbol,asset_class,direction,status,opened_at,closed_at,
          quantity,open_quantity,avg_entry,avg_exit,gross_pnl,fees,net_pnl,execution_count,execution_ids_json,exits_json,duration_ms,notes,tags_json,playbook_id)
          VALUES(?,?,?,?,?,?,?,?,?,0,?,?,?,?,?,?,?, ?,?,?,?,?) ON CONFLICT(key) DO UPDATE SET
          account_id=excluded.account_id,symbol=excluded.symbol,asset_class=excluded.asset_class,direction=excluded.direction,
          status=excluded.status,opened_at=excluded.opened_at,closed_at=excluded.closed_at,quantity=excluded.quantity,
          gross_pnl=excluded.gross_pnl,net_pnl=excluded.net_pnl,exits_json=excluded.exits_json,duration_ms=excluded.duration_ms,notes=excluded.notes,
          tags_json=excluded.tags_json,playbook_id=excluded.playbook_id`)
          .run(key,account.account_id,linked.find(t=>t!.kind==='instrument')?.name??'—',account.quantity_unit==='contracts'?'futures':'cfd',
            entry.direction==='Short'?'short':'long',status,opened,closed,account.quantity??1,existing?.avg_entry??0,existing?.avg_exit??null,
            account.pnl_cash+fees,fees,account.pnl_cash,existing?.execution_count??0,existing?.execution_ids_json??'[]',projectedExits,
            Date.parse(closed)-Date.parse(opened),entry.quick_note,JSON.stringify(linked.filter(t=>t!.kind==='setup').map(t=>t!.name)),setup?.id??null);
        sql.prepare('INSERT OR REPLACE INTO journal_analytics_projection VALUES(?,?,?)').run(key,entry.id,account.account_id);
        active.add(key);
      }
    }
    for (const row of sql.prepare('SELECT trade_key FROM journal_analytics_projection').all() as {trade_key:string}[]) {
      if (active.has(row.trade_key)) continue;
      sql.prepare('DELETE FROM trade_rule_checks WHERE trade_key=?').run(row.trade_key);
      sql.prepare('DELETE FROM trade_excursions WHERE trade_key=?').run(row.trade_key);
      sql.prepare('DELETE FROM trades WHERE key=?').run(row.trade_key);
      sql.prepare('DELETE FROM journal_analytics_projection WHERE trade_key=?').run(row.trade_key);
    }
    sql.prepare('INSERT OR REPLACE INTO journal_analytics_state VALUES(1,?)').run(fingerprint);
  })();
}
