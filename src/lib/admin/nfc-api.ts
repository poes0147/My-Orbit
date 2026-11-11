import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createRequestClient } from "@/lib/supabase/request-client";

const pageSchema = z.coerce.number().int().min(1).max(1_000_000);
const limitSchema = z.coerce.number().int().min(1).max(100);
const rowSchema = z.object({ tag_id: z.string().regex(/^[A-Za-z0-9]{4,32}$/), created_at: z.string(),
  is_active: z.boolean(), is_registered: z.boolean(), registered_at: z.string().nullable(), total_count: z.coerce.number() });
const issueSchema = z.object({ tag_id: z.string().regex(/^[A-Za-z0-9]{4,32}$/), registration_code: z.string().regex(/^[a-f0-9]{32}$/).nullable(), created_at: z.string() });

export async function manageAdminNfc(request: NextRequest, action: "list" | "issue") {
  const { supabase, respond } = createRequestClient(request);
  const reply = (body: unknown, status = 200) => respond(NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } }));
  const fail = (message: string, status: number) => reply({ success: false, error: { message } }, status);
  try {
    if (action === "issue" && request.headers.get("origin") !== request.nextUrl.origin) return fail("요청을 확인할 수 없어요. 새로고침 후 다시 시도해 주세요.", 403);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!user || authError) return fail("로그인이 필요합니다.", 401);
    const { data: actor, error: roleError } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
    if (roleError) return fail("관리자 권한을 확인하지 못했어요.", 503);
    if (actor?.role !== "admin") return fail("관리자 권한이 필요합니다.", 403);
    const origin = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const links = (id: string) => ({ fixedUrl: new URL(`/t/${id}`, origin).href, bindUrl: new URL(`/tags/bind/${id}`, origin).href });
    if (action === "list") {
      const page = pageSchema.safeParse(request.nextUrl.searchParams.get("page") ?? 1);
      const limit = limitSchema.safeParse(request.nextUrl.searchParams.get("limit") ?? 20);
      if (!page.success || !limit.success) return fail("목록 페이지를 확인해 주세요.", 400);
      const { data, error } = await supabase.rpc("admin_list_nfc_tags", { p_page: page.data, p_limit: limit.data });
      if (error) return fail("태그 목록을 불러오지 못했어요. 다시 시도해 주세요.", error.code === "42501" ? 403 : 503);
      const parsed = z.array(rowSchema).parse(data);
      return reply({ success: true, data: { tags: parsed.map(row => ({ tagId: row.tag_id, ...links(row.tag_id), isActive: row.is_active,
        isRegistered: row.is_registered, createdAt: row.created_at, registeredAt: row.registered_at })),
        pagination: { page: page.data, limit: limit.data, total: parsed[0]?.total_count ?? 0 } } });
    }
    const key = z.uuid().safeParse(request.headers.get("idempotency-key"));
    if (!key.success) return fail("발급 요청을 확인할 수 없어요. 화면을 새로 열어 주세요.", 400);
    const { data, error } = await supabase.rpc("admin_issue_nfc_tag", { p_request_id: key.data });
    if (error) return fail("발급 결과를 확인하지 못했어요. 같은 요청으로 다시 확인해 주세요.", error.code === "42501" ? 403 : 503);
    const row = issueSchema.parse(data?.[0]);
    return reply({ success: true, data: { tagId: row.tag_id, ...links(row.tag_id), registrationCode: row.registration_code,
      createdAt: row.created_at, replayed: row.registration_code === null } }, row.registration_code ? 201 : 200);
  } catch {
    console.error("admin_nfc_request_failed", { action });
    return fail("처리 결과를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.", 503);
  }
}
