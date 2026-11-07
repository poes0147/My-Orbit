import assert from "node:assert/strict";
import { test } from "node:test";
import { fallbackTitleTags, titleTagsSchema } from "../src/lib/builder/title-tags.ts";

const identity = { professionalTitle: "전시 운영과 협업을 조율하는 실행가", coreCompetencies: ["전시 운영", "협업", "동선 설계"] };

test("validates exactly three distinct competencies and rejects out-of-range text", () => {
  assert.ok(titleTagsSchema.safeParse(identity).success);
  for (const tags of [
    ["기획", "운영"],
    ["기획", "운영", "협업", "설계"],
    ["전시 운영", "전시운영", "기획"],
    ["AI", "ＡＩ", "기획"],
    ["팀", "운영", "협업"],
    ["가".repeat(16), "운영", "협업"],
  ]) {
    assert.equal(titleTagsSchema.safeParse({ ...identity, coreCompetencies: tags }).success, false);
  }
  assert.equal(titleTagsSchema.safeParse({ ...identity, professionalTitle: "짧음" }).success, false);
});

test("fallback uses entered keywords and fills gaps with distinct tags", () => {
  const result = fallbackTitleTags([" 협업 ", "협업", "기획\n운영", "팀"], "creative");
  assert.deepEqual(result.coreCompetencies, ["협업", "기획 운영", "문제 해결"]);
  assert.ok(titleTagsSchema.safeParse(result).success);
  assert.ok(titleTagsSchema.safeParse(fallbackTitleTags([], "professional")).success);
});
