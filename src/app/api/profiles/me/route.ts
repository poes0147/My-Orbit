import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createRequestClient } from "@/lib/supabase/request-client";
import { themePresetSchema } from "@/modules/public-profile/theme";

const requestSchema = z.object({ theme_preset_id: themePresetSchema }).strict();

export async function PATCH(request: NextRequest) {
  const { supabase, respond } = createRequestClient(request);
  const json = (body: unknown, status = 200) => respond(NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } }));
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return json({ error: "UNAUTHORIZED", message: "로그인이 필요해요." }, 401);
  if (request.headers.get("origin") !== request.nextUrl.origin) return json({ error: "FORBIDDEN", message: "요청 출처를 확인할 수 없어요." }, 403);
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "INVALID_THEME_ID", message: "지원하지 않는 테마 프리셋입니다." }, 400);

  const { data, error } = await supabase.from("profiles").update({ theme_preset: parsed.data.theme_preset_id })
    .eq("user_id", user.id).select("id,slug,theme_preset,updated_at").maybeSingle();
  if (error) return json({ error: "UNAVAILABLE", message: "테마를 저장하지 못했어요." }, 503);
  if (!data) return json({ error: "NOT_FOUND", message: "저장된 프로필을 찾을 수 없어요." }, 404);
  return json({ success: true, data: { id: data.id, user_slug: data.slug, theme_preset_id: data.theme_preset, updated_at: data.updated_at } });
}
