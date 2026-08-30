/**
 * 배포 환경이 "사용자 헤더를 주입하는 신뢰 프록시 뒤에 있다"고 명시했는지.
 *
 * oai-* 사용자 헤더는 OpenAI Sites 프록시가 주입하고 클라이언트 사본을
 * 차단해 줄 때만 사실이다. Cloudflare 직접 서빙에는 그 프록시가 없어서,
 * 같은 헤더를 아무나 붙여 관리자를 사칭할 수 있다. 그래서 헤더 신뢰는
 * 추론하지 않고 환경이 SITES_PROXY_TRUSTED="true" 로 선언한다 — 런타임
 * 플래그와 같은 규칙으로, 정확히 "true" 가 아니면 전부 불신이다.
 */
export function parseProxyTrust(value: unknown): boolean {
  return value === "true";
}
