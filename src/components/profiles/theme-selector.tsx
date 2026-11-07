"use client";

import { useId, useState } from "react";
import { useFeedback } from "@/components/layouts/feedback-provider";
import { PendingSpinner } from "@/components/layouts/pending-indicator";
import ProfileHeaderCard from "@/modules/public-profile/profile-header-card";
import { profileActionClass, profileTheme, themeOptions, themePresetSchema, type ThemePresetId } from "@/modules/public-profile/theme";

type Props = {
  savedTheme: string;
  fullName: string;
  avatarUrl: string | null;
  headline: string;
  tags: string[];
  bio: string;
  onSaved: (theme: ThemePresetId) => void;
};

export default function ThemeSelector({ savedTheme, fullName, avatarUrl, headline, tags, bio, onSaved }: Props) {
  const id = useId();
  const [selected, setSelected] = useState<ThemePresetId | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const notify = useFeedback();
  const theme = profileTheme(selected ?? savedTheme);

  async function save() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/profiles/me", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme_preset_id: theme.id }),
      });
      const result = await response.json();
      const stored = themePresetSchema.safeParse(result?.data?.theme_preset_id);
      if (!response.ok || !result.success || !stored.success) throw new Error(result.message ?? "테마를 저장하지 못했어요.");
      onSaved(stored.data);
      setSelected(null);
      notify("테마가 적용되었어요.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "테마를 저장하지 못했어요.");
    } finally {
      setSaving(false);
    }
  }

  return <section aria-labelledby={id} className="mt-6 space-y-4 rounded-3xl border border-stone-200 bg-white p-4 sm:p-6">
    <h2 id={id} className="text-lg font-semibold">디자인 테마</h2>
    <fieldset disabled={saving}>
      <legend className="sr-only">프로필 테마 선택</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {themeOptions.map(key => {
          const option = profileTheme(key);
          const checked = key === theme.id;
          return <label key={key} className="flex min-w-0 items-start gap-2 rounded-xl border border-stone-300 p-3 has-checked:border-stone-900 has-checked:bg-stone-50">
            <input type="radio" className="mt-1 size-4 shrink-0 accent-stone-900" name={id}
              checked={checked} onChange={() => { setSelected(key); setError(""); }} />
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{option.name}</span>
              <span className="mt-1 flex gap-1.5" aria-hidden="true">
                {[option.tokens.primary, option.tokens.accent, option.tokens.background].map(color =>
                  <span key={color} className="size-4 rounded-full border border-black/15" style={{ backgroundColor: color }} />)}
              </span>
              <span className="mt-1 block text-xs text-stone-700" style={{ fontFamily: option.tokens.font }}>{option.fontLabel}</span>
            </span>
          </label>;
        })}
      </div>
    </fieldset>
    <p className="text-sm leading-6 text-stone-700">{theme.description}</p>
    <div aria-label="테마 미리보기" data-profile-theme={theme.id} style={theme.style}
      className="mx-auto max-w-[480px] rounded-2xl bg-[var(--profile-bg)] p-2 sm:p-3">
      <ProfileHeaderCard fullName={fullName} avatarUrl={avatarUrl} professionalTitle={headline}
        competencyTags={tags} bioSummary={bio} themePresetId={theme.id} embedded
        action={<span aria-hidden="true" className={profileActionClass}>연락처 저장 (.vcf)</span>} />
    </div>
    {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
    <button type="button" disabled={saving || theme.id === savedTheme} onClick={() => void save()}
      className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-stone-900 px-4 text-sm font-semibold text-white">
      {saving && <PendingSpinner />}
      {saving ? "테마 저장 중…" : "테마 저장"}
    </button>
  </section>;
}
