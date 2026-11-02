import { NextRequest, NextResponse } from "next/server";
import { createRequestClient } from "@/lib/supabase/request-client";

export async function proxy(request: NextRequest) {
  const { supabase, respond } = createRequestClient(request);
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      const login = new URL("/login", request.url);
      login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
      return respond(NextResponse.redirect(login));
    }
    if (request.nextUrl.pathname.startsWith("/builder")) {
      const { data: workshopSessionId, error: contextError } = await supabase.rpc("current_workshop_session_id");
      if (contextError || !workshopSessionId) {
        return respond(NextResponse.redirect(new URL("/session", request.url)));
      }
    }
    if (request.nextUrl.pathname.startsWith("/instructor")) {
      const { data: profile, error: roleError } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
      if (roleError || profile?.role !== "instructor") return respond(new NextResponse("강사 권한이 필요합니다.", { status: 403 }));
    }
    return respond();
  } catch {
    return respond(new NextResponse("로그인 상태를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.", { status: 503 }));
  }
}

export const config = {
  matcher: ["/builder/:path*", "/dashboard/:path*", "/session/:path*", "/settings/:path*", "/t/bind", "/instructor/:path*"],
};
