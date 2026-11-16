import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLocalDatabase } from './fixtures/local-database.mjs';

test('admin NFC: authorization, issuance replay, safe listing and profileless binding', async () => {
  const db = await createLocalDatabase();
  const admin='31000000-0000-4000-8000-000000000001', member='31000000-0000-4000-8000-000000000002', instructor='31000000-0000-4000-8000-000000000003';
  const key='41000000-0000-4000-8000-000000000001';
  const identity=async(id,role='authenticated')=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec(`set role ${role}`);};
  try {
    for(const id of [admin,member,instructor]) await db.query("insert into auth.users(id,email) values($1,$2)",[id,id+'@example.invalid']);
    await db.query("update public.users set role='admin' where id=$1",[admin]);
    await db.query("update public.users set role='instructor' where id=$1",[instructor]);
    for(const id of [member,instructor,'']) {
      await identity(id,id?'authenticated':'anon');
      await assert.rejects(db.query('select * from public.admin_issue_nfc_tag($1)',[key]),{code:'42501'});
      await assert.rejects(db.query('select * from public.admin_list_nfc_tags(1,20)'),{code:'42501'});
    }
    await identity(admin);
    await assert.rejects(db.query('select * from public.admin_list_nfc_tags(0,20)'),{code:'22023'});
    await assert.rejects(db.query('select * from public.admin_list_nfc_tags(1,101)'),{code:'22023'});
    const first=(await db.query('select * from public.admin_issue_nfc_tag($1)',[key])).rows[0];
    assert.match(first.tag_id,/^[a-f0-9]{32}$/); assert.match(first.registration_code,/^[a-f0-9]{32}$/);
    const replay=(await db.query('select * from public.admin_issue_nfc_tag($1)',[key])).rows[0];
    assert.equal(replay.tag_id,first.tag_id); assert.equal(replay.registration_code,null);
    let list=(await db.query('select * from public.admin_list_nfc_tags(1,20)')).rows;
    assert.equal(list.length,1); assert.equal(list[0].is_registered,false);
    assert.deepEqual(Object.keys(list[0]).sort(),['tag_id','is_active','is_registered','created_at','registered_at','total_count'].sort());
    await assert.rejects(db.query('select * from private.nfc_tag_issuances'));
    await identity(member);
    const bound=(await db.query('select * from public.bind_nfc_tag($1,$2,$3)',[first.tag_id,first.registration_code,'a'.repeat(64)])).rows[0];
    assert.equal(bound.result_code,'SUCCESS');
    assert.equal((await db.query("select public.set_nfc_destination($1,'custom_url','https://example.com/test',null,null,true) as result",[first.tag_id])).rows[0].result,true);
    await identity(admin);
    list=(await db.query('select * from public.admin_list_nfc_tags(1,20)')).rows;
    assert.equal(list[0].is_registered,true); assert.ok(list[0].registered_at);
    assert.equal((await db.query('select * from public.admin_issue_nfc_tag($1)',[key])).rows[0].registration_code,null);
    await identity(member);
    assert.equal((await db.query('select owner_id,custom_url from public.nfc_tags')).rows[0].owner_id,member);
    assert.equal((await db.query('select custom_url from public.nfc_tags')).rows[0].custom_url,'https://example.com/test');
  } finally { await db.close(); }
});
