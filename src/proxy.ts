import { NextRequest, NextResponse } from "next/server";
import { createRequestClient } from "@/lib/supabase/request-client";

export async function proxy(request: NextRequest) {
  const { supabase, respond } = createRequestClient(request);
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      const login = new URL("/login", request.url);
      login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
      return respond(NextResponse.redirect(login, request.nextUrl.pathname === "/builder/preview" ? 302 : 307));
    }
    if (request.nextUrl.pathname.startsWith("/instructor") || request.nextUrl.pathname.startsWith("/admin")) {
      const { data: profile, error: roleError } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
      const requiredRole = request.nextUrl.pathname.startsWith("/admin") || request.nextUrl.pathname === "/instructor/sessions" ? "admin" : "instructor";
      if (roleError || profile?.role !== requiredRole) return respond(new NextResponse("이 화면에 접근할 권한이 없습니다.", { status: 403 }));
    }
    return respond();
  } catch {
    return respond(new NextResponse("로그인 상태를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.", { status: 503 }));
  }
}

export const config = {
  matcher: ["/builder/:path*", "/dashboard/:path*", "/session/:path*", "/settings/:path*", "/t/bind", "/instructor/:path*", "/admin/:path*"],
};
