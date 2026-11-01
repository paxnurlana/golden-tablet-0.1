-- Schema only; contains no personal records or credentials.
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  broker TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  initial_balance REAL NOT NULL DEFAULT 0,
  profit_calc_method TEXT NOT NULL DEFAULT 'fifo',
  credentials_enc TEXT,
  auto_sync INTEGER NOT NULL DEFAULT 0,
  last_sync_at TEXT,
  ibkr_sync_time_zone TEXT,
  snapshot_json TEXT,
  archived_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS attachments (id TEXT PRIMARY KEY, owner_type TEXT NOT NULL, owner_id TEXT NOT NULL, name TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL, data BLOB NOT NULL, created_at TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS executions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  quantity REAL NOT NULL,
  price REAL NOT NULL,
  fee REAL NOT NULL DEFAULT 0,
  executed_at TEXT NOT NULL,
  asset_class TEXT,
  source TEXT NOT NULL,
  import_metadata_json TEXT,
  content_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'user',
  created_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS import_batches (
 id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 format TEXT NOT NULL, fingerprint TEXT NOT NULL, raw_hash TEXT NOT NULL, time_zone TEXT NOT NULL,
 source_ids_json TEXT NOT NULL, from_time TEXT NOT NULL, to_time TEXT NOT NULL,
 snapshot_json TEXT NOT NULL, created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS import_source_aliases (
 id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 format TEXT NOT NULL, alias_key TEXT NOT NULL,
 source_id TEXT NOT NULL REFERENCES import_sources(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS import_sources (
 id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 format TEXT NOT NULL, name TEXT NOT NULL, created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS journal_days (
  date TEXT PRIMARY KEY,
  note TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS market_csv_datasets (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, symbol TEXT NOT NULL,
 resolution TEXT NOT NULL, currency TEXT NOT NULL, price_basis TEXT NOT NULL,
 bars_json TEXT NOT NULL, imported_at TEXT NOT NULL,
 bar_count INTEGER NOT NULL, first_time INTEGER NOT NULL, last_time INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS missed_trades (id TEXT PRIMARY KEY, symbol TEXT NOT NULL, direction TEXT NOT NULL, observed_at TEXT NOT NULL, playbook_id TEXT, entry REAL, stop REAL, target REAL, notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, archived_at TEXT);

CREATE TABLE IF NOT EXISTS note_templates (id TEXT PRIMARY KEY, name TEXT NOT NULL, content TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  folder_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  tags_json TEXT,
  trade_key TEXT,
  day_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS personal_account_firms (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE COLLATE NOCASE, logo TEXT NOT NULL DEFAULT '', deleted_at TEXT);

CREATE TABLE IF NOT EXISTS personal_account_movements (id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES personal_journal_terms(id), kind TEXT NOT NULL, date TEXT NOT NULL, amount REAL NOT NULL, received REAL NOT NULL, note TEXT NOT NULL, deleted_at TEXT);

CREATE TABLE IF NOT EXISTS personal_account_phases (id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES personal_journal_terms(id), stage TEXT NOT NULL, date TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS personal_account_profiles (account_id TEXT PRIMARY KEY REFERENCES personal_journal_terms(id), profile_json TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS personal_journal_account_results (
      entry_id TEXT NOT NULL REFERENCES personal_journal_entries(id) ON DELETE CASCADE,
      account_id TEXT NOT NULL REFERENCES personal_journal_terms(id) ON DELETE CASCADE,
      risk_pct REAL,
      pnl_cash REAL,
      pnl_pct REAL, risk_cash REAL, base_balance REAL, quantity REAL, quantity_unit TEXT,
      PRIMARY KEY (entry_id,account_id)
    );

CREATE TABLE IF NOT EXISTS personal_journal_entries (
      id TEXT PRIMARY KEY,
      trade_no INTEGER NOT NULL UNIQUE,
      date TEXT NOT NULL,
      mode TEXT NOT NULL CHECK (mode IN ('Forward','Back')),
      direction TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL DEFAULT '',
      opened_at TEXT NOT NULL DEFAULT '',
      closed_at TEXT NOT NULL DEFAULT '',
      risk_ticks REAL,
      realised_ticks REAL,
      realised_r REAL,
      mfe REAL,
      mae REAL,
      quick_note TEXT NOT NULL DEFAULT '',
      body_title TEXT NOT NULL DEFAULT '',
      body_text TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    , rr_basis_json TEXT, potential_json TEXT NOT NULL DEFAULT '{}', custom_trade_no INTEGER, classification_json TEXT NOT NULL DEFAULT '{}', deleted_at TEXT, body_blocks_json TEXT NOT NULL DEFAULT '');

CREATE TABLE IF NOT EXISTS personal_journal_entry_terms (
      entry_id TEXT NOT NULL REFERENCES personal_journal_entries(id) ON DELETE CASCADE,
      term_id TEXT NOT NULL REFERENCES personal_journal_terms(id) ON DELETE CASCADE,
      PRIMARY KEY (entry_id,term_id)
    );

CREATE TABLE IF NOT EXISTS personal_journal_migrations (name TEXT PRIMARY KEY);

CREATE TABLE IF NOT EXISTS personal_journal_terms (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      name TEXT NOT NULL, logo TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '', deleted_at TEXT,
      UNIQUE(kind,name)
    );

CREATE TABLE IF NOT EXISTS personal_process_report_history(id TEXT PRIMARY KEY,date TEXT NOT NULL,revision INTEGER NOT NULL,content TEXT NOT NULL,changed_at TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS personal_process_reports(date TEXT PRIMARY KEY,content TEXT NOT NULL,revision INTEGER NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS personal_session_entries (
    id TEXT PRIMARY KEY, day_key TEXT NOT NULL, created_at TEXT NOT NULL, blocks TEXT NOT NULL DEFAULT '[]'
  , deleted_at TEXT, review_kind TEXT NOT NULL DEFAULT 'day');

CREATE TABLE IF NOT EXISTS personal_trading_reviews (
    key TEXT NOT NULL, kind TEXT NOT NULL, content TEXT NOT NULL, updated_at TEXT NOT NULL,
    PRIMARY KEY(key,kind)
  );

CREATE TABLE IF NOT EXISTS personal_workflow_cards (
    id TEXT PRIMARY KEY, source TEXT NOT NULL, url TEXT NOT NULL, label TEXT NOT NULL,
    slot INTEGER NOT NULL, category TEXT NOT NULL, text TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'inbox',
    detached INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL, blocks TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL DEFAULT '', deleted_at TEXT, category_override TEXT, status_changed_at TEXT, text_override TEXT, UNIQUE(source,slot)
  );

CREATE TABLE IF NOT EXISTS playbooks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  rules_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS progress_checks (id TEXT PRIMARY KEY, rule_id TEXT NOT NULL, date TEXT NOT NULL, done INTEGER NOT NULL);

CREATE TABLE IF NOT EXISTS progress_rules (id TEXT PRIMARY KEY, title TEXT NOT NULL, stage TEXT NOT NULL, weekdays_json TEXT NOT NULL, created_at TEXT NOT NULL, archived_at TEXT);

CREATE TABLE IF NOT EXISTS prop_accounts (
 id TEXT PRIMARY KEY, firm TEXT NOT NULL, name TEXT NOT NULL, program TEXT NOT NULL,
 status TEXT NOT NULL, currency TEXT NOT NULL, size_minor INTEGER, parent_id TEXT REFERENCES prop_accounts(id),
 journal_account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
 opened_on TEXT NOT NULL, closed_on TEXT, renewal_on TEXT, renewal_minor INTEGER, notes TEXT NOT NULL DEFAULT '',
 archived INTEGER NOT NULL DEFAULT 0, revision INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS prop_audit (
 id TEXT PRIMARY KEY, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, before_json TEXT,
 after_json TEXT NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS prop_entries (
 id TEXT PRIMARY KEY, account_id TEXT REFERENCES prop_accounts(id), firm TEXT NOT NULL, kind TEXT NOT NULL,
 category TEXT NOT NULL, currency TEXT NOT NULL, amount_minor INTEGER NOT NULL, split_bps INTEGER NOT NULL,
 fee_minor INTEGER NOT NULL, occurred_on TEXT NOT NULL, due_on TEXT, status TEXT NOT NULL,
 parent_id TEXT REFERENCES prop_entries(id), reference TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '',
 voided INTEGER NOT NULL DEFAULT 0, revision INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS prop_receipts (
 id TEXT PRIMARY KEY, payout_id TEXT NOT NULL REFERENCES prop_entries(id), kind TEXT NOT NULL, amount_minor INTEGER NOT NULL,
 occurred_on TEXT NOT NULL, reference TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '',
 voided INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS trade_excursions (
  trade_key TEXT PRIMARY KEY REFERENCES trades(key) ON DELETE CASCADE,
  fingerprint TEXT NOT NULL,
  provider TEXT NOT NULL,
  symbol TEXT NOT NULL,
  resolution TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  estimate_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS trade_rule_checks (id TEXT PRIMARY KEY, trade_key TEXT NOT NULL, playbook_id TEXT NOT NULL, rule TEXT NOT NULL, followed INTEGER NOT NULL);

CREATE TABLE IF NOT EXISTS trades (
  key TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  asset_class TEXT,
  direction TEXT NOT NULL,
  status TEXT NOT NULL,
  opened_at TEXT NOT NULL,
  closed_at TEXT,
  quantity REAL NOT NULL,
  open_quantity REAL NOT NULL,
  avg_entry REAL NOT NULL,
  avg_exit REAL,
  gross_pnl REAL NOT NULL,
  fees REAL NOT NULL,
  net_pnl REAL NOT NULL,
  execution_count INTEGER NOT NULL,
  execution_ids_json TEXT NOT NULL,
  exits_json TEXT NOT NULL,
  duration_ms INTEGER,
  notes TEXT,
  tags_json TEXT,
  mistakes_json TEXT,
  playbook_id TEXT,
  rating INTEGER,
  stop_loss REAL,
  profit_target REAL,
  reviewed_at TEXT
);

CREATE INDEX IF NOT EXISTS attachments_owner ON attachments(owner_type, owner_id);

CREATE UNIQUE INDEX IF NOT EXISTS executions_account_hash ON executions (account_id, content_hash);

CREATE INDEX IF NOT EXISTS executions_account_symbol ON executions (account_id, symbol);

CREATE UNIQUE INDEX IF NOT EXISTS import_batch_unique ON import_batches(account_id, format, fingerprint);

CREATE UNIQUE INDEX IF NOT EXISTS import_source_alias_unique ON import_source_aliases(account_id, format, alias_key);

CREATE INDEX IF NOT EXISTS market_csv_symbol_resolution ON market_csv_datasets(symbol, resolution);

CREATE INDEX IF NOT EXISTS notes_folder ON notes (folder_id);

CREATE INDEX IF NOT EXISTS personal_journal_entries_date ON personal_journal_entries(date);

CREATE INDEX IF NOT EXISTS personal_journal_entry_terms_term ON personal_journal_entry_terms(term_id);

CREATE INDEX IF NOT EXISTS progress_checks_date ON progress_checks(date);

CREATE INDEX IF NOT EXISTS prop_audit_entity ON prop_audit(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS prop_entries_account_date ON prop_entries(account_id, occurred_on);

CREATE INDEX IF NOT EXISTS prop_entries_date ON prop_entries(occurred_on);

CREATE INDEX IF NOT EXISTS prop_receipts_payout ON prop_receipts(payout_id);

CREATE INDEX IF NOT EXISTS trade_rule_checks_trade ON trade_rule_checks(trade_key);

CREATE INDEX IF NOT EXISTS trades_account_closed ON trades (account_id, closed_at);

CREATE INDEX IF NOT EXISTS trades_account_opened ON trades (account_id, opened_at);

CREATE INDEX IF NOT EXISTS trades_opened ON trades (opened_at);

CREATE INDEX IF NOT EXISTS trades_symbol ON trades (symbol);
