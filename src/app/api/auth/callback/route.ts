import { NextRequest, NextResponse } from "next/server";
import { createRequestClient, safeNext } from "@/lib/supabase/request-client";

export async function GET(request: NextRequest) {
  const { supabase, respond } = createRequestClient(request);
  const code = request.nextUrl.searchParams.get("code");
  if (code && !request.nextUrl.searchParams.has("error")) {
    try {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return respond(NextResponse.redirect(new URL(safeNext(request.nextUrl.searchParams.get("next")), request.url), 303));
    } catch { /* Failed or expired codes return to the sign-in screen. */ }
  }
  return respond(NextResponse.redirect(new URL("/login?error=auth_failed", request.url), 303));
}
