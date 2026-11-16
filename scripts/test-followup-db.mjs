import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createLocalDatabase} from './fixtures/local-database.mjs';
test('followup private rows, immutable owner/expiry, question cap, expiry and account quota',async()=>{
 const db=await createLocalDatabase();
 try{
  await db.exec(`insert into auth.users(id,email) values('34000000-0000-4000-8000-000000000001','followup1@example.invalid'),('34000000-0000-4000-8000-000000000002','followup2@example.invalid');
   set role authenticated;set request.jwt.claim.sub='34000000-0000-4000-8000-000000000001';
   insert into public.ai_followup_sessions(id,user_id,base_experience) values('34000000-0000-4000-8000-000000000003',auth.uid(),'{}');`);
  assert.equal((await db.query('select * from public.ai_followup_sessions')).rows.length,1);
  await assert.rejects(db.exec(`update public.ai_followup_sessions set user_id='34000000-0000-4000-8000-000000000002'`));
  await assert.rejects(db.exec(`update public.ai_followup_sessions set expires_at=now()+interval '1 year'`));
  await assert.rejects(db.exec(`update public.ai_followup_sessions set qa_history='[1,2,3,4]'`));
  await db.exec(`update public.ai_followup_sessions set qa_history='[]',revision=1;`);
  for(let i=0;i<5;i++)assert.equal((await db.query('select public.claim_followup_attempt() as allowed')).rows[0].allowed,true);
  assert.equal((await db.query('select public.claim_followup_attempt() as allowed')).rows[0].allowed,false);
  await db.exec(`set request.jwt.claim.sub='34000000-0000-4000-8000-000000000002'`);
  assert.equal((await db.query('select * from public.ai_followup_sessions')).rows.length,0);
  assert.equal((await db.query(`update public.ai_followup_sessions set revision=2 returning id`)).rows.length,0);
  await assert.rejects(db.exec(`insert into public.ai_followup_sessions(user_id,base_experience) values('34000000-0000-4000-8000-000000000001','{}')`));
  assert.equal((await db.query('select public.claim_followup_attempt() as allowed')).rows[0].allowed,true);
  await db.exec('reset role;set role anon');await assert.rejects(db.query('select * from public.ai_followup_sessions'));await assert.rejects(db.query('select public.claim_followup_attempt()'));
  await db.exec(`reset role;update public.ai_followup_sessions set expires_at=now()-interval '1 second';set role authenticated;set request.jwt.claim.sub='34000000-0000-4000-8000-000000000001'`);
  assert.equal((await db.query('select * from public.ai_followup_sessions')).rows.length,0);
  assert.equal((await db.query(`update public.ai_followup_sessions set revision=3 returning id`)).rows.length,0);
 }finally{await db.close();}
});
