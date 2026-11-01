import { NextResponse, type NextRequest } from "next/server";

export function GET(_request: NextRequest, context: RouteContext<"/t/[tag_id]">) {
  return context.params.then(({ tag_id }) => {
    if (!/^[A-Za-z0-9_-]{4,64}$/.test(tag_id)) return NextResponse.redirect(new URL("/session", _request.url), 302);
    // Until tag lookup exists, route valid tags to the binding entry point.
    return NextResponse.redirect(new URL(`/t/bind?tag=${encodeURIComponent(tag_id)}`, _request.url), 302);
  });
}
