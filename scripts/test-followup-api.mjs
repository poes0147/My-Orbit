import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import {resolve,dirname} from 'node:path';
import ts from 'typescript';
import {NextRequest} from 'next/server.js';
const id='33000000-0000-4000-8000-000000000001';
const base={experience:'행사',situation:'혼잡',role:'담당자',action:'',result:''};
function fixture({signedIn=true,quota=true,providerError=false,foreign=false}={}){
 const rows=new Map();let calls=0;const mutations=[];
 if(foreign)rows.set(id,{id,user_id:'other'});
 const supabase={auth:{getUser:async()=>({data:{user:signedIn?{id:'owner'}:null}})},rpc:()=>({abortSignal:async()=>({data:quota})}),from:table=>{
  assert.equal(table,'ai_followup_sessions');let insert,patch;const filters={};
  const q={select:()=>q,eq:(k,v)=>{filters[k]=v;return q;},gt:()=>q,abortSignal:()=>q,insert:v=>{insert=v;return q;},update:v=>{patch=v;return q;},single:()=>execute(),maybeSingle:()=>execute()};
  async function execute(){
   if(insert){if(rows.has(insert.id))return {error:{code:'23505'}};const row={...insert,qa_history:[],revision:0,status:'IN_PROGRESS',expires_at:'2099-01-01T00:00:00Z',applied_at:null,confirmed_experience:null};rows.set(row.id,row);mutations.push('insert');return {data:structuredClone(row)};}
   const row=rows.get(filters.id);if(!row||Object.entries(filters).some(([k,v])=>row[k]!==v))return {data:null};
   if(patch){Object.assign(row,patch);mutations.push('update');}return {data:structuredClone(row)};
  }return q;
 }};
 const cache=new Map();function load(filename){
  if(cache.has(filename))return cache.get(filename).exports;
  const mod=new Module(filename);cache.set(filename,mod);const native=createRequire(filename);
  mod.require=name=>{
   if(name==='server-only')return {};
   if(name==='@/lib/supabase/request-client')return {createRequestClient:()=>({supabase,respond:r=>r})};
   if(name==='./followup-generator')return {generateFollowupQuestion:async s=>{calls++;if(providerError)throw new Error('fixture');return {dimension:Object.values(s.base_experience).every(v=>!v)?'RECALL':['ROLE','ACTION','RESULT'][s.qa_history.length],questionText:`質問${s.qa_history.length}：直接何をしましたか？`,contextHint:'行動を教えてください'};}};
   if(name.startsWith('@/'))return load(resolve('src',name.slice(2)+'.ts'));
   if(name.startsWith('.'))return load(resolve(dirname(filename),name+'.ts'));
   return native(name);
  };
  mod._compile(ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,filename);return mod.exports;
 }
 const handler=load(resolve('src/lib/builder/followup-handler.ts')).handleFollowup;
 async function run(op,body,origin='http://localhost:3000'){
  const r=await handler(new NextRequest(`http://localhost:3000/api/builder/followup-questions/${op}`,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)}),op);return {status:r.status,body:await r.json(),cache:r.headers.get('cache-control')};
 }return {run,rows,calls:()=>calls,mutations};
}
test('auth, origin, foreign ID, quota and invalid input stop before paid generation',async()=>{
 for(const [options,op,body,origin,status] of [
  [{signedIn:false},'next',{sessionId:id,baseExperience:base},undefined,401],
  [{},'next',{sessionId:id,baseExperience:base},'https://evil.invalid',403],
  [{foreign:true},'next',{sessionId:id,baseExperience:base},undefined,403],
  [{quota:false},'next',{sessionId:id,baseExperience:base},undefined,429],
  [{},'answer',{sessionId:id,revision:0,questionIndex:3,isSkipped:true},undefined,400],
 ]){const f=fixture(options);assert.equal((await f.run(op,body,origin)).status,status);assert.equal(f.calls(),0);}
});
test('three questions max, retries replay pending question, answer edits invalidate later history',async()=>{
 const f=fixture();let r=await f.run('next',{sessionId:id,baseExperience:base});assert.equal(r.status,200);assert.match(r.cache,/no-store/);
 await f.run('next',{sessionId:id,baseExperience:base});assert.equal(f.calls(),1);
 for(let i=0;i<3;i++){
  const row=f.rows.get(id);r=await f.run('answer',{sessionId:id,revision:row.revision,questionIndex:i,answer:'안내 표지를 만들었다',isSkipped:i===1});assert.equal(r.status,200);
  r=await f.run('next',{sessionId:id,baseExperience:base});assert.equal(r.status,200);
 }
 assert.equal(f.calls(),3);assert.equal(r.body.data.status,'COMPLETED');
 const rev=r.body.data.revision;
 r=await f.run('answer',{sessionId:id,revision:rev,questionIndex:0,answer:'안내 동선을 변경했다',isSkipped:false});assert.equal(r.status,200);assert.equal(r.body.data.qa_history.length,1);
 const stale=await f.run('answer',{sessionId:id,revision:rev,questionIndex:1,answer:'변경된 답변입니다',isSkipped:false});assert.equal(stale.status,409);
 assert.equal((await f.run('next',{sessionId:id,baseExperience:{...base,role:'변경'}})).status,409);
});
test('empty input recalls, provider failure visible, explicit apply only writes session and retries safely',async()=>{
 const f=fixture();const empty=Object.fromEntries(Object.keys(base).map(k=>[k,'']));
 let r=await f.run('next',{sessionId:id,baseExperience:empty});assert.equal(r.body.data.qa_history[0].dimension,'RECALL');
 const answer={sessionId:id,revision:r.body.data.revision,questionIndex:0,answer:'학교에서 발표를 준비했다',isSkipped:false};
 r=await f.run('answer',answer);assert.equal(r.status,200);assert.equal((await f.run('answer',answer)).status,200);
 const apply={sessionId:id,revision:r.body.data.revision,confirmedExperience:{...empty,situation:answer.answer}};
 r=await f.run('apply',apply);assert.equal(r.status,200);assert.deepEqual(r.body.experience,apply.confirmedExperience);assert.equal((await f.run('apply',apply)).status,200);
 const broken=fixture({providerError:true});r=await broken.run('next',{sessionId:id,baseExperience:base});assert.equal(r.status,503);assert.equal(broken.rows.get(id).qa_history.length,0);
});
