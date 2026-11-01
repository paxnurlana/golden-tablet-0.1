// Local verification server with the same missing-route behaviour as Pages.
const http = require("node:http");
const { readFileSync, existsSync, statSync } = require("node:fs");
const { resolve, extname, sep } = require("node:path");
const root = resolve(__dirname, "../apps/demo/dist");
const { base } = JSON.parse(readFileSync(resolve(root, "site-config.json"), "utf8"));
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".ttf": "font/ttf",
};
http
  .createServer((request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
      if (!pathname.startsWith(base)) {
        response.writeHead(302, { Location: base });
        response.end();
        return;
      }
      const relative = pathname.slice(base.length) || "index.html";
      const file = resolve(root, relative);
      if (file !== root && !file.startsWith(root + sep)) {
        response.writeHead(403);
        response.end();
        return;
      }
      if (existsSync(file) && statSync(file).isFile()) {
        response.writeHead(200, {
          "Content-Type": types[extname(file)] ?? "application/octet-stream",
        });
        response.end(readFileSync(file));
      } else {
        response.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
        response.end(readFileSync(resolve(root, "404.html")));
      }
    } catch {
      response.writeHead(400);
      response.end("Invalid request");
    }
  })
  .listen(3003, "127.0.0.1", () => console.log("Pages preview: http://127.0.0.1:3003" + base));
