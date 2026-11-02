import { NextRequest, NextResponse } from "next/server";
import { createRequestClient } from "@/lib/supabase/request-client";

export async function GET(request: NextRequest) {
  const { supabase, respond } = createRequestClient(request);
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return respond(NextResponse.json({ user: null }, { status: 401 }));
    const { data: profile, error: profileError } = await supabase.from("users").select("name, role").eq("id", user.id).maybeSingle();
    return respond(NextResponse.json({ user: { id: user.id, email: user.email, name: profile?.name ?? user.user_metadata.full_name ?? user.user_metadata.name ?? "", role: profile?.role ?? "participant" }, profileSyncReady: !profileError && Boolean(profile) }));
  } catch {
    return respond(NextResponse.json({ error: "Authentication service unavailable" }, { status: 503 }));
  }
}
