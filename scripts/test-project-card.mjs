import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanProjectLine, fallbackProjectLines, projectCardInputSchema, projectCardSchema, projectLinesSchema } from "../src/lib/builder/project-card.ts";

const input = {
  project_name: "교내 전시",
  role: "전시 운영 담당",
  raw_problem: "문의가 몰렸습니다.\n추가 문의가 많았습니다.",
  raw_action: "안내 표지판을 설치하고 자원봉사자에게 구역별 업무를 배정했습니다.",
  raw_result: "대기 시간이 15분에서 8분으로 줄었습니다",
};

test("requires all three STAR lines and accepts a manually edited line", () => {
  assert.ok(projectCardInputSchema.safeParse(input).success);
  const lines = fallbackProjectLines(input);
  assert.ok(projectLinesSchema.safeParse(lines).success);
  assert.ok(!projectLinesSchema.safeParse({ ...lines, result_line: undefined }).success);
  const card = { ...lines, title: input.project_name, role: input.role, link_url: "https://example.invalid/exhibit" };
  assert.equal(projectCardSchema.parse({ ...card, action_line: "안내 표지판을 추가했습니다." }).action_line, "안내 표지판을 추가했습니다.");
  assert.ok(!projectCardSchema.safeParse({ ...card, link_url: "javascript:alert(1)" }).success);
});

test("fallback uses the original facts and normalizes text to one line", () => {
  const lines = fallbackProjectLines(input);
  assert.equal(lines.context_line, "문의가 몰렸습니다.");
  assert.equal(lines.action_line, input.raw_action);
  assert.equal(lines.result_line, input.raw_result + ".");
  assert.equal(cleanProjectLine("구역별\n안내"), "구역별 안내.");
  assert.equal(cleanProjectLine("가".repeat(200)).length, 180);
});

test("API rejects an anonymous request", { skip: !process.env.ORBIT_TEST_URL }, async () => {
  const base = new URL(process.env.ORBIT_TEST_URL);
  const response = await fetch(new URL("/api/builder/project-card", base), {
    method: "POST", headers: { Origin: base.origin, "Content-Type": "application/json" }, body: JSON.stringify(input),
  });
  assert.equal(response.status, 401);
});
