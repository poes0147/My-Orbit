import { test } from 'node:test';
import assert from 'node:assert/strict';
import { answerSchema, experienceSchema, answerSession, proposeExperience } from '../src/lib/builder/followup-contract.ts';
const base={experience:'행사',situation:'안내가 어려웠다',role:'운영',action:'',result:''};
const question={dimension:'ACTION',questionText:'직접 한 일은 무엇인가요?',contextHint:'행동을 알려 주세요.'};
const session={base_experience:base,qa_history:[{...question,answer:null,is_skipped:false}],revision:0,status:'IN_PROGRESS'};
test('answer validates whitespace length and 500-character limit',()=>{
 const data={sessionId:'33000000-0000-4000-8000-000000000001',revision:0,questionIndex:0,isSkipped:false};
 assert.equal(answerSchema.safeParse({...data,answer:'가 나 다 라'}).success,false);
 assert.equal(answerSchema.safeParse({...data,answer:'x'.repeat(501)}).success,false);
 assert.equal(answerSchema.safeParse({...data,isSkipped:true}).success,true);
});
test('answer requires current index; revising invalidates later context; skip counts toward cap',()=>{
 assert.throws(()=>answerSession(session,2,'직접 안내했다',false));
 const first=answerSession(session,0,'안내 표지를 직접 만들었다',false);
 assert.equal(first.qa_history.length,1);
 const third={...session,qa_history:[...first.qa_history,{...question,answer:'동선을 수정했다',is_skipped:false},{...question,answer:null,is_skipped:false}]};
 const skipped=answerSession(third,2,'',true);assert.equal(skipped.status,'COMPLETED');
 const edited=answerSession(third,0,'새 표지를 만들었다',false);assert.equal(edited.qa_history.length,1);assert.equal(edited.status,'IN_PROGRESS');
});
test('proposal uses verbatim user answers, excludes skipped answers and never truncates',()=>{
 const data={...session,qa_history:[{...question,answer:'표지를 직접 만들었다',is_skipped:false},{...question,answer:'허위 내용',is_skipped:true}]};
 assert.equal(proposeExperience(data).action,'표지를 직접 만들었다');
 assert.equal(proposeExperience(data).result,'');
 const long=proposeExperience({...data,base_experience:{...base,action:'x'.repeat(500)}});
 assert.ok(long.action.length>500);assert.equal(experienceSchema.safeParse(long).success,false);
});
