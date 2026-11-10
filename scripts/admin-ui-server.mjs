// npm run build -- --webpack first. Uses Next's installed webpack, no extra packages.
// UI only: access control is independently tested in test-admin-access.mjs.
import { createServer } from "node:http";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { webpack } = require("next/dist/compiled/webpack/webpack");
await new Promise((done, fail) => webpack({
  mode: "development", devtool: false, entry: resolve("scripts/admin-ui-entry.tsx"),
  output: { path: resolve("test-artifacts/admin-ui"), filename: "app.js" },
  resolve: { extensions: [".tsx", ".ts", ".js"], alias: {
    "@": resolve("src"), "next/link$": resolve("scripts/fixtures/admin-next-link.tsx"),
    "next/navigation$": resolve("scripts/fixtures/admin-next-navigation.ts"),
  } },
  module: { rules: [{ test: /\.tsx?$/, exclude: /node_modules/, use: resolve("scripts/fixtures/tsx-loader.mjs") }] },
}, (error, stats) => error || stats.hasErrors() ? fail(error ?? new Error(stats.toString({ all: false, errors: true }))) : done()));
createServer((req, res) => {
  if (req.url.startsWith("/api/")) { res.writeHead(501); res.end("Supply isolated API fixtures in the browser test."); return; }
  if (req.url === "/app.js") { res.setHeader("Content-Type", "text/javascript"); res.end(readFileSync("test-artifacts/admin-ui/app.js")); return; }
  if (req.url === "/app.css") {
    res.setHeader("Content-Type", "text/css");
    res.end(readdirSync(".next/static/css").filter(f => f.endsWith(".css")).map(f => readFileSync(join(".next/static/css", f), "utf8")).join("\n")); return;
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end('<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><body><div id="root"></div><script src="/app.js"></script></body></html>');
}).listen(3105, "127.0.0.1", () => console.log("Isolated admin UI: http://127.0.0.1:3105/admin"));
