// Local production runtime uses the SAME persistent data directory as development.
const { spawnSync } = require("node:child_process");
const { resolve } = require("node:path");
const { existsSync } = require("node:fs");
const web = resolve(__dirname, "../apps/web");
const cli = require.resolve("next/dist/bin/next", { paths: [web] });
const mode = process.argv[2] || "start";
const env = { ...process.env, JOURNAL_FAST_BUILD: "1", JOURNAL_DATA_DIR: resolve(web,"data") };
function run(args) {
  const result = spawnSync(process.execPath,[cli,...args],{cwd:web,env,stdio:"inherit"});
  if(result.error) { console.error(result.error.message);process.exit(1); }
  if(result.status !== 0) process.exit(result.status || 1);
}
if(mode === "build") { run(["build"]);process.exit(0); }
if(mode !== "start") {console.error("Usage: node scripts/local-journal.cjs [start|build]");process.exit(1);}
if(!existsSync(resolve(web,".next-fast/BUILD_ID"))) run(["build"]);
console.log("Portfolio: http://127.0.0.1:3002 (separate data)");
run(["start","-p","3002","-H","127.0.0.1"]);
