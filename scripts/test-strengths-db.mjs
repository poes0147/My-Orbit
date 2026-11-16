import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createLocalDatabase } from './fixtures/local-database.mjs';
test('strength cache is private, expires, and cannot be read by another owner or anonymous role',async()=>{
 const db=await createLocalDatabase();
 try {
  await db.exec(`insert into auth.users(id,email) values ('31000000-0000-4000-8000-000000000001','one@example.invalid'),('31000000-0000-4000-8000-000000000002','two@example.invalid');
    set role authenticated; set request.jwt.claim.sub='31000000-0000-4000-8000-000000000001';
    insert into public.strength_analyses(user_id,input_hash,model_name,analyzed_strengths) values(auth.uid(),'hash','fixture','[]');`);
  assert.equal((await db.query('select * from public.strength_analyses')).rows.length,1);
  await db.exec(`set request.jwt.claim.sub='31000000-0000-4000-8000-000000000002';`);
  assert.equal((await db.query('select * from public.strength_analyses')).rows.length,0);
  await assert.rejects(db.exec(`insert into public.strength_analyses(user_id,input_hash,model_name,analyzed_strengths) values('31000000-0000-4000-8000-000000000001','forged','fixture','[]')`));
  await db.exec('reset role; set role anon;');
  await assert.rejects(db.query('select * from public.strength_analyses'));
  await db.exec(`reset role; update public.strength_analyses set expires_at=now()-interval '1 second'; set role authenticated; set request.jwt.claim.sub='31000000-0000-4000-8000-000000000001';`);
  assert.equal((await db.query('select * from public.strength_analyses')).rows.length,0);
 } finally { await db.close(); }
});
test('zero to three tags save privately, one tag publishes, quota is per account',async()=>{
 const db=await createLocalDatabase();
 try {
  await db.exec(`insert into auth.users(id,email) values ('32000000-0000-4000-8000-000000000001','save@example.invalid'),('32000000-0000-4000-8000-000000000002','quota@example.invalid');
    set role authenticated; set request.jwt.claim.sub='32000000-0000-4000-8000-000000000001';`);
  for(let i=0;i<5;i++) assert.equal((await db.query('select public.claim_strength_analysis_attempt() as allowed')).rows[0].allowed,true);
  assert.equal((await db.query('select public.claim_strength_analysis_attempt() as allowed')).rows[0].allowed,false);
  let profile=null;
  for(const tags of [[],['관찰력'],['관찰력','분석력']]) {
   const content={headline:'구체적인 경험을 정리한 프로필',competency_tags:tags,project_summary:'작업 현장에서 관찰한 문제를 정리했습니다.'};
   await db.query(`insert into public.ai_interview_sessions(id,user_id,status,answers) values('32000000-0000-4000-8000-000000000003',auth.uid(),'completed',$1::jsonb) on conflict(id) do update set answers=excluded.answers`,[JSON.stringify({generated_draft:content})]);
   const result=(await db.query(`select public.commit_draft_to_profile('32000000-0000-4000-8000-000000000003',gen_random_uuid(),$1::jsonb,$2::uuid) as saved`,[JSON.stringify(content),profile])).rows[0].saved;
   profile=result.profileId;
   assert.equal(result.isPublished,false);
   assert.deepEqual((await db.query('select competency_tags from public.profiles where id=$1',[profile])).rows[0].competency_tags,tags);
  }
  await db.exec(`update public.profiles set display_name='테스트', is_published=true;`);
  await db.exec(`set request.jwt.claim.sub='32000000-0000-4000-8000-000000000002';`);
  assert.equal((await db.query('select public.claim_strength_analysis_attempt() as allowed')).rows[0].allowed,true);
 } finally {await db.close();}
});
