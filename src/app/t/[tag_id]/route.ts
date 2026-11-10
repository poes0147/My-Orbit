import { resolveTag } from "@/lib/nfc/resolve-tag";
import { tagBindingPath, tagIdSchema } from "@/lib/nfc/tag";

const noStore = { "Cache-Control": "no-store, no-cache, must-revalidate", Pragma: "no-cache" };

// Copy comes from the fixed messages below. Never render tag IDs or profile data in the fallback.
function notice(title: string, message: string, status = 200) {
  return new Response(`<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>${title} · My Orbit</title>
<style>body{margin:0;background:#fafaf9;color:#1c1917;font:1rem/1.6 system-ui,sans-serif}
main{box-sizing:border-box;max-width:32rem;margin:12vh auto;padding:1.5rem;word-break:keep-all}
h1{font-size:1.6rem;line-height:1.3}small{color:#92400e;font-weight:600}</style></head>
<body><main><small>My Orbit · 나의 별</small><h1>${title}</h1><p>${message}</p></main></body></html>`, {
    status, headers: { ...noStore, "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function GET(request: Request, { params }: { params: Promise<{ tag_id: string }> }) {
  const parsed = tagIdSchema.safeParse((await params).tag_id);
  if (!parsed.success) return notice("유효하지 않은 태그예요", "오브제에 적힌 QR 주소를 확인해 주세요.", 404);
  const redirectTo = (location: string, status = 302) => new Response(null, { status, headers: { ...noStore, Location: location } });
  const unavailable = "/t/" + parsed.data + "/unavailable";
  try {
    const tag = await resolveTag(parsed.data);
    if (!tag) return redirectTo(unavailable + "?reason=invalid");
    switch (tag.tag_status) {
      case "published": return redirectTo("/p/" + tag.public_slug);
      case "contact": return redirectTo("/t/" + parsed.data + "/contact");
      case "paused": return redirectTo(unavailable + "?reason=paused");
      case "external": {
        const url = new URL(tag.external_url);
        if (url.origin === new URL(request.url).origin && url.pathname.startsWith("/t/")) return redirectTo(unavailable + "?reason=invalid");
        return redirectTo(url.href);
      }
      case "unbound": return redirectTo(tagBindingPath(parsed.data), 307);
      case "inactive": return redirectTo(unavailable + "?reason=invalid");
      case "unavailable": return redirectTo(unavailable + "?reason=private");
    }
  } catch (error) {
    console.error("NFC route resolution failed", error instanceof Error ? error.name : "unknown");
    return notice("태그를 확인하지 못했어요", "잠시 후 다시 태깅하거나 QR을 스캔해 주세요.", 503);
  }
}
