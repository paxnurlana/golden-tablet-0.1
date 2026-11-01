// Explicit allowlist: export fictional portfolio records, never the private app.
const { writeFileSync, mkdirSync } = require("node:fs");
const { resolve } = require("node:path");
const root = resolve(__dirname, "..");
async function main() {
  const get = async (path) => {
    const response = await fetch("http://127.0.0.1:3002/api/" + path);
    if (!response.ok) throw Error("Cannot export " + path);
    return response.json();
  };
  const paths = [
    "personal-journal",
    "personal-accounts",
    "trading-review",
    "workflow",
    "notes",
    "playbooks",
    "process-progress",
    "prop-firms",
    "stats",
    "trades",
    "accounts",
    "settings",
    "adherence",
    "analysis",
    "performance-trends",
    "trade-explorer",
    "workspace/defaults",
    "workspace/templates",
  ];
  const data = {};
  for (const path of paths) data["/api/" + path] = await get(path);
  const entries = data["/api/personal-journal"].entries;
  if (entries.length !== 40 || entries.some((e) => !/^portfolio-trade-\d-\d+$/.test(e.id)))
    throw Error("Export accepts only the forty generated demo entries.");
  for (const [path, key] of [
    ["workflow", "cards"],
    ["notes", "notes"],
  ])
    if (data["/api/" + path][key].some((row) => !row.id.startsWith("portfolio-")))
      throw Error("Unexpected non-demo " + path);
  data["/api/personal-journal"].trashed = [];
  const settings = data["/api/settings"];
  data["/api/settings"] = {
    timeZone: settings.timeZone,
    importTimeZone: settings.importTimeZone,
    multipliers: settings.multipliers,
    currencyConversion: settings.currencyConversion,
    aiConfigured: false,
    aiConnections: {},
  };
  const sessions = [];
  for (const review of data["/api/trading-review"].reviews.filter((r) => r.kind !== "month")) {
    const result = await get("session-entries?date=" + review.key + "&kind=" + review.kind);
    sessions.push(...result.entries.map((entry) => ({ ...entry, reviewKind: review.kind })));
  }
  const Database = require(
    require.resolve("better-sqlite3", { paths: [resolve(root, "apps/web")] }),
  );
  const db = new Database(resolve(root, "apps/web/data/journal.db"), { readonly: true });
  try {
    data.ruleChecks = db
      .prepare(
        "SELECT trade_key AS tradeKey,playbook_id AS playbookId,rule,followed FROM trade_rule_checks WHERE trade_key LIKE 'portfolio-trade-%'",
      )
      .all()
      .map((row) => ({ ...row, followed: Boolean(row.followed) }));
  } finally {
    db.close();
  }
  data.sessions = sessions;
  const ordered=[...entries].sort((a,b)=>(a.date+a.openedAt).localeCompare(b.date+b.openedAt)||a.id.localeCompare(b.id));
  const numbers=new Map(ordered.map((entry,index)=>[entry.tradeNo,index+1]));
  function renumber(value){
   if(typeof value==='string')return value.replace(/#(\d+)/g,(match,number)=>numbers.has(Number(number))?'#'+numbers.get(Number(number)):match);
   if(Array.isArray(value))return value.map(renumber);
   if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,key==='tradeNo'&&typeof item==='number'?(numbers.get(item)??item):renumber(item)]));
   return value;
  }
  const publicData=renumber(data);
  for (const review of publicData["/api/trading-review"].reviews) {
    if (review.kind === "day")
      review.postText = review.postText
        .replace(/^Что я сделал сегодня хорошо$/gm, "1) Что я сделал сегодня хорошо")
        .replace(/^Что я сделал сегодня плохо$/gm, "2) Что я сделал сегодня плохо")
        .replace(
          /^Что мне нужно сделать, чтобы стать лучше$/gm,
          "3) Что мне нужно сделать, чтобы стать лучше",
        );
  }

  publicData["/api/process-progress"].today = "2026-10-30";
  // Reject recognisable private-account references or credential material.
  const text = JSON.stringify(publicData);
  if (/Нурлан|Пралиев|YouTrade|You Trade|Goat Futures|sk-proj-|BEGIN PRIVATE KEY/i.test(text))
    throw Error("Private content detected; export stopped.");
  const dir = resolve(root, "apps/demo/src/generated");
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, "demo-data.json"), JSON.stringify(publicData));
  console.log(
    "Browser fixture exported:",
    entries.length,
    "trades;",
    sessions.length,
    "session notes.",
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
