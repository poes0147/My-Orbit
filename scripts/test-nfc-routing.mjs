import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as tag from "../src/lib/nfc/tag.ts";

assert.equal(tag.registrationCodeSchema.parse("AA11BB22-CC33DD44-EE55FF66-00112233"), "aa11bb22cc33dd44ee55ff6600112233");
for (const input of ["", "x".repeat(32), "1".repeat(49)]) {
  assert.equal(tag.registrationCodeSchema.safeParse(input).success, false);
}

const routePath = new URL("../src/app/t/[tag_id]/route.ts", import.meta.url);
const source = ts.transpileModule(readFileSync(routePath, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exports = {};
const resolutions = new Map([
  ["READY", { tag_status: "published", public_slug: "orbit-fixture" }],
  ["UNBOUND", { tag_status: "unbound", public_slug: null }],
  ["INACTIVE", { tag_status: "inactive", public_slug: null }],
  ["PRIVATE", { tag_status: "unavailable", public_slug: null }],
]);
const lookedUp = [];
runInNewContext(source, {
  exports, Response, console: { error() {} },
  require(name) {
    if (name === "@/lib/nfc/tag") return tag;
    if (name === "@/lib/nfc/resolve-tag") return { resolveTag: async id => {
      lookedUp.push(id);
      if (id === "ERROR") throw new Error("Fixture lookup error");
      return resolutions.get(id) ?? null;
    } };
    throw new Error("Unexpected dependency " + name);
  },
});
const get = id => exports.GET(new Request("http://localhost/t/" + id), { params: Promise.resolve({ tag_id: id }) });
for (const [id, status, location] of [
  ["READY", 302, "/p/orbit-fixture"],
  ["UNBOUND", 307, "/tags/bind/UNBOUND"],
  ["INACTIVE", 200, null],
  ["PRIVATE", 200, null],
  ["UNKNOWN", 404, null],
  ["INVALID!", 404, null],
  ["ERROR", 503, null],
]) {
  const response = await get(id);
  assert.equal(response.status, status);
  assert.equal(response.headers.get("location"), location);
  assert.match(response.headers.get("cache-control"), /no-store/);
  assert.doesNotMatch(await response.text(), /orbit-fixture|INVALID!/);
}
assert.equal(lookedUp.includes("INVALID!"), false);
console.log("PASS: NFC 302/307, fallback statuses, no-store, no lookup for invalid IDs, and code validation");
