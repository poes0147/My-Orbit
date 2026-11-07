import type { ReactNode } from "react";
import { profileAvatarSource } from "./avatar-source";
import ProfileAvatar from "./profile-avatar";
import { profileTheme } from "./theme";

type Props = {
  fullName: string;
  avatarUrl: string | null;
  professionalTitle: string;
  competencyTags: string[];
  bioSummary: string;
  themePresetId?: string | null;
  action?: ReactNode;
  embedded?: boolean;
};

export default function ProfileHeaderCard({
  fullName, avatarUrl, professionalTitle, competencyTags, bioSummary, themePresetId, action, embedded = false,
}: Props) {
  const theme = profileTheme(themePresetId);
  const name = fullName.trim() || "My Orbit";
  const initials = Array.from(name.replace(/\s/g, "")).slice(0, 2).join("");
  const tags = Array.isArray(competencyTags) ? competencyTags.slice(0, 3) : [];
  const NameHeading = embedded ? "h3" : "h1";
  const DetailHeading = embedded ? "h4" : "h2";

  return <header aria-label="프로필 소개" style={theme.style} className="min-w-0 rounded-2xl border border-[var(--profile-border)] bg-[var(--profile-surface)] p-4 text-[var(--profile-text)] [font-family:var(--profile-font)] sm:p-6">
    <div className="space-y-3 text-center">
      <ProfileAvatar source={profileAvatarSource(avatarUrl, process.env.NEXT_PUBLIC_SUPABASE_URL)}
        initials={initials} name={name} />
      <NameHeading className="text-2xl font-bold leading-tight [overflow-wrap:anywhere]">{name}</NameHeading>
      {professionalTitle.trim() && <DetailHeading className="line-clamp-2 text-base font-medium leading-6 text-[var(--profile-muted)] [overflow-wrap:anywhere]">{professionalTitle}</DetailHeading>}
      {tags.length > 0 && <ul aria-label="핵심 역량" className="flex flex-wrap justify-center gap-2">
        {tags.map((tag, index) => <li key={index} className="min-w-0 max-w-full rounded-full bg-[var(--profile-accent)] px-3 py-1 text-sm font-medium text-[var(--profile-text)] [overflow-wrap:anywhere]">{tag}</li>)}
      </ul>}
      {action}
    </div>
    {bioSummary.trim() && <section aria-label="자기소개" className="mt-5 rounded-xl bg-[var(--profile-bg)] p-4">
      <DetailHeading className="text-sm font-semibold">자기소개</DetailHeading>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[var(--profile-muted)] [overflow-wrap:anywhere]">{bioSummary}</p>
    </section>}
  </header>;
}

export function ProfileHeaderSkeleton() {
  return <div role="status" className="mx-auto mt-8 w-[calc(100%-2rem)] max-w-[480px] rounded-2xl border border-stone-200 bg-white p-5 sm:mt-12">
    <span className="sr-only">프로필을 불러오고 있어요.</span>
    <div aria-hidden="true" className="space-y-3 motion-safe:animate-pulse">
      <div className="mx-auto size-[88px] rounded-full bg-stone-200 sm:size-[104px]" />
      <div className="mx-auto h-6 w-32 rounded bg-stone-200" />
      <div className="mx-auto h-4 w-2/3 rounded bg-stone-100" />
    </div>
  </div>;
}
