import { NextResponse, type NextRequest } from "next/server";

const securityHeaders: Record<string, string> = {
  "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  for (const [name, value] of Object.entries(securityHeaders)) response.headers.set(name, value);
  if (request.nextUrl.pathname === "/") {
    const redirect = NextResponse.redirect(new URL("/login", request.url));
    for (const [name, value] of Object.entries(securityHeaders)) redirect.headers.set(name, value);
    return redirect;
  }
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
