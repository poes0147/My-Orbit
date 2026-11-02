import { NextRequest, NextResponse } from "next/server";
import { createRequestClient, safeNext } from "@/lib/supabase/request-client";

export async function GET(request: NextRequest) {
  const provider = request.nextUrl.searchParams.get("provider");
  if (provider !== "google" && provider !== "kakao") return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });
  const { supabase, respond } = createRequestClient(request);
  const callback = new URL("/api/auth/callback", request.url);
  callback.searchParams.set("next", safeNext(request.nextUrl.searchParams.get("next")));
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: callback.toString(), skipBrowserRedirect: true } });
    if (!error && data.url) return respond(NextResponse.redirect(data.url, 303));
  } catch { /* Present a retry message without logging tokens or provider payloads. */ }
  return respond(NextResponse.redirect(new URL("/login?error=signin_failed", request.url), 303));
}
