import { NextRequest, NextResponse } from "next/server";
import { createRequestClient } from "@/lib/supabase/request-client";
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

  const raw = await request.text();
  if (raw.length > 4096) return fail(400, "INVALID_INPUT", "입력 내용이 너무 길어요.");
  const input = tagDestinationInputSchema.safeParse((() => { try { return JSON.parse(raw); } catch { return null; } })());
  if (!input.success) return fail(400, "INVALID_INPUT", "연결 대상과 공개 동의 여부를 확인해 주세요.");
  const customUrl = input.data.target_type === "custom_url" ? input.data.custom_url : null;
  if (customUrl) {
    const url = new URL(customUrl);
    if (url.origin === request.nextUrl.origin && url.pathname.startsWith("/t/")) {
      return fail(400, "INVALID_INPUT", "My Orbit 태그 주소는 연결 대상으로 지정할 수 없어요.");
    }
  }

  try {
    const { data: changed, error } = await supabase.rpc("set_nfc_destination", {
      p_tag_id: tag.data, p_target: input.data.target_type, p_custom_url: customUrl,
      p_card_id: input.data.target_type === "contact_card" ? input.data.card_id : null,
      p_alias: input.data.alias ?? null, p_acknowledged: input.data.acknowledged ?? false,
    });
    if (error && ["22023", "23514", "23503"].includes(error.code)) return fail(400, "INVALID_INPUT", "공개 프로필 또는 연락처가 있는 본인 명함인지 확인해 주세요.");
    if (error) throw new Error("NFC destination update failed", { cause: error.code });
    if (!changed) return fail(404, "TAG_NOT_FOUND", "변경할 수 있는 내 태그를 찾지 못했어요.");
    const { data, error: readError } = await supabase.from("nfc_tags").select(tagDestinationFields).eq("tag_id", tag.data).single();
    if (readError) throw new Error("NFC destination read failed", { cause: readError.code });
    return respond(NextResponse.json({ success: true, data: tagDestinationSchema.parse(data) }));
  } catch (error) {
    console.error("NFC destination update failed", error instanceof Error ? error.cause ?? error.name : "unknown");
    return fail(503, "UNAVAILABLE", "연결 대상을 바꾸지 못했어요. 잠시 후 다시 시도해 주세요.");
  }
}
