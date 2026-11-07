import "server-only";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { editableTextSchema } from "./editable-draft";
import { profileGenerationSchema } from "./profile-generation";

export async function readSavedDraft(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  workshopSessionId?: string | null,
) {
  let query = supabase.from("ai_interview_sessions").select("id,answers,updated_at,workshop_session_id")
    .eq("user_id", userId).eq("status", "completed");
  if (workshopSessionId !== undefined) {
    query = workshopSessionId ? query.eq("workshop_session_id", workshopSessionId) : query.is("workshop_session_id", null);
  }
  const { data, error } = await query.order("created_at", { ascending: false }).order("id").limit(1).maybeSingle();
  if (error) return { status: 503, message: "저장된 초안을 불러오지 못했어요." } as const;
  if (!data) return { status: 200, draft: null } as const;

  const original = editableTextSchema.safeParse(data.answers?.generated_draft);
  if (!original.success) return { status: 422, message: "저장된 초안 형식을 확인하지 못했어요. 새 초안을 만들어 주세요." } as const;
  const current = editableTextSchema.safeParse(data.answers?.edited_draft ?? data.answers?.generated_draft);
  if (!current.success) return { status: 422, message: "수정본을 읽지 못했어요. 다시 시도해 주세요." } as const;
  const guide = profileGenerationSchema.shape.object_guide.safeParse(data.answers?.generated_draft?.object_guide);
  return {
    status: 200,
    workshopSessionId: data.workshop_session_id as string | null,
    draft: { id: data.id, updatedAt: data.updated_at, original: original.data, current: current.data, ...(guide.success ? { objectGuide: guide.data } : {}) },
  } as const;
}
