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

export async function GET(_request: Request, { params }: { params: Promise<{ tag_id: string }> }) {
  const parsed = tagIdSchema.safeParse((await params).tag_id);
  if (!parsed.success) return notice("유효하지 않은 태그예요", "오브제에 적힌 QR 주소를 확인해 주세요.", 404);
  try {
    const tag = await resolveTag(parsed.data);
    if (!tag) return notice("등록되지 않은 태그예요", "오브제에 적힌 QR 주소를 확인해 주세요.", 404);
    switch (tag.tag_status) {
      case "published": return new Response(null, { status: 302, headers: { ...noStore, Location: "/p/" + tag.public_slug } });
      case "unbound": return new Response(null, { status: 307, headers: { ...noStore, Location: tagBindingPath(parsed.data) } });
      case "inactive": return notice("연결이 중단됐어요", "현재 사용할 수 없는 오브제 태그예요.");
      case "unavailable": return notice("공개 프로필을 볼 수 없어요", "오브제 소유자가 프로필을 공개하면 이 링크에서 볼 수 있어요.");
    }
  } catch (error) {
    console.error("NFC route resolution failed", error instanceof Error ? error.name : "unknown");
    return notice("태그를 확인하지 못했어요", "잠시 후 다시 태깅하거나 QR을 스캔해 주세요.", 503);
  }
}
