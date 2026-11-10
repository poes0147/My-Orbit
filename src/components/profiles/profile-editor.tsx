"use client";

import ProjectCardEditor from "@/components/builder/project-card-editor";
import { projectCardSchema } from "@/lib/builder/project-card";
import type { Json } from "@/lib/supabase/database.types";

import { useState } from "react";
import PendingIndicator from "@/components/layouts/pending-indicator";
import ProfilePublication from "./profile-publication";
import ThemeSelector from "./theme-selector";

type Profile = {
  id: string;
  slug: string;
  display_name: string | null;
  headline: string;
  bio: string;
  competency_tags: string[];
  theme_preset: string;
  is_published: boolean;
};

type RepresentativeProject = { id: string; title: string; description: string; star_card: Json | null; link_url: string | null };

function editableContent(profile: Profile) {
  return JSON.stringify([profile.slug, profile.display_name ?? "", profile.headline, profile.bio,
    profile.competency_tags.map(tag => tag.trim()).filter(Boolean)]);
}

export default function ProfileEditor({ profile: initialProfile, representativeProject, avatarUrl }: {
  profile: Profile; representativeProject?: RepresentativeProject; avatarUrl: string | null;
}) {
  const [profile, setProfile] = useState(initialProfile);
  const [savedSlug, setSavedSlug] = useState(initialProfile.slug);
  const [savedContent, setSavedContent] = useState(() => editableContent(initialProfile));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/profiles/${profile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: profile.slug, display_name: profile.display_name ?? "", headline: profile.headline, bio: profile.bio, competency_tags: profile.competency_tags.map(tag => tag.trim()).filter(Boolean) }),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result?.error?.message ?? "저장하지 못했어요.");
        return;
      }
      setProfile(previous => ({ ...result.profile, theme_preset: previous.theme_preset }));
      setSavedSlug(result.profile.slug);
      setSavedContent(editableContent(result.profile));
      setMessage(result.profile.is_published ? "저장했어요. 공개 프로필에도 반영됐어요." : "비공개로 저장했어요. 본인만 볼 수 있어요.");
    } catch {
      setMessage("연결을 확인한 뒤 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  }

  const fieldClass = "mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-950 outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-200";
  return <section className="mx-auto w-full max-w-3xl pb-10 text-stone-950">
    {saving && <PendingIndicator message="프로필 변경사항을 저장하고 있어요." overlay />}
    <header className="mb-8">
      <p className="text-sm font-medium text-amber-800">My Orbit · 프로필</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">내 프로필 편집</h1>
      <p className="mt-2 text-sm text-stone-600">소개 문구와 핵심 역량을 수정할 수 있어요.</p>
    </header>
    <ProfilePublication published={profile.is_published} slug={savedSlug} disabled={saving} hasUnsavedChanges={editableContent(profile) !== savedContent}
      onChange={(is_published, slug) => {
        setSavedSlug(slug);
        setProfile(previous => ({ ...previous, is_published }));
      }} />
    <form onSubmit={save} className="space-y-6 rounded-3xl border border-stone-200 bg-white p-5 sm:p-8">
      <fieldset disabled={saving} className="space-y-6">
      <label className="block text-sm font-medium">공개 이름
        <input className={fieldClass} value={profile.display_name ?? ""} maxLength={120}
          onChange={event => setProfile({ ...profile, display_name: event.target.value })} />
      </label>
      <label className="block text-sm font-medium">프로필 주소
        <input className={fieldClass} value={profile.slug} maxLength={80} pattern="[a-z0-9]+(-[a-z0-9]+)*" required onChange={event => setProfile({ ...profile, slug: event.target.value.toLowerCase() })} />
      </label>
      <label className="block text-sm font-medium">한 줄 소개
        <input className={fieldClass} value={profile.headline} maxLength={160} onChange={event => setProfile({ ...profile, headline: event.target.value })} />
      </label>
      <label className="block text-sm font-medium">자기소개
        <textarea className={`${fieldClass} min-h-44 resize-y`} value={profile.bio} maxLength={3000} onChange={event => setProfile({ ...profile, bio: event.target.value })} />
      </label>
      <fieldset>
        <legend className="text-sm font-medium">핵심 역량</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {[0, 1, 2].map(index => <input key={index} aria-label={`핵심 역량 ${index + 1}`} className={fieldClass}
            value={profile.competency_tags[index] ?? ""} maxLength={20}
            onChange={event => {
              const tags = [0, 1, 2].map(position => position === index ? event.target.value : profile.competency_tags[position] ?? "");
              setProfile({ ...profile, competency_tags: tags });
            }} />)}
        </div>
      </fieldset>
      {message && <p role="status" className="text-sm text-amber-900">{message}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={saving} className="min-h-12 rounded-xl bg-stone-900 px-6 text-sm font-semibold text-white disabled:opacity-50">{saving ? "저장 중…" : "변경사항 저장"}</button>
      </div>
      </fieldset>
    </form>
    <ThemeSelector savedTheme={profile.theme_preset} fullName={profile.display_name?.trim() || profile.slug}
      avatarUrl={avatarUrl} headline={profile.headline} tags={profile.competency_tags} bio={profile.bio}
      onSaved={theme_preset => setProfile(previous => ({ ...previous, theme_preset }))} />
    {representativeProject && <RepresentativeProjectEditor profileId={profile.id} project={representativeProject} />}
  </section>;
}

function RepresentativeProjectEditor({ profileId, project }: { profileId: string; project: RepresentativeProject }) {
  const [description, setDescription] = useState(project.description);
  const [card, setCard] = useState(() => {
    if (!project.star_card || typeof project.star_card !== "object" || Array.isArray(project.star_card)) return undefined;
    const parsed = projectCardSchema.safeParse({ ...project.star_card, title: project.title, link_url: project.link_url });
    return parsed.success ? parsed.data : undefined;
  });
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (card && !projectCardSchema.safeParse(card).success) {
      setMessage("카드의 세 문장과 링크를 확인해 주세요.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/profiles/${profileId}/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(card ? {
          star_card: { role: card.role, context_line: card.context_line, action_line: card.action_line, result_line: card.result_line },
          description: [card.context_line, card.action_line, card.result_line].join("\n"),
          link_url: card.link_url,
        } : { description }),
      });
      if (!response.ok) throw new Error("대표 프로젝트를 저장하지 못했어요.");
      setMessage("대표 프로젝트를 저장했어요.");
    } catch {
      setMessage("대표 프로젝트를 저장하지 못했어요. 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="mt-6 space-y-3 rounded-2xl border border-stone-200 p-5">
      {saving && <PendingIndicator message="대표 프로젝트를 저장하고 있어요." overlay />}
      <h2 className="text-lg font-semibold">{project.title}</h2>
      {card ? <ProjectCardEditor card={card} disabled={saving} onChange={setCard} /> : <label className="block text-sm font-medium">대표 프로젝트 요약
        <textarea value={description} onChange={event => setDescription(event.target.value)} maxLength={3000} rows={5}
          className="mt-2 w-full rounded-xl border border-stone-300 px-4 py-3" />
      </label>}
      <button type="submit" disabled={saving} className="min-h-11 rounded-xl bg-stone-900 px-4 text-sm font-semibold text-white disabled:opacity-60">
        {saving ? "저장 중…" : "대표 프로젝트 저장"}
      </button>
      {message && <p role="status" className="text-sm">{message}</p>}
    </form>
  );
}
