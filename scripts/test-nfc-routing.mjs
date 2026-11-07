import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as tag from "../src/lib/nfc/tag.ts";
import { externalDestinationSchema, tagDestinationInputSchema, tagDestinationSchema } from "../src/lib/nfc/destination.ts";

assert.equal(tag.registrationCodeSchema.parse("AA11BB22-CC33DD44-EE55FF66-00112233"), "aa11bb22cc33dd44ee55ff6600112233");
for (const input of ["", "x".repeat(32), "1".repeat(49)]) {
  assert.equal(tag.registrationCodeSchema.safeParse(input).success, false);
}
for (const url of ["https://instagram.com/myorbit", "HTTPS://www.notion.so/example?p=1#demo"]) {
  assert.equal(externalDestinationSchema.safeParse(url).success, true);
}
for (const url of ["", "http://example.com", "javascript:alert(1)", "https://localhost", "https://127.1",
  "https://192.168.0.1", "https://[fd00::1]", "https://2130706433", "https://0x7f000001",
  "https://office.internal", "https://example.com@bad.example", "https://example.com:8443", "https://example.com/has a space",
  "https://example.com/\\bad"]) {
  assert.equal(externalDestinationSchema.safeParse(url).success, false, url);
}
assert.equal(tagDestinationInputSchema.safeParse({ target_type: "profile", custom_url: null }).success, true);
assert.equal(tagDestinationSchema.safeParse({ tag_id: "READY", is_active: true, target_type: "profile", custom_url: null, updated_at: "now" }).success, true);
assert.equal(tagDestinationSchema.safeParse({ tag_id: "READY", is_active: true, target_type: "custom_url", custom_url: "https://instagram.com/myorbit", updated_at: "now" }).success, true);

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
  ["EXTERNAL", { tag_status: "external", public_slug: null, external_url: "https://instagram.com/myorbit" }],
]);
const lookedUp = [];
runInNewContext(source, {
  exports, Response, URL, console: { error() {} },
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
  ["INACTIVE", 302, "/t/INACTIVE/unavailable?reason=invalid"],
  ["PRIVATE", 302, "/t/PRIVATE/unavailable?reason=private"],
  ["UNKNOWN", 302, "/t/UNKNOWN/unavailable?reason=invalid"],
  ["EXTERNAL", 302, "https://instagram.com/myorbit"],
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
resolutions.set("READY", resolutions.get("EXTERNAL"));
assert.equal((await get("READY")).headers.get("location"), "https://instagram.com/myorbit");
resolutions.set("READY", { tag_status: "published", public_slug: "orbit-fixture" });
assert.equal((await get("READY")).headers.get("location"), "/p/orbit-fixture");
console.log("PASS: NFC 302/307, fallback statuses, no-store, no lookup for invalid IDs, and code validation");
