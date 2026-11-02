import { NextRequest, NextResponse } from "next/server";
import { createRequestClient } from "@/lib/supabase/request-client";

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { supabase, respond } = createRequestClient(request);
  try {
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) return respond(NextResponse.json({ error: "로그아웃하지 못했습니다. 다시 시도해 주세요." }, { status: 503 }));
    return respond(NextResponse.redirect(new URL("/login", request.url), 303));
  } catch {
    return respond(NextResponse.json({ error: "Sign out failed. Please retry." }, { status: 503 }));
  }
}
