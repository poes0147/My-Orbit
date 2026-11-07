import "server-only";
import { spawn } from "node:child_process";
import path from "node:path";
import { z } from "zod";

export class ResumePdfError extends Error {
  constructor(public code: "NO_TEXT_FOUND" | "INVALID_FORMAT" | "TOO_MANY_PAGES" | "TEXT_TOO_LONG" | "TIMEOUT") { super(code); }
}

export function extractResumePdf(data: Uint8Array, signal: AbortSignal): Promise<string> {
  if (new TextDecoder("ascii").decode(data.subarray(0, 5)) !== "%PDF-") return Promise.reject(new ResumePdfError("INVALID_FORMAT"));
  return new Promise((resolve, reject) => {
    // A process isolates parser CPU/memory and avoids native canvas crashes in
    // worker_threads on Windows. Originals travel over stdin, never a file.
    const worker = spawn(process.execPath, ["--max-old-space-size=128", path.join(process.cwd(), "src/lib/builder/resume-pdf-worker.mjs")], {
      windowsHide: true, stdio: ["pipe", "pipe", "pipe"],
      env: { NODE_ENV: process.env.NODE_ENV, SystemRoot: process.env.SystemRoot ?? "", PATH: process.env.PATH ?? "", TEMP: process.env.TEMP ?? "" },
    });
    let settled = false;
    const finish = (text?: string, error?: ResumePdfError) => {
      if (settled) return;
      settled = true; signal.removeEventListener("abort", abort);
      worker.kill();
      if (error) reject(error); else resolve(text ?? "");
    };
    const abort = () => finish(undefined, new ResumePdfError("TIMEOUT"));
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) { abort(); return; }
    let output = "";
    worker.stdout.setEncoding("utf8");
    worker.stdout.on("data", (chunk: string) => { output += chunk; if (output.length > 50000) finish(undefined, new ResumePdfError("INVALID_FORMAT")); });
    worker.stderr.resume();
    worker.stdin.on("error", () => finish(undefined, new ResumePdfError("INVALID_FORMAT")));
    worker.once("close", () => {
      if (settled) return;
      let value: unknown;
      try { value = JSON.parse(output); } catch { finish(undefined, new ResumePdfError("INVALID_FORMAT")); return; }
      const result = z.object({ text: z.string().optional(), code: z.enum(["NO_TEXT_FOUND", "INVALID_FORMAT", "TOO_MANY_PAGES", "TEXT_TOO_LONG"]).optional() }).safeParse(value);
      if (!result.success) finish(undefined, new ResumePdfError("INVALID_FORMAT"));
      else if (result.data.code) finish(undefined, new ResumePdfError(result.data.code));
      else if (result.data.text !== undefined) finish(result.data.text);
      else finish(undefined, new ResumePdfError("INVALID_FORMAT"));
    });
    worker.once("error", () => finish(undefined, new ResumePdfError("INVALID_FORMAT")));
    worker.stdin.end(data);
  });
}
