import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "node:crypto";
import { createRequestClient } from "@/lib/supabase/request-client";
import { MAX_RESUME_BYTES, resumeTextSchema } from "@/lib/builder/resume-schema";
import { extractResumePdf, ResumePdfError } from "@/lib/builder/pdf-extractor";
import { analyzeResume } from "@/lib/builder/resume-analyzer";

export const maxDuration = 30;

async function boundedBody(request: NextRequest, limit: number, signal: AbortSignal) {
  if (Number(request.headers.get("content-length") ?? 0) > limit) throw new Error("BODY_TOO_LARGE");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("INVALID_FORMAT");
  const chunks: Uint8Array[] = []; let size = 0;
  const abort = () => { void reader.cancel().catch(() => undefined); };
  signal.addEventListener("abort", abort, { once: true });
  try {
    while (true) {
      if (signal.aborted) throw new Error("TIMEOUT");
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new Error("BODY_TOO_LARGE"); }
      chunks.push(value);
    }
    if (signal.aborted) throw new Error("TIMEOUT");
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return bytes;
  } finally { signal.removeEventListener("abort", abort); reader.releaseLock(); }
}

export async function POST(request: NextRequest) {
  const { supabase, respond } = createRequestClient(request);
  const json = (body: unknown, status = 200) => respond(NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } }));
  const fail = (code: string, message: string, status = 400) => json({ success: false, code, message }, status);
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return fail("UNAUTHORIZED", "로그인이 필요합니다.", 401);
  if (request.headers.get("origin") !== request.nextUrl.origin) return fail("INVALID_ORIGIN", "요청 출처를 확인할 수 없어요.", 403);
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(20000)]);
  const contentType = request.headers.get("content-type") ?? "";
  const isPdf = contentType.startsWith("multipart/form-data");
  if (!isPdf && !contentType.startsWith("application/json")) return fail("INVALID_FORMAT", "PDF 또는 텍스트를 입력해 주세요.");
  try {
    const quota = await supabase.rpc("claim_resume_analysis_attempt", { p_ip_hash: createHash("sha256").update(ip).digest("hex") }).abortSignal(signal);
    if (quota.error) return fail("UNAVAILABLE", "분석 기능을 준비 중입니다. 잠시 후 다시 시도해 주세요.", 503);
    if (!quota.data) return fail("RATE_LIMIT_EXCEEDED", "분석 요청이 너무 많습니다. 1분 후 다시 시도해 주세요.", 429);
    const bytes = await boundedBody(request, isPdf ? MAX_RESUME_BYTES + 65536 : 65536, signal);
    let text: string; let source: "pdf" | "text"; let size: number;
    if (isPdf) {
      const form = await new Response(bytes, { headers: { "Content-Type": contentType } }).formData();
      const file = form.get("file");
      if (!(file instanceof File) || file.type !== "application/pdf" || !file.size) return fail("INVALID_FORMAT", "텍스트가 있는 PDF 파일을 선택해 주세요.");
      if (file.size > MAX_RESUME_BYTES) return fail("FILE_TOO_LARGE", "파일 크기는 4MB, 최대 5페이지 이하만 지원합니다.");
      text = await extractResumePdf(new Uint8Array(await file.arrayBuffer()), signal); source = "pdf"; size = file.size;
    } else {
      const body = z.object({ raw_text: resumeTextSchema }).strict().safeParse(JSON.parse(new TextDecoder().decode(bytes)));
      if (!body.success) return fail("INVALID_FORMAT", "이력서 텍스트를 50~8,000자 이내로 입력해 주세요.");
      text = body.data.raw_text; source = "text"; size = Buffer.byteLength(text, "utf8");
    }
    // Check deployment readiness before sending personal text to a paid provider.
    const ready = await supabase.from("resume_documents").select("id,source_type,expires_at").limit(0).abortSignal(signal);
    if (ready.error) return fail("UNAVAILABLE", "분석 기능을 준비 중입니다. 잠시 후 다시 시도하거나 직접 입력해 주세요.", 503);
    const { analysis, usage } = await analyzeResume(text, signal);
    const { data, error } = await supabase.from("resume_documents").insert({ user_id: user.id, source_type: source,
      storage_path: null, file_name: source === "pdf" ? "resume.pdf" : "pasted-text", mime_type: source === "pdf" ? "application/pdf" : "text/plain",
      size_bytes: size, parsed_content: analysis }).select("id").abortSignal(signal).single();
    if (error || !data) return fail("SAVE_FAILED", "분석 결과를 보관하지 못했어요. 기존 입력은 유지됩니다. 잠시 후 다시 시도해 주세요.", 503);
    return json({ success: true, usage, data: { document_id: data.id, ...analysis,
      projects: analysis.projects.map(project => ({ ...project, problem_and_action: [project.situation, project.action].filter(Boolean).join("\n") })) } });
  } catch (error) {
    if (signal.aborted || (error instanceof Error && error.message === "TIMEOUT")) return fail("TIMEOUT", "문서 분석 시간이 초과되었습니다. 다시 시도하거나 직접 입력을 이어가세요.", 504);
    if (error instanceof Error && error.message === "BODY_TOO_LARGE") return fail("FILE_TOO_LARGE", "파일은 4MB 이하, 텍스트는 8,000자 이하만 지원합니다.");
    if (error instanceof ResumePdfError) {
      if (error.code === "NO_TEXT_FOUND") return fail("NO_TEXT_FOUND", "문서에서 텍스트를 읽을 수 없습니다. 스캔본 대신 텍스트 복사가 가능한 PDF를 업로드하거나 텍스트를 직접 붙여넣어 주세요.");
      if (error.code === "TOO_MANY_PAGES") return fail("INVALID_FORMAT", "파일 크기는 4MB, 최대 5페이지 이하만 지원합니다.");
      if (error.code === "TEXT_TOO_LONG") return fail("INVALID_FORMAT", "문서 텍스트가 8,000자를 넘어요. 대표 경험만 추려 붙여넣어 주세요.");
      return fail("INVALID_FORMAT", "PDF를 읽지 못했어요. 암호화되지 않은 정상 PDF를 사용하거나 텍스트를 붙여넣어 주세요.");
    }
    if (error instanceof SyntaxError) return fail("INVALID_FORMAT", "입력 형식을 확인해 주세요.");
    console.warn("Resume analysis failed", { category: error instanceof z.ZodError ? "INVALID_AI_OUTPUT" : "UNAVAILABLE" });
    return fail("UNAVAILABLE", "일시적으로 분석을 완료하지 못했습니다. 다시 시도하거나 직접 입력을 이어가세요.", 503);
  }
}
