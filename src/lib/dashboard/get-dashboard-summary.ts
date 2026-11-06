import "server-only";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { readSavedDraft } from "@/lib/builder/read-saved-draft";

export async function getDashboardSummary() {
  const context = await getWorkspaceContext();
  const supabase = await createSupabaseServerClient();
  const [profileResult, interviewResult, draftResult] = await Promise.all([
    supabase.from("profiles").select("id,slug,headline,is_published,updated_at").eq("user_id", context.id).maybeSingle(),
    supabase.from("ai_interview_sessions").select("status,updated_at").eq("user_id", context.id).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    context.workshopUnavailable ? null : readSavedDraft(supabase, context.id, context.workshop?.sessionId),
  ]);
  return {
    displayName: context.name,
    workshop: context.workshop,
    workshopUnavailable: context.workshopUnavailable,
    profile: profileResult.data,
    profileUnavailable: Boolean(profileResult.error),
    draftHeadline: draftResult?.status === 200 ? draftResult.draft?.current.headline ?? null : null,
    draftUnavailable: draftResult !== null && draftResult.status !== 200,
    interview: interviewResult.data,
    interviewUnavailable: Boolean(interviewResult.error),
  };
}
