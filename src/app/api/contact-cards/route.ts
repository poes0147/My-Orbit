import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createRequestClient } from "@/lib/supabase/request-client";
import { contactCardFields, contactCardInputSchema, contactCardSchema } from "@/lib/nfc/contact-card";

// All writes use owner-scoped RPCs; browser clients have SELECT-only table grants.
async function mutate(request: NextRequest, deleting: boolean) {
  const { supabase, respond } = createRequestClient(request);
  const fail = (status: number, message: string) => respond(NextResponse.json({ message }, { status }));
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return fail(401, "다시 로그인해 주세요.");
  if (request.headers.get("origin") !== request.nextUrl.origin) return fail(403, "요청 출처를 확인해 주세요.");
  try {
    const raw = await request.text();
    if (raw.length > 8192) return fail(400, "입력 내용이 너무 길어요.");
    const body = JSON.parse(raw);
    const envelope = z.object({ id: z.uuid().nullable(), data: z.unknown().optional() }).strict().safeParse(body);
    if (!envelope.success || (deleting && !envelope.data.id)) return fail(400, "명함 정보를 확인해 주세요.");
    if (deleting) {
      const { data, error } = await supabase.rpc("delete_contact_card", { p_card_id: envelope.data.id });
      if (error) return fail(503, "삭제하지 못했어요. 다시 시도해 주세요.");
      if (!data) return fail(404, "내 명함을 찾지 못했어요.");
      return respond(NextResponse.json({ success: true }));
    }
    const parsed = contactCardInputSchema.safeParse(envelope.data.data);
    if (!parsed.success) return fail(400, "명함 이름·공개 이름, 연락처와 HTTPS 주소 형식을 확인해 주세요.");
    const { data: id, error } = await supabase.rpc("save_contact_card", { p_card_id: envelope.data.id, p_data: parsed.data });
    if (error?.code === "42501") return fail(404, "내 명함을 찾지 못했어요.");
    if (error && ["22023", "23514", "23502"].includes(error.code)) return fail(400, "연결 중인 명함에는 전화번호나 이메일이 필요해요. 입력값을 확인해 주세요.");
    if (error) return fail(503, "저장하지 못했어요. 다시 시도해 주세요.");
    const result = await supabase.from("contact_cards").select(contactCardFields).eq("id", id).single();
    if (result.error) return fail(503, "저장 결과를 다시 확인해 주세요.");
    return respond(NextResponse.json({ success: true, data: contactCardSchema.parse(result.data) }));
  } catch {
    return fail(400, "명함 요청을 처리하지 못했어요. 입력 내용을 확인해 주세요.");
  }
}
export const POST = (request: NextRequest) => mutate(request, false);
export const DELETE = (request: NextRequest) => mutate(request, true);
