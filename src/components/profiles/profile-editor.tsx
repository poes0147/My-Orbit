"use client";

import { useState } from "react";
import Link from "next/link";

type Profile = {
  id: string;
  slug: string;
  headline: string;
  bio: string;
  theme_preset: string;
  is_published: boolean;
};

export default function ProfileEditor({ profile: initialProfile }: { profile: Profile }) {
  const [profile, setProfile] = useState(initialProfile);
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
        body: JSON.stringify({ slug: profile.slug, headline: profile.headline, bio: profile.bio, theme_preset: profile.theme_preset, is_published: profile.is_published }),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result?.error?.message ?? "저장하지 못했어요.");
        return;
      }
      setProfile(result.profile);
      setMessage("저장했어요.");
    } catch {
      setMessage("연결을 확인한 뒤 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  }

  const fieldClass = "mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-950 outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-200";
  return <section className="mx-auto w-full max-w-3xl pb-10 text-stone-950">
    <header className="mb-8">
      <p className="text-sm font-medium text-amber-800">My Orbit · 프로필</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">내 프로필 편집</h1>
      <p className="mt-2 text-sm text-stone-600">소개 문구와 공개 상태를 수정할 수 있어요.</p>
    </header>
    <form onSubmit={save} className="space-y-6 rounded-3xl border border-stone-200 bg-white p-5 sm:p-8">
      <label className="block text-sm font-medium">프로필 주소
        <input className={fieldClass} value={profile.slug} maxLength={80} pattern="[a-z0-9]+(-[a-z0-9]+)*" required onChange={event => setProfile({ ...profile, slug: event.target.value.toLowerCase() })} />
      </label>
      <label className="block text-sm font-medium">한 줄 소개
        <input className={fieldClass} value={profile.headline} maxLength={160} onChange={event => setProfile({ ...profile, headline: event.target.value })} />
      </label>
      <label className="block text-sm font-medium">자기소개
        <textarea className={`${fieldClass} min-h-44 resize-y`} value={profile.bio} maxLength={3000} onChange={event => setProfile({ ...profile, bio: event.target.value })} />
      </label>
      <label className="flex min-h-12 items-center gap-3 text-sm font-medium">
        <input type="checkbox" checked={profile.is_published} onChange={event => setProfile({ ...profile, is_published: event.target.checked })} className="size-5 accent-amber-700" />
        공개 프로필로 발행
      </label>
      {message && <p role="status" className="text-sm text-amber-900">{message}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={saving} className="min-h-12 rounded-xl bg-stone-900 px-6 text-sm font-semibold text-white disabled:opacity-50">{saving ? "저장 중…" : "변경사항 저장"}</button>
        {profile.is_published && <Link href={`/p/${profile.slug}`} className="inline-flex min-h-12 items-center rounded-xl border border-stone-300 px-5 text-sm font-medium">공개 프로필 보기</Link>}
      </div>
    </form>
  </section>;
}
