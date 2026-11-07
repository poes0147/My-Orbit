import { NextRequest, NextResponse } from "next/server";
import { createRequestClient } from "@/lib/supabase/request-client";
import { hasPublicProfile } from "@/modules/public-profile/get-public-profile";

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/p/")) {
    try {
      const slug = request.nextUrl.pathname.slice(3);
      // Check before the streamed shell commits to HTTP 200.
      if (await hasPublicProfile(slug)) return NextResponse.next();
      return NextResponse.rewrite(new URL("/_not-found", request.url), { status: 404 });
    } catch {
      return new NextResponse("공개 프로필을 불러오지 못했어요.", { status: 503 });
    }
  }
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
  matcher: ["/p/:slug", "/builder/:path*", "/dashboard/:path*", "/session/:path*", "/settings/:path*", "/t/bind", "/instructor/:path*", "/admin/:path*"],
};
