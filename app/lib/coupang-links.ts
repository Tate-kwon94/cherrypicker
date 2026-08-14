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
