import "server-only";
import { cache } from "react";
import { io } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const getWorkspaceContext = cache(async () => {
  // Auth session expiry checks read the clock and must not run in the static shell.
  await io();
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");
  const [profile, workshop] = await Promise.all([
    supabase.from("users").select("name,role").eq("id", user.id).maybeSingle(),
    supabase.rpc("get_current_workshop_session"),
  ]);
  if (profile.error || !profile.data) throw new Error("회원 정보를 불러오지 못했습니다.");
  const result = workshop.data as { success?: boolean; data?: { sessionId: string; title: string; organizationName: string; expiresAt: string }; error?: { code?: string } } | null;
  return {
    id: user.id, name: profile.data.name as string, role: profile.data.role as string,
    workshop: result?.success && result.data ? result.data : null,
    workshopUnavailable: Boolean(workshop.error || (result?.error && result.error.code !== "NO_ACTIVE_SESSION")),
  };
});

export async function requireRole(roles: string[]) {
  const context = await getWorkspaceContext();
  if (!roles.includes(context.role)) redirect("/dashboard");
  return context;
}
