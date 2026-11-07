import Link from "next/link";
import { io } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import ProfileEditor from "@/components/profiles/profile-editor";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default function EditProfilePage({ params }: { params: Promise<{ profileId: string }> }) {
  return (
    <Suspense fallback={<p role="status">프로필을 불러오고 있어요.</p>}>
      <EditableProfile params={params} />
    </Suspense>
  );
}

async function EditableProfile({ params }: { params: Promise<{ profileId: string }> }) {
  const { profileId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(profileId)) notFound();
  await io();
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: status, error: statusError } = await supabase.rpc("profile_owner_status", { p_profile_id: profileId });
  if (statusError) throw new Error("프로필 권한을 확인하지 못했습니다.");
  if (status === "not_found") notFound();
  if (status !== "owner") {
    const { data: publicProfile } = await supabase.from("profiles").select("slug").eq("id", profileId).eq("is_published", true).maybeSingle();
    return <section className="mx-auto max-w-2xl rounded-3xl border border-amber-200 bg-amber-50 p-6 text-stone-900">
      <h1 className="text-2xl font-semibold">편집 권한이 없어요</h1>
      <p className="mt-2 text-sm leading-6">이 프로필은 작성자 본인만 수정할 수 있습니다.</p>
      <Link href={publicProfile ? `/p/${publicProfile.slug}` : "/dashboard"} className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-stone-900 px-5 text-sm font-semibold text-white">
        {publicProfile ? "공개 프로필 보기" : "대시보드로 이동"}
      </Link>
    </section>;
  }

  const { data: profile, error } = await supabase.from("profiles")
    .select("id,slug,headline,bio,competency_tags,theme_preset,is_published,display_name,avatar_url,project_items(id,title,description,is_draft_derived,star_card,link_url)")
    .eq("id", profileId).eq("user_id", user.id).maybeSingle();
  if (error) throw new Error("프로필을 불러오지 못했습니다.");
  if (!profile) notFound();
  const { project_items, avatar_url, ...editableProfile } = profile;
  return <ProfileEditor profile={editableProfile} avatarUrl={avatar_url}
    representativeProject={project_items.find(project => project.is_draft_derived)} />;
}
