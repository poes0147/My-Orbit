import { NextRequest, NextResponse } from "next/server";
import { createRequestClient } from "@/lib/supabase/request-client";
import { resolveTag } from "@/lib/nfc/resolve-tag";
import { tagDestinationFields, tagDestinationInputSchema, tagDestinationSchema } from "@/lib/nfc/destination";
import { tagIdSchema } from "@/lib/nfc/tag";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ tagId: string }> }) {
  const { supabase, respond } = createRequestClient(request);
  const fail = (status: number, code: string, message: string) =>
    respond(NextResponse.json({ success: false, code, message }, { status }));

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return fail(401, "UNAUTHORIZED", "로그인이 필요해요.");
  if (request.headers.get("origin") !== request.nextUrl.origin) return fail(403, "FORBIDDEN", "요청 출처를 확인할 수 없어요.");
  const tag = tagIdSchema.safeParse((await params).tagId);
  if (!tag.success) return fail(404, "TAG_NOT_FOUND", "사용할 수 있는 태그를 찾지 못했어요.");

  const input = tagDestinationInputSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return fail(400, "INVALID_INPUT", "보안을 위해 공개 HTTPS 링크만 등록할 수 있어요.");
  const customUrl = input.data.custom_url ?? null;
  if (customUrl) {
    const url = new URL(customUrl);
    if (url.origin === request.nextUrl.origin && url.pathname.startsWith("/t/")) {
      return fail(400, "INVALID_INPUT", "My Orbit 태그 주소는 연결 대상으로 지정할 수 없어요.");
    }
  }

  try {
    // The authenticated client can update only these columns on an active tag it owns, enforced by RLS.
    const { data, error } = await supabase.from("nfc_tags")
      .update({ target_type: input.data.target_type, custom_url: customUrl })
      .eq("tag_id", tag.data).eq("is_active", true).select(tagDestinationFields).maybeSingle();
    if (error) throw new Error("NFC destination update failed", { cause: error.code });
    if (!data) {
      const visible = await resolveTag(tag.data);
      if (!visible || visible.tag_status === "inactive") return fail(404, "TAG_NOT_FOUND", "사용할 수 있는 태그를 찾지 못했어요.");
      return fail(403, "FORBIDDEN", "이 태그를 수정할 권한이 없어요.");
    }
    return respond(NextResponse.json({ success: true, data: tagDestinationSchema.parse(data) }));
  } catch (error) {
    console.error("NFC destination update failed", error instanceof Error ? error.cause ?? error.name : "unknown");
    return fail(503, "UNAVAILABLE", "연결 대상을 바꾸지 못했어요. 잠시 후 다시 시도해 주세요.");
  }
}
