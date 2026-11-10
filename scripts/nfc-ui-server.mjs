// Local-only integration harness. Real app handlers/components + migrations/RLS.
// Auth/session verification is a fixture; Supabase HTTP transport is replaced by
// a small PGlite adapter. Never reads .env or contacts a hosted Supabase project.
import { createServer } from "node:http";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { createLocalDatabase } from "./fixtures/local-database.mjs";
const require = createRequire(import.meta.url);
const { NextRequest } = require("next/server");
const { webpack } = require("next/dist/compiled/webpack/webpack");
const db = await createLocalDatabase();
const owner = "10000000-0000-4000-8000-000000000001";
await db.query("insert into auth.users(id,email) values($1,'fixture@example.invalid')", [owner]);
const issued = (await db.query("select * from private.issue_nfc_tag()")).rows[0];
await db.query("select * from private.issue_nfc_tag()");
console.log("LOCAL ONLY tag/claim:", issued.tag_id, issued.registration_code);

const rpcNames = new Set(["save_contact_card", "delete_contact_card", "set_nfc_destination", "get_nfc_contact", "resolve_nfc_tag", "bind_nfc_tag"]);
function resultQuery(action) {
  const run = async () => { try { return { data: JSON.parse(JSON.stringify(await action())), error: null }; } catch (error) { return { data: null, error: { code: error.code } }; } };
  return { then: (ok, fail) => run().then(ok, fail), single: async () => { const r = await run(); return { ...r, data: Array.isArray(r.data) ? r.data[0] ?? null : r.data }; }, maybeSingle: async () => { const r = await run(); return { ...r, data: Array.isArray(r.data) ? r.data[0] ?? null : r.data }; } };
}
const client = {
  auth: { getUser: async () => ({ data: { user: { id: owner } }, error: null }) },
  rpc(name, args) {
    if (!rpcNames.has(name)) throw new Error("Unexpected RPC");
    const entries = Object.entries(args);
    if (entries.some(([key]) => !/^p_[a-z_]+$/.test(key))) throw new Error("Invalid parameter");
    return resultQuery(async () => {
      const rows = (await db.query(`select * from public.${name}(${entries.map(([key], i) => `${key} => $${i + 1}`).join(",")})`, entries.map(([, value]) => value))).rows;
      return ["save_contact_card", "delete_contact_card", "set_nfc_destination"].includes(name) ? rows[0]?.[name] : rows;
    });
  },
  from(table) {
    if (!["nfc_tags", "contact_cards"].includes(table)) throw new Error("Unexpected table");
    return { select(columns) {
      if (!/^[a-z_,]+$/.test(columns)) throw new Error("Invalid columns");
      return { eq(column, value) {
        if (!["id", "tag_id"].includes(column)) throw new Error("Invalid filter");
        return resultQuery(async () => (await db.query(`select ${columns} from public.${table} where ${column}=$1`, [value])).rows);
      } };
    } };
  },
};
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const exports = {}; cache.set(file, exports);
  const source = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(source, { exports, Response, Request, URL, TextEncoder, console, require(name) {
    if (name === "server-only") return {};
    if (name === "@/lib/supabase/request-client") return { createRequestClient: () => ({ supabase: client, respond: response => { response.headers.set("cache-control", "private, no-store"); return response; } }) };
    if (name === "@/lib/supabase/public-client") return { createPublicClient: () => client };
    if (name.startsWith("@/")) return load(resolve("src", name.slice(2) + ".ts"));
    if (name.startsWith(".")) return load(resolve(file, "..", name + ".ts"));
    return require(name);
  } });
  return exports;
}
const cards = load(resolve("src/app/api/contact-cards/route.ts"));
const destination = load(resolve("src/app/api/tags/[tagId]/destination/route.ts"));
const binding = load(resolve("src/app/api/tags/bind/route.ts"));
const contact = load(resolve("src/app/t/[tag_id]/contact/route.ts"));
const routing = load(resolve("src/app/t/[tag_id]/route.ts"));
await new Promise((done, fail) => webpack({
  mode: "development", devtool: false, entry: resolve("scripts/nfc-ui-entry.tsx"),
  output: { path: resolve("test-artifacts/nfc-ui"), filename: "app.js" },
  resolve: { extensions: [".tsx", ".ts", ".js"], alias: { "@": resolve("src"), "next/link$": resolve("scripts/fixtures/admin-next-link.tsx"), "next/navigation$": resolve("scripts/fixtures/admin-next-navigation.ts") } },
  module: { rules: [{ test: /\.tsx?$/, exclude: /node_modules/, use: resolve("scripts/fixtures/tsx-loader.mjs") }] },
}, (error, stats) => error || stats.hasErrors() ? fail(error ?? new Error(stats.toString({ all: false, errors: true }))) : done()));
// Serialize requests because the isolated connection has session-scoped roles.
let queue = Promise.resolve();
createServer((req, res) => { queue = queue.then(async () => {
  try {
    if (req.url === "/app.js") { res.setHeader("Content-Type", "text/javascript"); res.end(readFileSync("test-artifacts/nfc-ui/app.js")); return; }
    if (req.url === "/app.css") { res.setHeader("Content-Type", "text/css"); res.end(readdirSync(".next/static/css").filter(f => f.endsWith(".css")).map(f => readFileSync(join(".next/static/css", f), "utf8")).join("\n")); return; }
    const publicRequest = /^\/t\//.test(req.url);
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [publicRequest ? "" : owner]);
    await db.exec(publicRequest ? "set role anon" : "set role authenticated");
    if (req.url === "/fixture-state") {
      const tags = (await db.query("select tag_id,is_active,target_type,custom_url,card_id,alias,updated_at from public.nfc_tags")).rows;
      const cardRows = (await db.query("select id,card_name,display_name,phone_number,email,organization_name,job_title,website_url,updated_at from public.contact_cards")).rows;
      const counts = {}; for (const tag of tags) if (tag.card_id) counts[tag.card_id] = (counts[tag.card_id] ?? 0) + 1;
      res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ owner, tags, cards: cardRows, counts, issued })); return;
    }
    if (req.url.startsWith("/api/") || publicRequest) {
      const buffers = []; for await (const chunk of req) buffers.push(chunk);
      const body = Buffer.concat(buffers).toString();
      const request = new NextRequest("http://127.0.0.1:3106" + req.url, { method: req.method, headers: req.headers, ...(body ? { body } : {}) });
      const id = req.url.split("/")[2];
      let response;
      if (req.url === "/api/contact-cards") response = await cards[req.method](request);
      else if (req.url === "/api/tags/bind") response = await binding.POST(request);
      else if (/^\/api\/tags\/[^/]+\/destination$/.test(req.url)) response = await destination.PATCH(request, { params: Promise.resolve({ tagId: req.url.split("/")[3] }) });
      else if (req.url.endsWith("/contact")) response = await contact.GET(request, { params: Promise.resolve({ tag_id: id }) });
      else response = await routing.GET(request, { params: Promise.resolve({ tag_id: id }) });
      res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(await response.text()); return;
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end('<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><body><div id="root"></div><script src="/app.js"></script></body></html>');
  } catch (error) { console.error(error); res.writeHead(500); res.end("Fixture error"); }
}); }).listen(3106, "127.0.0.1", () => console.log("Isolated NFC UI http://127.0.0.1:3106/dashboard"));
