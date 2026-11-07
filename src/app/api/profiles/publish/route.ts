import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createRequestClient } from "@/lib/supabase/request-client";

const schema = z.object({ is_published: z.boolean() }).strip();
const fields = "id,slug,is_published,updated_at";

export async function PATCH(request: NextRequest) {
  const { supabase, respond } = createRequestClient(request);
  const json = (body: unknown, status = 200) => respond(NextResponse.json(body, { status }));
  const fail = (code: string, message: string, status: number) => json({ success: false, code, message }, status);
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return fail("UNAUTHORIZED", "로그인이 필요해요.", 401);
  if (request.headers.get("origin") !== request.nextUrl.origin) return fail("FORBIDDEN", "요청 출처를 확인할 수 없어요.", 403);
  const input = schema.safeParse(await request.json().catch(() => null));
  if (!input.success) return fail("INVALID_INPUT", "공개 여부를 확인해 주세요.", 400);

  const published = input.data.is_published;
  const result = await supabase.from("profiles").update({ is_published: published })
    .eq("user_id", user.id).eq("is_published", !published).select(fields).maybeSingle();
  if (result.error?.code === "23514" && result.error.message === "incomplete_profile") {
    return fail("INCOMPLETE_PROFILE", "공개 이름, 한 줄 소개, 핵심 역량을 하나 이상 저장한 뒤 발행해 주세요.", 422);
  }
  const { data, error } = result.data || result.error ? result : await supabase.from("profiles")
    .select(fields).eq("user_id", user.id).maybeSingle();
  if (error) {
    console.error("Profile publication failed", error.code);
    return fail("INTERNAL_ERROR", "공개 상태를 변경하지 못했어요. 다시 시도해 주세요.", 500);
  }
  if (!data) return fail("PROFILE_NOT_FOUND", "저장된 프로필을 찾을 수 없어요.", 404);
  if (result.data) {
    revalidatePath("/p/" + data.slug);
    revalidatePath("/dashboard");
    revalidatePath("/builder");
    revalidatePath("/builder/preview");
  }
  return json({
    success: true,
    data: {
      profile_id: data.id,
      user_slug: data.slug,
      is_published: data.is_published,
      public_url: data.is_published ? new URL("/p/" + data.slug, request.url).href : null,
      updated_at: data.updated_at,
    },
  });
}
