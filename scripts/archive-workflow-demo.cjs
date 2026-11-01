const path = require("node:path");
const Database = require("../apps/web/node_modules/better-sqlite3");
const file = path.resolve(__dirname, "../apps/web/data/journal.db");
async function main() {
  const db = new Database(file);
  try {
    const ids = new Set(db.prepare("SELECT manifest FROM personal_demo_batches WHERE id IN (?,?)").all("workflow-demo-2026-10-09", "workflow-sources-demo-2026-10-09").flatMap(row => JSON.parse(row.manifest).workflowCards || []));
    const cards = db.prepare("SELECT * FROM personal_workflow_cards").all();
    const targets = cards.filter(card => ids.has(card.id) && /^DEMO · workflow-(sources-)?demo-2026-10-09 ·/.test(card.text) && JSON.parse(card.blocks).every(block => block.kind === "text" && !block.text.trim()) && !card.deleted_at);
    if (!process.argv.includes("--apply")) { console.log(JSON.stringify({ candidates: targets.length, preserved: cards.length - targets.length })); return; }
    const backup = file.replace(/\.db$/, `.before-workflow-demo-${Date.now()}.db`);
    await db.backup(backup);
    db.transaction(() => {
      const columns = db.pragma("table_info(personal_workflow_cards)");
      if (!columns.some(c => c.name === "deleted_at")) db.exec("ALTER TABLE personal_workflow_cards ADD COLUMN deleted_at TEXT");
      const update = db.prepare("UPDATE personal_workflow_cards SET deleted_at=? WHERE id=? AND text=? AND blocks=? AND deleted_at IS NULL");
      let archived = 0;
      for (const card of targets) archived += update.run(new Date().toISOString(), card.id, card.text, card.blocks).changes;
      console.log(JSON.stringify({ archived, preserved: cards.length - archived, backup }));
    }).immediate();
  } finally { db.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
