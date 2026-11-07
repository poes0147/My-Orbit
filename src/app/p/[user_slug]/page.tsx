import type { Metadata } from "next";
import ProjectCardLines from "@/components/builder/project-card-lines";
import { starCardSchema } from "@/lib/builder/project-card";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getPublicProfile, webUrl } from "@/modules/public-profile/get-public-profile";
import PageviewBeacon from "@/modules/public-profile/pageview-beacon";
import ProfileHeaderCard, { ProfileHeaderSkeleton } from "@/modules/public-profile/profile-header-card";
import { profileActionClass, profileTheme } from "@/modules/public-profile/theme";

type Props = { params: Promise<{ user_slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const profile = await getPublicProfile((await params).user_slug);
  if (!profile) return { title: "프로필을 찾을 수 없어요", robots: { index: false } };
  const name = profile.display_name?.trim() || profile.slug;
  const title = profile.headline ? name + " · " + profile.headline : name;
  const description = (profile.bio.trim() || profile.headline || name + "의 My Orbit 프로필").slice(0, 160);
  const image = webUrl(profile.avatar_url, true);
  return {
    title,
    description,
    openGraph: { type: "profile", title, description, images: image ? [image] : undefined },
    twitter: { card: "summary", title, description, images: image ? [image] : undefined },
  };
}

export default function PublicProfilePage({ params }: Props) {
  return <Suspense fallback={<ProfileHeaderSkeleton />}><PublicProfile params={params} /></Suspense>;
}

async function PublicProfile({ params }: Props) {
  const profile = await getPublicProfile((await params).user_slug);
  if (!profile) notFound();

  const theme = profileTheme(profile.theme_preset);
  return <main data-profile-theme={theme.id} style={theme.style} className="flex-1 bg-[var(--profile-bg)] px-4 py-8 text-[var(--profile-text)] [font-family:var(--profile-font)] sm:py-12">
    <PageviewBeacon profileId={profile.id} />
    <article className="mx-auto w-full max-w-[480px] space-y-6">
      <ProfileHeaderCard
        fullName={profile.display_name?.trim() || profile.slug}
        avatarUrl={profile.avatar_url}
        professionalTitle={profile.headline}
        competencyTags={profile.competency_tags}
        bioSummary={profile.bio}
        themePresetId={profile.theme_preset}
        action={<a href={"/api/profiles/" + profile.slug + "/vcard"} className={profileActionClass}>
          연락처 저장 (.vcf)
        </a>}
      />
      {profile.project_items.length > 0 && <section className="space-y-3">
        <h2 className="font-semibold">대표 프로젝트</h2>
        {profile.project_items.map(project => {
          const url = webUrl(project.link_url);
          const card = starCardSchema.safeParse(project.star_card);
          return <article key={project.id} className="rounded-2xl border border-black/10 bg-white p-5">
            <h3 className="break-words font-semibold">{project.title}</h3>
            {card.success ? <>
              <p className="mt-1 break-words text-sm text-stone-600">{card.data.role}</p>
              <ProjectCardLines card={card.data} />
            </> : project.description && <p className="mt-2 whitespace-pre-wrap break-words leading-7">{project.description}</p>}
            {url && <a href={url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-11 items-center font-semibold text-amber-900 underline">프로젝트 링크 열기</a>}
          </article>;
        })}
      </section>}
    </article>
  </main>;
}
