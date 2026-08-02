"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    adsbygoogle?: Record<string, never>[];
  }
}

type AdSlotProps = {
  /**
   * 서버가 판독해 내려준 값만 사용한다. 이 컴포넌트가 직접 env 를 읽으면
   * 상위 킬스위치를 우회하는 두 번째 게이트가 생긴다.
   */
  client: string | null;
  slot: string | null;
};

export function AdSlot({ client, slot }: AdSlotProps) {
  const enabled = Boolean(client && slot);

  useEffect(() => {
    if (!enabled) return;

    try {
      window.adsbygoogle = window.adsbygoogle ?? [];
      window.adsbygoogle.push({});
    } catch {
      // Ad blockers and consent tools may intentionally prevent ad rendering.
    }
  }, [enabled]);

  if (!enabled) return null;

  return (
    <aside className="ad-placement" aria-label="광고">
      <span>Advertisements</span>
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={client ?? undefined}
        data-ad-slot={slot ?? undefined}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}
