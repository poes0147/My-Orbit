// Explicit one-call, synthetic-data smoke check. Never uploads a user's resume.
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { resolve, dirname } from 'node:path';
import ts from 'typescript';
if(process.env.RUN_LIVE_STRENGTHS!=='1') throw new Error('Set RUN_LIVE_STRENGTHS=1 to authorize one paid synthetic API call.');
const cache=new Map();
function load(filename){
 if(cache.has(filename))return cache.get(filename).exports;
 const mod=new Module(filename), native=createRequire(filename);cache.set(filename,mod);
 mod.require=name=>name==='server-only'?{}:name.startsWith('@/')?load(resolve('src',name.slice(2)+'.ts')):name.startsWith('.')?load(resolve(dirname(filename),name+'.ts')):native(name);
 mod._compile(ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,filename);
 return mod.exports;
}
const {analyzeStrengths}=load(resolve('src/lib/strengths/analyzer.ts'));
const result=await analyzeStrengths([
 {id:'cafe',title:'카페 운영',role:'주문 전달 담당',problem:'손님이 주문 번호를 확인하기 어려웠다.',action:'컵 손잡이가 주문 번호를 가리는 모습을 관찰했다. 컵 방향을 바꿔 놓고 동료에게 이유를 설명했다.',outcome:'동료와 같은 방식으로 안내하기로 했다.'},
 {id:'clay',title:'클레이 실험',role:'개인 제작자',problem:'만든 점토가 갈라졌다.',action:'두께와 건조 시간을 기록했다. 조건별 결과를 표로 비교했다. 실패한 조건을 바꾸어 다시 제작했다.',outcome:'다음 실험에 사용할 기록을 남겼다.'},
],AbortSignal.timeout(25000));
if(!result.recommendedStrengths.length) throw new Error('Synthetic concrete actions produced no candidates; inspect extraction/ranking.');
console.log(JSON.stringify({count:result.recommendedStrengths.length,names:result.recommendedStrengths.map(x=>x.name),evidenceCounts:result.recommendedStrengths.map(x=>x.evidences.length)}));
