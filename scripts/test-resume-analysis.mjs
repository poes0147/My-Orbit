import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resumePdf } from "./fixtures/resume-pdf.mjs";
import { MAX_RESUME_BYTES, resumeTextSchema, resumeAnalysisSchema, resumeToWizard } from "../src/lib/builder/resume-schema.ts";

assert.equal(MAX_RESUME_BYTES, 4194304);
for (const size of [0, 49, 8001]) assert.equal(resumeTextSchema.safeParse("x".repeat(size)).success, false);
for (const size of [50, 8000]) assert.equal(resumeTextSchema.safeParse("x".repeat(size)).success, true);
const candidate = { id: "proj-1", project_name: "전시 기획", role: "진행 담당", situation: "일정 중복", action: "공동 일정표 작성", result_outcome: "", is_primary: true };
assert.equal(resumeAnalysisSchema.safeParse({ primary_experience: { category: "기획", keywords: ["협업"] }, projects: [candidate], unmapped_notes: [] }).success, true);
assert.equal(resumeAnalysisSchema.safeParse({ primary_experience: { category: "", keywords: [] }, projects: [], unmapped_notes: [] }).success, false);
assert.deepEqual(resumeToWizard("분야", ["협업"], candidate), { experience: "전시 기획", keywords: "협업", situation: "일정 중복", role: "진행 담당", action: "공동 일정표 작성", result: "" });
assert.equal("values" in resumeToWizard("", [], candidate), false);
assert.equal("tone" in resumeToWizard("", [], candidate), false);

function parse(data) {
  return new Promise((resolve, reject) => {
    const worker = spawn(process.execPath, [fileURLToPath(new URL("../src/lib/builder/resume-pdf-worker.mjs", import.meta.url))], { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    const timer = setTimeout(() => { worker.kill(); reject(new Error("Parser timeout")); }, 20000);
    let output = ""; worker.stdout.setEncoding("utf8"); worker.stdout.on("data", chunk => output += chunk); worker.stderr.resume();
    worker.once("close", code => { clearTimeout(timer); try { resolve(JSON.parse(output)); } catch { reject(new Error(`PDF child failed (${code})`)); } });
    worker.once("error", error => { clearTimeout(timer); worker.kill(); reject(error); });
    worker.stdin.end(data);
  });
}
const good = await parse(resumePdf());
assert.match(good.text, /student exhibition/);
assert.equal((await parse(resumePdf("", 1))).code, "NO_TEXT_FOUND");
assert.equal((await parse(resumePdf("test", 6))).code, "TOO_MANY_PAGES");
assert.equal((await parse(resumePdf("x".repeat(8001)))).code, "TEXT_TOO_LONG");
assert.equal((await parse(new Uint8Array(Buffer.from("not a pdf")))).code, "INVALID_FORMAT");
console.log("PASS: text bounds, empty facts, project mapping, step3 isolation, real PDF extraction, blank/6-page/long/corrupt PDF rejection");
