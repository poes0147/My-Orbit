import assert from "node:assert/strict";
import { generateWorkshopCode, withCodeRetry } from "../src/lib/workshops/code.ts";

for (let i = 0; i < 1000; i++) assert.match(generateWorkshopCode(), /^[A-HJ-NP-Z2-9]{6}$/);
let attempts = 0;
const retried = await withCodeRetry(async () => ++attempts < 5 ? { data: null, error: { code: "23505" } } : { data: "created", error: null });
assert.equal(attempts, 5);
assert.equal(retried.data, "created");
attempts = 0;
const exhausted = await withCodeRetry(async () => { attempts++; return { data: null, error: { code: "23505" } }; });
assert.equal(attempts, 5);
assert.equal(exhausted.error.code, "CODE_COLLISION");
attempts = 0;
const denied = await withCodeRetry(async () => { attempts++; return { data: null, error: { code: "42501" } }; });
assert.equal(attempts, 1);
assert.equal(denied.error.code, "42501");
console.log("PASS: 1,000 codes; collision recovery, exhaustion and permission errors");
