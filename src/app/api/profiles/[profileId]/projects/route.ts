import { NextRequest, NextResponse } from "next/server";
import { profileError, verifyProfileOwnership } from "@/lib/profiles/ownership";
import { projectSchema } from "@/lib/profiles/project-schema";

export async function POST(request: NextRequest, { params }: { params: Promise<{ profileId: string }> }) {
  const { profileId } = await params;
  const access = await verifyProfileOwnership(request, profileId);
  if (!access.ok) return access.response;
  let input: unknown;
  try { input = await request.json(); } catch { return access.respond(profileError("INVALID_INPUT", "입력 내용을 확인해 주세요.", 400)); }
  const parsed = projectSchema.safeParse(input);
  if (!parsed.success) return access.respond(profileError("INVALID_INPUT", "프로젝트 입력 내용을 확인해 주세요.", 400));
  const { data, error } = await access.supabase.from("project_items").insert({ profile_id: profileId, ...parsed.data })
    .select("id,profile_id,title,description,link_url,sort_order,created_at,updated_at").single();
  if (error) return access.respond(profileError("INVALID_INPUT", "프로젝트를 저장하지 못했어요. 입력 내용을 확인해 주세요.", 400));
  return access.respond(NextResponse.json({ success: true, project: data }, { status: 201 }));
}
