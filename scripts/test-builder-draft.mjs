import assert from "node:assert/strict";
import { initialDraft, validateDraft, restoreDraft, createWizardPayload } from "../src/lib/builder/draft.ts";

const draft = { ...initialDraft, experience: "동아리 전시 기획", keywords: "기획, 협업", situation: "일정이 겹쳤습니다", role: "전시 기획", action: "팀원들과 일정을 함께 조율하고 공통 작업표를 만들어 공유했습니다.", result: "예정된 날짜에 전시를 성공적으로 마쳤습니다.", values: ["협업"], tone: "professional" };
for (let step = 0; step < 3; step++) assert.deepEqual(validateDraft(draft, step), {});
assert.ok(validateDraft(initialDraft, 0).keywords);
assert.ok(validateDraft({ ...draft, keywords: "1,2,3,4,5,6" }, 0).keywords);
assert.ok(validateDraft({ ...draft, action: "짧음" }, 1).action);
assert.ok(validateDraft({ ...draft, result: "짧음" }, 1).result);
assert.ok(validateDraft({ ...draft, tone: "forged" }, 2).tone);
const saved = { version: 1, draft, step: 1, review: false };
assert.deepEqual(restoreDraft(JSON.stringify(saved)), saved);
for (const raw of [null, "not-json", JSON.stringify({ ...saved, step: 99 }), JSON.stringify({ ...saved, draft: { ...draft, experience: "x".repeat(121) } })]) assert.equal(restoreDraft(raw), null);
const payload = createWizardPayload(draft, "workshop-id");
assert.deepEqual(payload.stepData.keywords, ["기획", "협업"]);
assert.equal(payload.workshopSessionId, "workshop-id");
assert.equal(payload.stepData.persona.tone, "professional");
console.log("PASS: step validation, restore/corruption/limits and submission payload");
