import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { registrationCodeSchema, tagIdSchema } from "@/lib/nfc/tag";
import { createRequestClient } from "@/lib/supabase/request-client";

const inputSchema = z.object({ tag_id: tagIdSchema, registration_code: registrationCodeSchema }).strict();
const resultSchema = z.object({
  result_code: z.string(),
  public_slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80).nullable(),
  mapped_at: z.string().nullable(),
});
const errors = {
  UNAUTHORIZED: [401, "로그인이 필요해요."],
  FORBIDDEN: [403, "요청 출처를 확인할 수 없어요."],
  INVALID_INPUT: [400, "태그 주소와 등록 코드 형식을 확인해 주세요."],
  INVALID_CODE: [400, "등록 코드가 맞지 않아요. 오브제와 함께 받은 코드를 확인해 주세요."],
  PROFILE_NOT_FOUND: [404, "먼저 내 프로필을 만들어 주세요."],
  PROFILE_NOT_PUBLISHED: [422, "프로필을 공개한 뒤 다시 연결해 주세요."],
  TAG_NOT_FOUND: [404, "등록되지 않은 오브제 태그예요."],
  TAG_INACTIVE: [409, "사용이 중단된 태그는 연결할 수 없어요."],
  TAG_ALREADY_MAPPED: [409, "이미 등록된 태그예요. 워크숍 운영진에게 문의해 주세요."],
  RATE_LIMITED: [429, "시도가 너무 많아요. 1분 뒤 다시 시도해 주세요."],
  UNAVAILABLE: [503, "연결 상태를 확인하지 못했어요. 잠시 후 다시 시도해 주세요."],
} as const;

export async function POST(request: NextRequest) {
  const { supabase, respond } = createRequestClient(request);
  const fail = (code: keyof typeof errors) => {
    const [status, message] = errors[code];
    return respond(NextResponse.json({ success: false, code, message }, { status }));
  };
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return fail("UNAUTHORIZED");
  if (request.headers.get("origin") !== request.nextUrl.origin) return fail("FORBIDDEN");
  if (Number(request.headers.get("content-length")) > 1024) return fail("INVALID_INPUT");
  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 1024) return fail("INVALID_INPUT");
    body = JSON.parse(raw);
  } catch {
    return fail("INVALID_INPUT");
  }
  const input = inputSchema.safeParse(body);
  if (!input.success) return fail("INVALID_INPUT");

  const forwarded = request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "local";
  const { data: rawResult, error } = await supabase.rpc("bind_nfc_tag", {
    p_tag_id: input.data.tag_id,
    p_registration_code: input.data.registration_code,
    p_ip_hash: createHash("sha256").update(ip).digest("hex"),
  }).single();
  const result = resultSchema.safeParse(rawResult);
  if (error || !result.success) {
    console.error("NFC binding failed", error?.code);
    return fail("UNAVAILABLE");
  }
  const data = result.data;
  const code = data.result_code;
  if ((code === "SUCCESS" || code === "ALREADY_BOUND") && data.mapped_at) {
    return respond(NextResponse.json({ success: true, data: {
      tag_id: input.data.tag_id,
      user_slug: data.public_slug,
      public_url: new URL("/t/" + input.data.tag_id, request.url).href,
      mapped_at: data.mapped_at,
    } }));
  }
  if (Object.hasOwn(errors, code)) return fail(code as keyof typeof errors);
  console.error("Unexpected NFC binding result");
  return fail("UNAVAILABLE");
}
