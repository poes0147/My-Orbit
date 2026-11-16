import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rankStrengths } from '../src/lib/strengths/ranker.ts';
import { strengthInputSchema } from '../src/lib/strengths/schema.ts';
import { createFallbackProfile, interviewRequestSchema } from '../src/lib/builder/profile-generation.ts';

const exp = (id, action, title='카페 운영') => ({ id, title, role:'담당자', problem:'혼잡', action, outcome:'개선' });
const ev = (id, strengthId, quote, extra={}) => ({ experienceId:id, strengthId, field:'action', quote, actor:'self', modality:'performed', ...extra });
test('duplicates do not inflate experience or evidence counts, including repeated copies',()=>{
 const text='주문 번호가 가려지는 모습을 확인하고 컵 방향을 바꿨다.';
 const result=rankStrengths([exp('a',text),exp('b',text)], [ev('a','str_observation',text),ev('a','str_observation',text),ev('b','str_observation',text)]);
 assert.equal(result.length,1); assert.equal(result[0].distinctExperienceCount,1); assert.equal(result[0].evidences.length,1);
});
test('rejects fabricated, negated, aspirational, other-person and keyword-only evidence',()=>{
 const experiences=[exp('a','직접 분석하지 않았다. 선배가 분석했다. 분석하고 싶었다. 분석력 분석력 분석력')];
 const result=rankStrengths(experiences,[ev('a','str_analysis','직접 분석하지 않았다.'),ev('a','str_analysis','선배가 분석했다.',{actor:'other'}),ev('a','str_analysis','분석하고 싶었다.',{modality:'aspiration'}),ev('a','str_analysis','분석력 분석력 분석력'),ev('a','str_analysis','매출을 50% 높였다.')]);
 assert.deepEqual(result,[]);
});
test('one action alone cannot fill three strengths; independent actions can',()=>{
 const text='사용자 동선을 관찰했다. 오류 사례를 분류하고 비교했다.';
 const result=rankStrengths([exp('a',text)],[ev('a','str_observation','사용자 동선을 관찰했다.'),ev('a','str_problem_identification','사용자 동선을 관찰했다.'),ev('a','str_analysis','오류 사례를 분류하고 비교했다.')]);
 assert.equal(result.length,2); assert.equal(result[0].name,'분석력');
 assert.deepEqual(rankStrengths([exp('a',text)],[]),[]);
});
test('independent experience count wins, deterministic ordering independent of extraction order',()=>{
 const experiences=[exp('a','오류 항목을 분류했다.','행사'),exp('b','실험 결과를 비교했다.','실험'),exp('c','동료의 말을 요약 확인했다.','회의')];
 const items=[ev('a','str_analysis','오류 항목을 분류했다.'),ev('b','str_analysis','실험 결과를 비교했다.'),ev('c','str_active_listening','동료의 말을 요약 확인했다.')];
 assert.equal(rankStrengths(experiences,items)[0].name,'분석력');
 assert.deepEqual(rankStrengths(experiences,items),rankStrengths(experiences,[...items].reverse()));
});
test('bounded input rejects duplicate IDs and empty experience lists',()=>{
 assert.equal(strengthInputSchema.safeParse({experiences:[]}).success,false);
 assert.equal(strengthInputSchema.safeParse({experiences:[exp('a','분석했다.'),exp('a','분석했다.')]}).success,false);
});
test('affirmative action is not rejected for not giving up or another actor on a separate line',()=>{
 for(const [source,quote] of [
  ['나는 포기하지 않고 오류 항목을 분류했다.','나는 포기하지 않고 오류 항목을 분류했다.'],
  ['선배가 자료를 모았다\n나는 오류 항목을 분류했다','나는 오류 항목을 분류했다'],
 ]) assert.equal(rankStrengths([exp('a',source)],[ev('a','str_analysis',quote)])[0]?.name,'분석력');
});
test('new profile fallback never fills invented strengths and preserves explicit reviewed selection',()=>{
 const input={workshopSessionId:null,stepData:{keywords:['협업'],project:{title:'카페 운영',role:'담당자',problem:'번호 혼동',action:'컵 번호가 보이지 않는 모습을 관찰하고 방향을 바꾸었다.',outcome:'동료에게 확인 방법을 설명했다.'},persona:{coreValues:['성장'],tone:'professional'}}};
 assert.deepEqual(createFallbackProfile(input).competency_tags,[]);
 assert.deepEqual(createFallbackProfile({...input,selectedCompetencies:['관찰력']}).competency_tags,['관찰력']);
 assert.equal(interviewRequestSchema.safeParse({...input,selectedCompetencies:['관찰력','관찰력']}).success,false);
});
