"use client";

import { useEffect, useRef } from "react";

export default function PageviewBeacon({ profileId }: { profileId: string }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    try {
      const referrer = document.referrer ? new URL(document.referrer).origin : "";
      navigator.sendBeacon?.("/api/analytics/pageview", JSON.stringify({
        profile_id: profileId,
        referrer,
        tag_id: null,
      }));
    } catch {
      // Analytics never interrupts profile viewing.
    }
  }, [profileId]);
  return null;
}
