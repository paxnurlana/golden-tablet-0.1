import { expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { projectJournalAnalytics } from '../src/server/journal-analytics';

it('projects current journal cash, dates and account changes without duplicating or retaining deleted trades',()=>{
 const sql=new Database(':memory:');
 sql.exec(readFileSync('scripts/portfolio-schema.sql','utf8'));
 sql.exec(`INSERT INTO personal_journal_terms(id,kind,name) VALUES ('a','account','Demo'),('win','result','Win'),('miss','result','Missed');
 INSERT INTO personal_account_profiles VALUES('a','{"openingBalance":10000}');
 INSERT INTO personal_journal_entries(id,trade_no,date,mode,created_at,updated_at) VALUES('e',1,'2026-10-01','Forward','now','now');
 INSERT INTO personal_journal_entry_terms VALUES('e','win');
 INSERT INTO personal_journal_account_results(entry_id,account_id,pnl_cash,quantity) VALUES('e','a',500,1);`);
 const rows=()=>sql.prepare('SELECT * FROM trades').all() as Record<string,any>[];
 projectJournalAnalytics(sql); expect(rows()).toHaveLength(1); expect(rows()[0].net_pnl).toBe(500);
 projectJournalAnalytics(sql); expect(rows()).toHaveLength(1);
 sql.exec("UPDATE personal_journal_account_results SET pnl_cash=-200; UPDATE personal_journal_entries SET date='2026-10-08'; UPDATE personal_journal_terms SET name='Renamed' WHERE id='a'");
 projectJournalAnalytics(sql); expect(rows()[0].net_pnl).toBe(-200); expect(rows()[0].opened_at).toContain('2026-10-08');
 expect(sql.prepare("SELECT name FROM accounts WHERE id='a'").get()).toEqual({name:'Renamed'});
 sql.exec("UPDATE personal_journal_entry_terms SET term_id='miss'"); projectJournalAnalytics(sql); expect(rows()).toHaveLength(0);
 sql.exec("UPDATE personal_journal_entry_terms SET term_id='win'"); projectJournalAnalytics(sql); expect(rows()).toHaveLength(1);
 sql.exec("UPDATE personal_journal_entries SET deleted_at='now'"); projectJournalAnalytics(sql); expect(rows()).toHaveLength(0);
 sql.exec("UPDATE personal_journal_entries SET deleted_at=NULL, mode='Back'"); projectJournalAnalytics(sql); expect(rows()).toHaveLength(0);
 sql.exec("UPDATE personal_journal_entries SET mode='Forward'; UPDATE personal_journal_account_results SET pnl_cash=NULL");
 projectJournalAnalytics(sql); expect(rows()).toHaveLength(0);
 expect(sql.prepare('SELECT count(*) n FROM personal_journal_entries').get()).toEqual({n:1});
 sql.close();
});
