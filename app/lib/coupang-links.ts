/**
 * 쿠팡 파트너스 간편 링크.
 *
 * 파트너스 콘솔(간편 링크 만들기)에서 생성한 URL을 **이 파일에만** 붙여
 * 넣는다. 렌더 지점은 이 표를 읽으므로 다른 파일은 고칠 필요가 없다.
 *
 * 반드시 간편 링크(`https://link.coupang.com/...`)여야 한다. 쿠팡 페이지
 * URL을 그대로 붙여 넣으면 링크는 멀쩡히 동작하지만 **수익이 집계되지
 * 않는다** — 파트너스 가이드가 명시한 함정이고, 테스트가 형식을 검사해
 * 잘못 붙여 넣는 순간 실패한다.
 */

export const COUPANG_PARTNER_LINK_PREFIX = "https://link.coupang.com/";

/**
 * 화장품 상품별 간편 링크. 키는 화면 카탈로그의 상품 id.
 *
 * 비워 두면 그 상품은 중립 검색 링크로 렌더된다 — 값이 없다고 화면이
 * 깨지지는 않는다.
 */
export const cosmeticPartnerUrls: Record<string, string> = {
  // BEGIN GENERATED cosmetics — build/sync-coupang-links.mjs 가 이 블록을
  // 다시 쓴다. 손으로 채워도 되고, API 키가 나오면 스크립트가 대신한다.
  // anr: "https://link.coupang.com/a/XXXXXX",
  // END GENERATED cosmetics
};

/** 여행 준비물 간편 링크. 키는 항목 이름. */
export const travelPartnerUrls: Record<string, string> = {
  // BEGIN GENERATED travel
  // "휴대용 멀티 충전기": "https://link.coupang.com/a/XXXXXX",
  // END GENERATED travel
};

/**
 * 운영자가 공유하는 상품 링크.
 *
 * 비교 카탈로그와 무관한 상품이므로 **가격 필드가 없다** — 검수하지 않은
 * 가격을 실을 수 없고, 가격이 없으면 비교 화면으로 새어 들어갈 수도 없다.
 * 화면에는 상품명과 링크만 나가고, 가격·구성 확인은 판매 페이지 몫이다.
 *
 * 수익화 플래그가 꺼져 있으면 이 목록 전체가 렌더되지 않는다.
 */
export type SharedCoupangPick = {
  /** 안정 키. 렌더 key 로만 쓴다. */
  id: string;
  name: string;
  url: string;
};

export const sharedCoupangPicks: SharedCoupangPick[] = [
  // 상품명은 운영자 제공 값 — 링크가 실제로 그 상품인지는 링크를 열어
  // 확인한다 (상품 ID 는 리다이렉트로 대조 완료).
  {
    id: "lrp-cicaplast-b5-2",
    name: "라로슈포제 시카플라스트 밤 B5+ 100ml 2개",
    url: "https://link.coupang.com/a/gcFOexqpye",
  },
  {
    // 같은 상품의 다른 리스팅으로 링크를 갱신했다 (6704084257 → 8217501367).
    // 이전 링크(gcGLfm9JPo)도 개인 공유용으로는 계속 유효하다.
    id: "lrp-hyalu-b5-serum",
    name: "라로슈포제 히알루 B5 수분탄력 세럼 30ml (+화장솜 30매)",
    url: "https://link.coupang.com/a/gcKRQizwM8",
  },
  {
    id: "drg-ph-cleansing-gel",
    name: "닥터지 약산성 클렌징 젤 폼 200ml",
    url: "https://link.coupang.com/a/gcKHRZC9S0",
  },
  {
    id: "roundlab-dokdo-toner",
    name: "라운드랩 독도 토너 500ml",
    url: "https://link.coupang.com/a/gcKKJWHIGG",
  },
  {
    id: "senka-whip-cica-2",
    name: "센카 퍼펙트 휩 로우 pH 카밍 시카 클렌징 폼 100g 2개",
    url: "https://link.coupang.com/a/gcKPLxrmjA",
  },
];

export function isCoupangPartnerUrl(url: string): boolean {
  return url.startsWith(COUPANG_PARTNER_LINK_PREFIX);
}

export type ResolvedCoupangLink = {
  href: string;
  /** 실제로 파트너스 링크를 쓸 때만 true. `rel="sponsored"` 의 근거다. */
  sponsored: boolean;
};

/**
 * 렌더할 쿠팡 링크를 정한다.
 *
 * 파트너스 링크는 **플래그가 켜져 있고 링크가 등록돼 있을 때만** 쓴다.
 * 플래그를 끄면 간편 링크가 등록돼 있어도 중립 검색 링크로 돌아간다 —
 * 수익화를 끈다는 것은 링크의 수익 귀속도 끊긴다는 뜻이어야 한다.
 *
 * `sponsored` 는 실제 링크 종류를 따른다. 중립 검색 링크에는 수익 귀속이
 * 없으므로, 플래그가 켜져 있어도 sponsored 를 붙이지 않는다.
 */
export function resolveCoupangLink({
  partnerUrl,
  fallbackUrl,
  partnersActive,
}: {
  partnerUrl: string | undefined;
  fallbackUrl: string;
  partnersActive: boolean;
}): ResolvedCoupangLink {
  if (partnersActive && partnerUrl && isCoupangPartnerUrl(partnerUrl)) {
    return { href: partnerUrl, sponsored: true };
  }
  return { href: fallbackUrl, sponsored: false };
}
