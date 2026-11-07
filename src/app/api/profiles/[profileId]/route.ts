import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { profileError, verifyProfileOwnership } from "@/lib/profiles/ownership";
import { themePresetSchema } from "@/modules/public-profile/theme";

const updateSchema = z.object({
  display_name: z.string().trim().max(120).optional(),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80).optional(),
  headline: z.string().max(160).optional(),
  bio: z.string().max(3000).optional(),
  competency_tags: z.array(z.string().trim().min(1).max(20)).max(3).optional(),
  theme_preset: themePresetSchema.optional(),
  is_published: z.boolean().optional(),
}).strict().refine(value => Object.keys(value).length > 0);

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ profileId: string }> }) {
  const { profileId } = await params;
  const access = await verifyProfileOwnership(request, profileId);
  if (!access.ok) return access.response;
  let input: unknown;
  try { input = await request.json(); } catch { return access.respond(profileError("INVALID_INPUT", "입력 내용을 확인해 주세요.", 400)); }
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return access.respond(profileError("INVALID_INPUT", "프로필 입력 내용을 확인해 주세요.", 400));
  const { data, error } = await access.supabase.from("profiles").update(parsed.data).eq("id", profileId)
    .select("id,user_id,slug,display_name,headline,bio,competency_tags,theme_preset,is_published,updated_at").maybeSingle();
  if (error) return access.respond(profileError("INVALID_INPUT", "프로필을 저장하지 못했어요. 입력 내용을 확인해 주세요.", 400));
  if (!data) return access.respond(profileError("NOT_FOUND", "프로필을 찾을 수 없습니다.", 404));
  return access.respond(NextResponse.json({ success: true, profile: data }));
}
