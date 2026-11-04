import { NextRequest, NextResponse } from "next/server";
import { createRequestClient } from "@/lib/supabase/request-client";
import { withCodeRetry } from "./code";

const fields = "id,session_code,title,organization_name,status,max_capacity,expires_at,created_at";

export async function manageWorkshops(request: NextRequest, action: "list" | "create" | "status", id?: string) {
  const { supabase, respond } = createRequestClient(request);
  const reply = (body: unknown, status = 200) => respond(NextResponse.json(body, { status }));
  const fail = (message: string, status: number) => reply({ success: false, error: { message } }, status);
  try {
    if (action !== "list" && request.headers.get("origin") !== request.nextUrl.origin) return fail("요청을 확인할 수 없습니다. 새로고침 후 다시 시도해 주세요.", 403);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return fail("로그인이 필요합니다.", 401);
    const { data: profile, error: roleError } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
    if (roleError) return fail("관리자 권한을 확인하지 못했어요.", 503);
    if (profile?.role !== "admin") return fail("관리자 권한이 필요합니다.", 403);

    if (action === "list") {
      const { data, error } = await supabase.from("workshop_sessions").select(fields).order("created_at", { ascending: false });
      return error ? fail("워크숍 목록을 불러오지 못했어요. 다시 시도해 주세요.", 503) : reply({ success: true, sessions: data });
    }
    let body: Record<string, unknown>;
    try {
      const value = await request.json();
      if (!value || typeof value !== "object" || Array.isArray(value)) return fail("입력 내용을 확인해 주세요.", 400);
      body = value;
    } catch { return fail("입력 내용을 확인해 주세요.", 400); }

    if (action === "create") {
      const title = typeof body.title === "string" ? body.title.trim() : "";
      const organizationInput = body.organization ?? body.organization_name;
      const organization = typeof organizationInput === "string" ? organizationInput.trim() : "";
      const duration = body.durationHours ?? 24;
      const capacity = body.maxCapacity ?? body.max_capacity ?? 35;
      if (!title || title.length > 100 || !organization || organization.length > 100) return fail("워크숍 이름과 기관명을 1~100자로 입력해 주세요.", 400);
      if (typeof duration !== "number" || !Number.isInteger(duration) || duration < 1 || duration > 168) return fail("참여 가능 시간은 1~168시간으로 입력해 주세요.", 400);
      if (typeof capacity !== "number" || !Number.isInteger(capacity) || capacity < 1 || capacity > 500) return fail("정원은 1~500명으로 입력해 주세요.", 400);
      const expiresAt = body.expires_at === undefined ? Date.now() + duration * 3600000 : typeof body.expires_at === "string" ? Date.parse(body.expires_at) : NaN;
      if (!Number.isFinite(expiresAt) || expiresAt <= Date.now() || expiresAt > Date.now() + 168 * 3600000) return fail("만료 일시는 현재부터 7일 이내로 지정해 주세요.", 400);
      const result = await withCodeRetry(async (code) => {
        const { data, error } = await supabase.from("workshop_sessions").insert({
          title, organization_name: organization, max_capacity: capacity, session_code: code,
          created_by: user.id, expires_at: new Date(expiresAt).toISOString(),
        }).select(fields).single();
        return { data, error };
      });
      return result.error ? fail("세션을 만들지 못했어요. 잠시 후 다시 시도해 주세요.", 503) : reply({ success: true, session: result.data }, 201);
    }
    if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return fail("세션 주소를 확인해 주세요.", 400);
    if (body.status !== "closed" && body.status !== "COMPLETED") return fail("참여 종료 요청만 지원합니다.", 400);
    const { data: existing, error: readError } = await supabase.from("workshop_sessions").select("id,expires_at").eq("id", id).maybeSingle();
    if (readError) return fail("세션을 확인하지 못했어요.", 503);
    if (!existing) return fail("세션을 찾을 수 없습니다.", 404);
    const { data, error } = await supabase.from("workshop_sessions").update({ status: "COMPLETED" }).eq("id", id).select(fields).maybeSingle();
    return error || !data ? fail("상태를 변경하지 못했어요. 목록을 새로고침해 주세요.", 409) : reply({ success: true, session: data });
  } catch { return fail("연결이 원활하지 않아요. 잠시 후 다시 시도해 주세요.", 503); }
}
