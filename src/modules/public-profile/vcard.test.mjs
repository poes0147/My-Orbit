import assert from "node:assert/strict";
import { test } from "node:test";
import { createVCard } from "./vcard.ts";

test("creates a folded UTF-8 vCard without letting text create new properties", () => {
  const bio = "한글".repeat(35) + "\r\nTEL:injected";
  const card = createVCard({
    name: "테스트, 사용자",
    headline: "기획; 운영",
    bio,
    email: "test@example.invalid",
    phone: "+82-10-0000-0000",
    url: "https://example.invalid/p/test",
  });
  assert.ok(card.split("\r\n").every(line => Buffer.byteLength(line) <= 75));
  const unfolded = card.replaceAll("\r\n ", "");
  assert.ok(unfolded.startsWith("BEGIN:VCARD\r\nVERSION:3.0\r\nFN:테스트\\, 사용자\r\n"));
  assert.ok(unfolded.includes("\r\nN:테스트\\, 사용자;;;;\r\nTITLE:기획\\; 운영\r\n"));
  assert.ok(unfolded.includes("\r\nEMAIL;TYPE=INTERNET:test@example.invalid\r\nTEL;TYPE=CELL:+82-10-0000-0000\r\n"));
  assert.ok(unfolded.includes("\r\nURL:https://example.invalid/p/test\r\n"));
  assert.ok(unfolded.endsWith("\\nTEL:injected\r\nEND:VCARD\r\n"));
});
