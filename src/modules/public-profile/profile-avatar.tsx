"use client";

import Image from "next/image";
import { useState } from "react";

export default function ProfileAvatar({ source, initials, name }: {
  source: { url: string; optimized: boolean } | null;
  initials: string;
  name: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string>();
  const showImage = source && failedUrl !== source.url;
  return <div className="mx-auto grid size-[88px] shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--profile-accent)] text-xl font-semibold text-[var(--profile-text)] sm:size-[104px]">
    {showImage ? <Image
      src={source.url} alt={name + "의 대표 프로필 사진"}
      width={104} height={104}
      sizes="(min-width: 640px) 104px, 88px"
      preload unoptimized={!source.optimized}
      referrerPolicy="no-referrer"
      onError={() => setFailedUrl(source.url)}
      className="size-full object-cover"
    /> : <span aria-hidden="true" data-profile-avatar-fallback>{initials}</span>}
  </div>;
}
