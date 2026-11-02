import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

// Authentication stays on the server so the session cookies can be HttpOnly.
export function createRequestClient(request: NextRequest) {
  let sessionResponse = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase environment variables are missing");
  const cookieOptions = {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:",
    sameSite: "lax" as const,
    path: "/",
  };
  const supabase = createServerClient(url, key, {
    cookieOptions,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookies) {
        cookies.forEach(({ name, value }) => request.cookies.set(name, value));
        sessionResponse = NextResponse.next({ request });
        cookies.forEach(({ name, value, options }) => sessionResponse.cookies.set(name, value, { ...options, ...cookieOptions }));
      },
    },
  });
  function respond(response?: NextResponse) {
    const result = response ?? sessionResponse;
    if (response) sessionResponse.cookies.getAll().forEach(cookie => result.cookies.set(cookie));
    result.headers.set("Cache-Control", "private, no-store");
    return result;
  }
  return { supabase, respond };
}

export function safeNext(value: string | null | undefined, fallback = "/session") {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(value)) return fallback;
  const target = new URL(value, "https://my-orbit.invalid");
  if (target.origin !== "https://my-orbit.invalid" || target.pathname.startsWith("/api/auth/") || target.pathname === "/login") return fallback;
  return target.pathname + target.search + target.hash;
}
