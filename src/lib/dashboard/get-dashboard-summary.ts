import "server-only";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getDashboardSummary() {
  const context = await getWorkspaceContext();
  const supabase = await createSupabaseServerClient();
  const [profileResult, interviewResult] = await Promise.all([
    supabase.from("profiles").select("id,slug,headline,is_published,updated_at").eq("user_id", context.id).maybeSingle(),
    supabase.from("ai_interview_sessions").select("status,updated_at").eq("user_id", context.id).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  return {
    displayName: context.name,
    workshop: context.workshop,
    workshopUnavailable: context.workshopUnavailable,
    profile: profileResult.data,
    profileUnavailable: Boolean(profileResult.error),
    interview: interviewResult.data,
    interviewUnavailable: Boolean(interviewResult.error),
  };
}
