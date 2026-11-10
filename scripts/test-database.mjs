// Real PostgreSQL execution in an isolated, in-memory PGlite instance. No hosted data.
// Supabase platform auth/storage and cron scheduling are minimal shims; app tables,
// functions, triggers, grants and RLS come unchanged from the migrations.
import { createLocalDatabase } from "./fixtures/local-database.mjs";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";

test("database: shared WiFi quotas and private-save/publication lifecycle", async () => {
  const db = await createLocalDatabase();
  try {
    for (const name of ["resume_analysis.sql", "shared_workshop_quotas.sql", "profile_publication.sql", "nfc_destinations.sql", "contact_cards.sql"]) {
      try { await db.exec(await readFile(new URL(`../supabase/tests/${name}`, import.meta.url), "utf8")); }
      catch (cause) { throw new Error(`SQL assertions failed: ${name}`, { cause }); }
    }
  } finally {
    await db.close();
  }
});

test("NFC migration preserves legacy mappings and disables claimed orphans", async () => {
  const owner = "20000000-0000-4000-8000-000000000001";
  const db = await createLocalDatabase(async (file, connection) => {
    if (file !== "20261110145152_nfc_contact_target_types.sql") return;
    await connection.exec(`
      insert into auth.users(id,email) values('${owner}','migration@example.invalid');
      insert into public.profiles(id,user_id,slug,display_name,headline,competency_tags,is_published)
        values('${owner}','${owner}','legacy-profile','Legacy','Legacy',array['tag'],true);
      insert into public.nfc_tags(tag_id,profile_id,mapped_at,claim_code_hash,target_type,custom_url)
        values('legacyProfile','${owner}',now(),null,'profile',null),
              ('legacyExternal','${owner}',now(),null,'custom_url','https://example.com/legacy'),
              ('legacyOrphan',null,now(),null,'profile',null);
    `);
  });
  try {
    const rows = (await db.query("select tag_id,owner_id,is_active,target_type,custom_url from public.nfc_tags order by tag_id")).rows;
    assert.deepEqual(rows.map(row => [row.tag_id,row.owner_id,row.is_active,row.target_type,row.custom_url]), [
      ["legacyExternal",owner,true,"custom_url","https://example.com/legacy"],
      ["legacyOrphan",null,false,"profile",null], ["legacyProfile",owner,true,"profile",null],
    ]);
    assert.equal((await db.query("select tag_status from public.resolve_nfc_tag('legacyProfile')")).rows[0].tag_status,"published");
    assert.equal((await db.query("select tag_status from public.resolve_nfc_tag('legacyOrphan')")).rows[0].tag_status,"inactive");
  } finally { await db.close(); }
});
