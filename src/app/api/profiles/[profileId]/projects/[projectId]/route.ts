import { NextRequest, NextResponse } from "next/server";
import { profileError, verifyProfileOwnership } from "@/lib/profiles/ownership";
import { projectSchema } from "@/lib/profiles/project-schema";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const updateSchema = projectSchema.partial().refine(value => Object.keys(value).length > 0);
type Params = { params: Promise<{ profileId: string; projectId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { profileId, projectId } = await params;
  const access = await verifyProfileOwnership(request, profileId);
  if (!access.ok) return access.response;
  if (!uuidPattern.test(projectId)) return access.respond(profileError("INVALID_INPUT", "프로젝트 주소를 확인해 주세요.", 400));
  let input: unknown;
  try { input = await request.json(); } catch { return access.respond(profileError("INVALID_INPUT", "입력 내용을 확인해 주세요.", 400)); }
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return access.respond(profileError("INVALID_INPUT", "프로젝트 입력 내용을 확인해 주세요.", 400));
  const { data, error } = await access.supabase.from("project_items").update(parsed.data)
    .eq("id", projectId).eq("profile_id", profileId)
    .select("id,profile_id,title,description,link_url,sort_order,updated_at").maybeSingle();
  if (error) return access.respond(profileError("INVALID_INPUT", "프로젝트를 수정하지 못했어요.", 400));
  if (!data) return access.respond(profileError("NOT_FOUND", "프로젝트를 찾을 수 없습니다.", 404));
  return access.respond(NextResponse.json({ success: true, project: data }));
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { profileId, projectId } = await params;
  const access = await verifyProfileOwnership(request, profileId);
  if (!access.ok) return access.response;
  if (!uuidPattern.test(projectId)) return access.respond(profileError("INVALID_INPUT", "프로젝트 주소를 확인해 주세요.", 400));
  const { data, error } = await access.supabase.from("project_items").delete()
    .eq("id", projectId).eq("profile_id", profileId).select("id").maybeSingle();
  if (error) return access.respond(profileError("UNAVAILABLE", "프로젝트를 삭제하지 못했어요.", 503));
  if (!data) return access.respond(profileError("NOT_FOUND", "프로젝트를 찾을 수 없습니다.", 404));
  return access.respond(NextResponse.json({ success: true }));
}
