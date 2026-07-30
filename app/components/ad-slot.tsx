"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    adsbygoogle?: Record<string, never>[];
  }
}

type AdSlotProps = {
  slot?: string;
};

export function AdSlot({ slot }: AdSlotProps) {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

  useEffect(() => {
    if (!client || !slot) return;

    try {
      window.adsbygoogle = window.adsbygoogle ?? [];
      window.adsbygoogle.push({});
    } catch {
      // Ad blockers and consent tools may intentionally prevent ad rendering.
    }
  }, [client, slot]);

  if (!client || !slot) return null;

  return (
    <aside className="ad-placement" aria-label="광고">
      <span>Advertisements</span>
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}
