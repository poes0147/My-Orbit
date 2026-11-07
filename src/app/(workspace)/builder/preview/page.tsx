import type { Metadata } from "next";
import Link from "next/link";
import ProjectCardLines from "@/components/builder/project-card-lines";
import ProfileHeaderCard from "@/modules/public-profile/profile-header-card";
import { profileTheme } from "@/modules/public-profile/theme";
import CommitProfileAction from "@/components/builder/commit-profile-action";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { readSavedDraft } from "@/lib/builder/read-saved-draft";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "비공개 프로필 미리보기",
  robots: { index: false, follow: false },
};

const backLink = "inline-flex min-h-11 min-w-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-amber-700";

export default async function DraftPreviewPage() {
  const context = await getWorkspaceContext();
  if (context.workshopUnavailable) throw new Error("워크숍 정보를 확인하지 못했어요.");
  const supabase = await createSupabaseServerClient();
  const result = await readSavedDraft(supabase, context.id, context.workshop?.sessionId);
  if (result.status !== 200) throw new Error(result.message);
  const draft = result.draft?.current;
  const profile = draft ? await supabase.from("profiles")
    .select("id,bio,display_name,avatar_url,theme_preset,is_published,project_items(id,title,description,sort_order,is_draft_derived)")
    .eq("user_id", context.id).maybeSingle() : null;
  if (profile?.error) throw new Error("프로필을 불러오지 못했어요.");
  const projects = (profile?.data?.project_items ?? []).filter(project => !project.is_draft_derived).sort((a, b) => a.sort_order - b.sort_order);
  const theme = profileTheme(profile?.data?.theme_preset);

  return (
    <section className="mx-auto w-full max-w-[480px] break-words break-keep">
      <div className="sticky top-16 z-[5] flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 bg-white py-2">
        <Link href="/builder" className={backLink}><span aria-hidden>←</span> 편집으로 돌아가기</Link>
        <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-700">비공개 미리보기</span>
      </div>
      <p className="mt-4 text-sm leading-6 text-stone-600">이 미리보기는 본인에게만 표시됩니다.</p>
      {draft && result.draft ? (
        <article data-profile-theme={theme.id} style={theme.style} className="mt-6 space-y-4 rounded-2xl bg-[var(--profile-bg)] p-2 text-[var(--profile-text)] [font-family:var(--profile-font)] sm:p-3">
          <ProfileHeaderCard
            fullName={profile?.data?.display_name?.trim() || context.name}
            avatarUrl={profile?.data?.avatar_url ?? null}
            professionalTitle={draft.headline}
            competencyTags={draft.competency_tags}
            bioSummary={profile?.data?.bio ?? ""}
            themePresetId={profile?.data?.theme_preset}
          />
          <section className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5">
            <h2 className="font-semibold">대표 프로젝트 요약</h2>
            {draft.project_card ? <>
              <h3 className="mt-2 font-medium">{draft.project_card.title}</h3>
              <p className="mt-1 break-words text-sm text-stone-600">{draft.project_card.role}</p>
              <ProjectCardLines card={draft.project_card} />
              {draft.project_card.link_url && <a href={draft.project_card.link_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm text-amber-900 underline">프로젝트 링크 열기</a>}
            </> : <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-stone-700">{draft.project_summary}</p>}
          </section>
          {projects.map(project => (
            <section key={project.id} className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5">
              <h2 className="font-semibold">{project.title}</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-stone-700">{project.description}</p>
            </section>
          ))}
          <CommitProfileAction draftId={result.draft.id} content={draft} profile={profile?.data ? { id: profile.data.id, is_published: profile.data.is_published } : null} />
        </article>
      ) : (
        <div className="mt-8 rounded-2xl border border-stone-200 p-5">
          <h1 className="text-lg font-semibold">저장된 초안이 없습니다</h1>
          <p className="mt-2 text-sm leading-6 text-stone-600">프로필 초안을 만들어 저장하면 여기에서 볼 수 있어요.</p>
          <Link href="/builder" className={`mt-3 ${backLink}`}>프로필 작성하러 가기</Link>
        </div>
      )}
    </section>
  );
}
