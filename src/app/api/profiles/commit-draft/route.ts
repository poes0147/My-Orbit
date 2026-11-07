import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { editableTextSchema } from "@/lib/builder/editable-draft";
import { createRequestClient } from "@/lib/supabase/request-client";

const inputSchema = z.object({
  draftSessionId: z.uuid(),
  idempotencyKey: z.uuid(),
  expectedContent: editableTextSchema,
  existingProfileId: z.uuid().nullable(),
}).strict();

const savedSchema = z.object({ profileId: z.uuid(), isPublished: z.literal(false), updatedAt: z.string() });

const errors: Record<string, [number, string]> = {
  DRAFT_NOT_FOUND: [404, "저장된 초안을 찾을 수 없어요."],
  DRAFT_CHANGED: [409, "초안 내용이 바뀌었어요. 미리보기를 새로고침해 다시 확인해 주세요."],
  PROFILE_CHANGED: [409, "프로필 상태가 바뀌었어요. 화면을 새로고침해 주세요."],
  PUBLISHED_PROFILE_CONFLICT: [409, "공개 중인 프로필에는 초안을 반영할 수 없어요."],
  INVALID_DRAFT_CONTENT: [400, "저장된 초안의 내용을 확인해 주세요."],
};

export async function POST(request: NextRequest) {
  const { supabase, respond } = createRequestClient(request);
  const fail = (status: number, code: string, message: string) =>
    respond(NextResponse.json({ success: false, code, message }, { status }));
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return fail(401, "UNAUTHORIZED", "로그인이 필요해요.");
  if (request.headers.get("origin") !== request.nextUrl.origin) return fail(403, "INVALID_ORIGIN", "요청 출처를 확인할 수 없어요.");

  const input = inputSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return fail(400, "INVALID_INPUT", "미리보기에서 저장 내용을 다시 확인해 주세요.");
  const { data, error } = await supabase.rpc("commit_draft_to_profile", {
    p_draft_session_id: input.data.draftSessionId,
    p_idempotency_key: input.data.idempotencyKey,
    p_expected_content: input.data.expectedContent,
    p_existing_profile_id: input.data.existingProfileId,
  }).retry(false);
  if (error && Object.hasOwn(errors, error.message)) {
    const [status, message] = errors[error.message];
    return fail(status, error.message, message);
  }
  if (error?.code === "40001") return fail(409, "DRAFT_CHANGED", "저장 내용이 바뀌었어요. 미리보기를 새로고침해 다시 확인해 주세요.");
  const saved = savedSchema.safeParse(data);
  if (error || !saved.success) return fail(503, "SAVE_FAILED", "프로필을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
  revalidatePath("/dashboard");
  revalidatePath("/builder/preview");
  return respond(NextResponse.json({ success: true, data: saved.data }));
}
