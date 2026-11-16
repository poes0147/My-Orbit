import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { test } from 'node:test';
import { resolve } from 'node:path';
import { NextRequest } from 'next/server.js';
import ts from 'typescript';

function handler(role, calls=[]) {
  const filename=resolve('src/lib/admin/nfc-api.ts'), localRequire=createRequire(filename), mod=new Module(filename);
  mod.require=name=>name==='@/lib/supabase/request-client'?{createRequestClient:()=>({respond:r=>r,supabase:{
    auth:{getUser:async()=>({data:{user:role?{id:'fixture'}:null}})},
    from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{role}})})})}),
    rpc:async(name,args)=>{calls.push({name,args});return {data:[{tag_id:'a'.repeat(32),registration_code:'b'.repeat(32),created_at:'2026-11-11T00:00:00Z',is_active:true,is_registered:false,registered_at:null,total_count:1,claim_code_hash:'DO_NOT_LEAK'}]};}
  }})}:localRequire(name);
  mod._compile(ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,filename);
  return mod.exports.manageAdminNfc;
}
const request=(path='/api/admin/nfc-tags',method='GET',headers={})=>new NextRequest('http://localhost:3000'+path,{method,headers});
test('admin NFC API denies unauthenticated/non-admin and malformed issuance before RPC',async()=>{
  for(const [role,status] of [[null,401],['participant',403],['instructor',403]]) assert.equal((await handler(role)(request(),'list')).status,status);
  const calls=[], run=handler('admin',calls);
  assert.equal((await run(request('/api/admin/nfc-tags/issue','POST'),'issue')).status,403);
  assert.equal((await run(request('/api/admin/nfc-tags/issue','POST',{origin:'http://localhost:3000'}),'issue')).status,400);
  assert.equal((await run(request('/api/admin/nfc-tags?page=-1'),'list')).status,400);
  assert.equal(calls.length,0);
});
test('admin NFC API emits safe list and separate URLs/code, never hash',async()=>{
  const run=handler('admin');
  const listed=await run(request(),'list');
  const data=await listed.json();
  assert.equal(JSON.stringify(data).includes('DO_NOT_LEAK'),false);
  assert.equal(JSON.stringify(data).includes('registrationCode'),false);
  assert.match(listed.headers.get('cache-control'),/no-store/);
  const issued=await run(request('/api/admin/nfc-tags/issue','POST',{origin:'http://localhost:3000','idempotency-key':'41000000-0000-4000-8000-000000000001'}),'issue');
  assert.equal(issued.status,201);
  const result=(await issued.json()).data;
  assert.equal(result.registrationCode,'b'.repeat(32));
  assert.ok(result.fixedUrl.endsWith('/t/'+'a'.repeat(32)));
  assert.ok(result.bindUrl.endsWith('/tags/bind/'+'a'.repeat(32)));
  assert.equal(result.fixedUrl.includes(result.registrationCode),false);
});
