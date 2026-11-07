import type { Metadata } from "next";
import ProjectCardLines from "@/components/builder/project-card-lines";
import { starCardSchema } from "@/lib/builder/project-card";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getPublicProfile, webUrl } from "@/modules/public-profile/get-public-profile";
import PageviewBeacon from "@/modules/public-profile/pageview-beacon";

const themes = {
  default: "bg-stone-100 text-stone-950",
  accent: "bg-amber-100 text-amber-950",
  minimal: "bg-white text-slate-950",
};

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
  return <Suspense><PublicProfile params={params} /></Suspense>;
}

async function PublicProfile({ params }: Props) {
  const profile = await getPublicProfile((await params).user_slug);
  if (!profile) notFound();

  const name = profile.display_name?.trim() || profile.slug;
  const avatar = webUrl(profile.avatar_url, true);
  const theme = themes[profile.theme_preset as keyof typeof themes] ?? themes.default;
  return <main className={"flex-1 px-4 py-8 sm:px-6 sm:py-12 " + theme}>
    <PageviewBeacon profileId={profile.id} />
    <article className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-4 rounded-2xl border border-black/10 bg-white p-5 sm:p-7">
        <div className="flex items-center gap-4">
          {avatar
            // eslint-disable-next-line @next/next/no-img-element -- Public avatars can use user-supplied HTTPS hosts.
            ? <img src={avatar} alt="" width={64} height={64} referrerPolicy="no-referrer" className="size-16 shrink-0 rounded-full object-cover" />
            : <span aria-hidden className="grid size-16 shrink-0 place-items-center rounded-full bg-amber-100 text-xl font-semibold text-amber-950">{Array.from(name)[0]}</span>}
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-bold">{name}</h1>
            {profile.headline && <p className="mt-1 break-words text-stone-700">{profile.headline}</p>}
          </div>
        </div>
        <a href={"/api/profiles/" + profile.slug + "/vcard"} className="inline-flex min-h-11 items-center rounded-xl bg-stone-900 px-4 text-sm font-semibold text-white">
          연락처 저장 (.vcf)
        </a>
      </header>
      {profile.competency_tags.length > 0 && <section className="rounded-2xl border border-black/10 bg-white p-5">
        <h2 className="font-semibold">핵심 역량</h2>
        <ul className="mt-3 flex flex-wrap gap-2">{profile.competency_tags.slice(0, 3).map((tag, index) => <li key={index} className="max-w-full break-words rounded-full bg-amber-100 px-3 py-1 text-sm text-amber-950">{tag}</li>)}</ul>
      </section>}
      {profile.bio && <section className="rounded-2xl border border-black/10 bg-white p-5">
        <h2 className="font-semibold">자기소개</h2>
        <p className="mt-3 whitespace-pre-wrap break-words leading-7">{profile.bio}</p>
      </section>}
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
