import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { resolve, dirname } from 'node:path';
import ts from 'typescript';
import { NextRequest } from 'next/server.js';

function handler({signedIn=true,owned=true,cached=false,quota=true,storageError=false}={}) {
 const cache=new Map(); const writes=[]; let aiCalls=0;
 const row={id:'33000000-0000-4000-8000-000000000001',input_hash:'hash',expires_at:'2099-01-01T00:00:00Z',analyzed_strengths:[],follow_up_questions:[]};
 const project={title:'카페',role:'담당자',problem:'혼잡',action:'컵 방향을 바꾸고 안내를 정리했다.',outcome:'혼잡이 줄었다.'};
 const supabase={auth:{getUser:async()=>({data:{user:signedIn?{id:'owner'}:null}})},rpc:()=>({abortSignal:async()=>({data:quota})}),from:table=>{
  let insert=false;
  const q={select:()=>q,eq:()=>q,gt:()=>q,abortSignal:()=>q,insert:value=>{writes.push({table,value});insert=true;return q;},
   maybeSingle:async()=>table==='ai_interview_sessions'?{data:owned?{answers:{step_responses:{project}}}:null}:{data:cached?row:null,error:storageError?{code:'missing'}:null},single:async()=>({data:insert?row:null})};return q;
 }};
 // External auth/DB/provider are fixture boundaries; route validation and projection run unchanged.
 function load(filename) {
  if(cache.has(filename)) return cache.get(filename).exports;
  const mod=new Module(filename);cache.set(filename,mod);const native=createRequire(filename);
  mod.require=name=>{
   if(name==='@/lib/supabase/request-client')return {createRequestClient:()=>({supabase,respond:r=>r})};
   if(name==='@/lib/builder/openai-config')return {getProfileAiConfig:()=>({model:'fixture'})};
   if(name==='@/lib/strengths/analyzer')return {strengthInputHash:()=> 'hash',analyzeStrengths:async()=>{aiCalls++;return {recommendedStrengths:[],followUpQuestions:[]};}};
   if(name.startsWith('@/'))return load(resolve('src',name.slice(2)+'.ts'));
   if(name.startsWith('.'))return load(resolve(dirname(filename),name+'.ts'));
   return native(name);
  };
  mod._compile(ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,filename);
  return mod.exports;
 }
 return {run:load(resolve('src/app/api/builder/analyze-strengths/route.ts')).POST,writes,calls:()=>aiCalls,project};
}
const request=(body,origin='http://localhost:3000')=>new NextRequest('http://localhost:3000/api/builder/analyze-strengths',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
const id={interviewSessionId:'33000000-0000-4000-8000-000000000003'};
test('strength API rejects anonymous, wrong origin, foreign draft, invalid input before AI',async()=>{
 for(const [options,body,origin,status] of [[{signedIn:false},id,undefined,401],[{},id,'https://evil.invalid',403],[{owned:false},id,undefined,403],[{},{experiences:[]},undefined,400]]){
  const h=handler(options);assert.equal((await h.run(request(body,origin))).status,status);assert.equal(h.calls(),0);assert.equal(h.writes.length,0);
 }
});
test('cache hit skips paid API and emits only owner analysis with private no-store',async()=>{
 const h=handler({cached:true});const r=await h.run(request(id));assert.equal(r.status,200);assert.match(r.headers.get('cache-control'),/no-store/);assert.equal((await r.json()).data.isCached,true);assert.equal(h.calls(),0);
});
test('missing migration and exhausted quota preserve drafts without calling provider',async()=>{
 for(const [options,status] of [[{storageError:true},503],[{quota:false},429]]){const h=handler(options);assert.equal((await h.run(request(id))).status,status);assert.equal(h.calls(),0);assert.equal(h.writes.length,0);}
});
test('successful analysis stores only analysis and never modifies a profile or draft',async()=>{
 const h=handler();const r=await h.run(request(id));assert.equal(r.status,200);assert.equal(h.calls(),1);assert.deepEqual(h.writes.map(x=>x.table),['strength_analyses']);assert.equal((await r.json()).data.recommendedStrengths.length,0);
});
