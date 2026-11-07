import assert from "node:assert/strict";
import { rewriteLimited } from "../src/lib/builder/rewrite-rate-limit.ts";

for (let i = 0; i < 10; i++) assert.equal(rewriteLimited("user:test", 10, 1000), false);
assert.equal(rewriteLimited("user:test", 10, 1000), true);
assert.equal(rewriteLimited("user:other", 10, 1000), false);
assert.equal(rewriteLimited("user:test", 10, 60999), true);
assert.equal(rewriteLimited("user:test", 10, 61000), false);
for (let i = 0; i < 5; i++) assert.equal(rewriteLimited("block:test:summary", 5, 1000), false);
assert.equal(rewriteLimited("block:test:summary", 5, 1001), true);
assert.equal(rewriteLimited("block:test:title", 5, 1001), false);
console.log("PASS: per-user and per-block quotas, isolation and exact rolling-window expiry");
