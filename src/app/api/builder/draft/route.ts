import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createRequestClient } from "@/lib/supabase/request-client";
import { editableTextSchema } from "@/lib/builder/editable-draft";
import { profileGenerationSchema } from "@/lib/builder/profile-generation";

const patchSchema = z.object({ id: z.string().uuid(), updatedAt: z.string().datetime({ offset: true }), current: editableTextSchema }).strict();
const workshopSchema = z.string().uuid().nullable();

export async function GET(request: NextRequest) {
  const { supabase, respond } = createRequestClient(request);
  const json = (body: unknown, status = 200) => respond(NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } }));
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return json({ success: false, message: "로그인이 필요해요." }, 401);
  const scope = workshopSchema.safeParse(request.nextUrl.searchParams.get("workshopSessionId"));
  if (!scope.success) return json({ success: false, message: "워크숍 주소를 확인해 주세요." }, 400);
  let query = supabase.from("ai_interview_sessions").select("id,answers,updated_at").eq("user_id", user.id).eq("status", "completed");
  query = scope.data ? query.eq("workshop_session_id", scope.data) : query.is("workshop_session_id", null);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) return json({ success: false, message: "저장된 초안을 불러오지 못했어요." }, 503);
  if (!data) return json({ success: true, draft: null });
  const original = editableTextSchema.safeParse(data.answers?.generated_draft);
  if (!original.success) return json({ success: false, message: "저장된 초안 형식을 확인하지 못했어요. 새 초안을 만들어 주세요." }, 422);
  const current = editableTextSchema.safeParse(data.answers?.edited_draft ?? data.answers?.generated_draft);
  if (!current.success) return json({ success: false, message: "수정본을 읽지 못했어요. 다시 시도해 주세요." }, 422);
  const guide = profileGenerationSchema.shape.object_guide.safeParse(data.answers?.generated_draft?.object_guide);
  return json({ success: true, draft: { id: data.id, updatedAt: data.updated_at, original: original.data, current: current.data, ...(guide.success ? { objectGuide: guide.data } : {}) } });
}

export async function PATCH(request: NextRequest) {
  const { supabase, respond } = createRequestClient(request);
  const json = (body: unknown, status = 200) => respond(NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } }));
  if (request.headers.get("origin") !== request.nextUrl.origin) return json({ success: false, message: "요청 출처를 확인할 수 없어요." }, 403);
  if (!request.headers.get("content-type")?.includes("application/json")) return json({ success: false, message: "JSON 요청이 필요해요." }, 415);
  if (Number(request.headers.get("content-length") ?? 0) > 8000) return json({ success: false, message: "입력 내용이 너무 길어요." }, 413);
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return json({ success: false, message: "로그인이 필요해요." }, 401);
  let body: unknown;
  try { const raw = await request.text(); if (raw.length > 8000) return json({ success: false, message: "입력 내용이 너무 길어요." }, 413); body = JSON.parse(raw); } catch { return json({ success: false, message: "입력 내용을 확인해 주세요." }, 400); }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return json({ success: false, message: "소개·역량 3개·요약을 빈칸 없이 입력해 주세요." }, 400);
  const { id, updatedAt, current } = parsed.data;
  const { data: row, error } = await supabase.from("ai_interview_sessions").select("answers").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (error) return json({ success: false, message: "초안을 확인하지 못했어요." }, 503);
  if (!row) return json({ success: false, message: "수정할 초안을 찾을 수 없어요." }, 404);
  const answers = z.record(z.string(), z.unknown()).safeParse(row.answers);
  if (!answers.success || !editableTextSchema.safeParse(answers.data.generated_draft).success) return json({ success: false, message: "초안 형식이 올바르지 않아요." }, 422);
  const { data: saved, error: saveError } = await supabase.from("ai_interview_sessions").update({ answers: { ...answers.data, edited_draft: current } })
    .eq("id", id).eq("user_id", user.id).eq("updated_at", updatedAt).select("updated_at").maybeSingle();
  if (saveError) return json({ success: false, message: "저장하지 못했어요. 수정 내용은 유지됩니다. 다시 시도해 주세요." }, 503);
  if (!saved) return json({ success: false, message: "다른 화면에서 초안이 변경됐어요. 수정 내용을 복사한 뒤 새로고침해 주세요." }, 409);
  return json({ success: true, updatedAt: saved.updated_at });
}
