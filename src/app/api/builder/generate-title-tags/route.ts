import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateTitleTags } from "@/lib/builder/generate-title-tags";
import { interviewRequestSchema } from "@/lib/builder/profile-generation";
import { rewriteLimited } from "@/lib/builder/rewrite-rate-limit";
import { createRequestClient } from "@/lib/supabase/request-client";

const inputSchema = z.object({ interviewSessionId: z.uuid() }).strict();

export async function POST(request: NextRequest) {
  const { supabase, respond } = createRequestClient(request);
  const json = (body: unknown, status = 200) => respond(NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } }));
  const fail = (message: string, status: number) => json({ success: false, message }, status);
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return fail("로그인이 필요해요.", 401);
  if (request.headers.get("origin") !== request.nextUrl.origin) return fail("요청 출처를 확인할 수 없어요.", 403);
  if (!request.headers.get("content-type")?.includes("application/json")) return fail("JSON 요청이 필요해요.", 415);

  let body: unknown;
  try {
    if (Number(request.headers.get("content-length") ?? 0) > 512) return fail("요청이 너무 길어요.", 413);
    const raw = await request.text();
    if (raw.length > 512) return fail("요청이 너무 길어요.", 413);
    body = JSON.parse(raw);
  } catch {
    return fail("요청 내용을 확인해 주세요.", 400);
  }
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) return fail("초안 주소를 확인해 주세요.", 400);

  const { data: draft, error } = await supabase.from("ai_interview_sessions").select("answers")
    .eq("id", parsed.data.interviewSessionId).eq("user_id", user.id).eq("status", "completed").maybeSingle();
  if (error) return fail("초안을 불러오지 못했어요.", 503);
  if (!draft) return fail("이 초안에 접근할 수 없어요.", 403);
  const stepData = interviewRequestSchema.shape.stepData.safeParse(draft.answers?.step_responses);
  if (!stepData.success) return fail("세 단계 답변을 다시 입력하고 초안을 만들어 주세요.", 400);

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (rewriteLimited("title-tags:user:" + user.id, 5) || rewriteLimited("title-tags:ip:" + ip, 5)) {
    return fail("1분에 최대 5번까지 생성할 수 있어요.", 429);
  }
  return json({ success: true, ...await generateTitleTags(stepData.data, request.signal) });
}
