const { spawnSync } = require("node:child_process");
const { resolve, dirname } = require("node:path");
const { writeFileSync } = require("node:fs");
const root = resolve(__dirname, "..");
const repo = (process.env.GITHUB_REPOSITORY ?? "").split("/").at(-1);
const base =
  process.env.DEMO_BASE_PATH ?? (!repo || repo.endsWith(".github.io") ? "/" : `/${repo}/`);
if (!/^\/(?:[a-zA-Z0-9_.-]+\/)*$/.test(base)) throw Error("Invalid Pages base path");
const demo = resolve(root, "apps/demo");
const vite = resolve(
  dirname(require.resolve("vite/package.json", { paths: [demo] })),
  "bin/vite.js",
);
const result = spawnSync(process.execPath, [vite, "build"], {
  cwd: demo,
  env: { ...process.env, DEMO_BASE_PATH: base },
  stdio: "inherit",
});
if (result.status !== 0) process.exit(result.status ?? 1);
const out = resolve(root, "apps/demo/dist");
writeFileSync(resolve(out, ".nojekyll"), "");
writeFileSync(
  resolve(out, "site-config.json"),
  JSON.stringify({ base, format: "static-browser-demo" }),
);
// Pages has no server-side SPA rewrite. A deep link visits the root once, then
// the client restores the requested route before rendering the application.
writeFileSync(
  resolve(out, "404.html"),
  `<!doctype html><html lang="ru"><meta charset="utf-8"><title>The Golden Tablet</title><script>sessionStorage.setItem('golden-tablet-route',location.pathname+location.search+location.hash);location.replace(${JSON.stringify(base)});</script><p>Открываем демо… <a href="${base}">На главную</a></p></html>`,
);
console.log("GitHub Pages artifact ready:", base);
