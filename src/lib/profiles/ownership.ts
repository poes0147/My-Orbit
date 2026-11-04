import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { createRequestClient } from "@/lib/supabase/request-client";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function profileError(code: "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "INVALID_INPUT" | "UNAVAILABLE", message: string, status: number) {
  return NextResponse.json({ success: false, error: { code, message } }, { status });
}

export async function verifyProfileOwnership(request: NextRequest, profileId: string) {
  const { supabase, respond } = createRequestClient(request);
  const reject = (code: Parameters<typeof profileError>[0], message: string, status: number) => ({ ok: false as const, response: respond(profileError(code, message, status)) });
  if (request.headers.get("origin") !== request.nextUrl.origin) return reject("FORBIDDEN", "요청 출처를 확인할 수 없습니다.", 403);
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return reject("UNAUTHORIZED", "로그인이 필요합니다.", 401);
  if (!uuidPattern.test(profileId)) return reject("INVALID_INPUT", "프로필 주소를 확인해 주세요.", 400);

  // RLS hides other owners' rows, so this narrow RPC reports only status, not profile data.
  const { data, error } = await supabase.rpc("profile_owner_status", { p_profile_id: profileId });
  if (error) return reject("UNAVAILABLE", "프로필 권한을 확인하지 못했어요.", 503);
  if (data === "not_found") return reject("NOT_FOUND", "프로필을 찾을 수 없습니다.", 404);
  if (data !== "owner") return reject("FORBIDDEN", "이 프로필을 수정할 권한이 없습니다.", 403);
  return { ok: true as const, supabase, respond, userId: user.id };
}
