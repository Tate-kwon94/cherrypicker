/**
 * 모든 Worker 응답이 통과하는 공통 보안 헤더.
 *
 * 이 저장소에는 보안 헤더 설정 지점이 아예 없었다 — `next.config.ts` 에
 * `headers()` 도, middleware 도, Worker 의 헤더 주입도 없었다. 그래서
 * 적용점을 먼저 만든다. Worker 의 `fetch` 는 이미지 최적화 분기와 앱
 * 핸들러 두 곳에서 응답을 돌려주므로, 둘 다 이 helper 를 지난다.
 */

/**
 * 브라우저에서 Tesseract 가 worker·wasm·언어 데이터를 받아오는 곳.
 *
 * `createWorker(["kor","eng"], 1, …)` 가 경로를 지정하지 않아 기본값인
 * jsdelivr 로 나간다. 자체 호스팅(M-26)이 끝나면 이 목록을 비우고 CSP 를
 * enforce 로 올린다 — 그때까지는 여기에 적어 두는 것이 사실이다.
 */
const OCR_ASSET_ORIGINS = ["https://cdn.jsdelivr.net"];

const ADSENSE_ORIGINS = [
  "https://pagead2.googlesyndication.com",
  "https://googleads.g.doubleclick.net",
  "https://tpc.googlesyndication.com",
];

export type SecurityHeaderOptions = {
  /**
   * 수익화가 켜졌을 때만 광고 출처를 허용한다. 정책이 기능보다 넓으면
   * 플래그를 꺼도 CSP 는 광고를 계속 허용하는 상태가 된다.
   */
  monetizationEnabled: boolean;
  /**
   * `true` 면 `Content-Security-Policy`, 아니면 `-Report-Only`.
   *
   * 지금은 Report-Only 다. vinext 가 하이드레이션 부트스트랩을 인라인
   * `<script>` 로 발행하므로 `'unsafe-inline'` 없이는 앱이 죽고, nonce 배선은
   * 별도 작업이다. 관측 없이 enforce 로 올리면 무엇이 깨지는지 모른 채
   * 사용자에게 먼저 도달한다.
   */
  enforce?: boolean;
};

export function buildContentSecurityPolicy({
  monetizationEnabled,
}: SecurityHeaderOptions): string {
  const scriptSrc = [
    "'self'",
    // vinext 의 인라인 부트스트랩. nonce 로 대체하기 전까지 필요하다.
    "'unsafe-inline'",
    // tesseract.js 의 wasm 컴파일.
    "'wasm-unsafe-eval'",
    ...OCR_ASSET_ORIGINS,
    ...(monetizationEnabled ? ADSENSE_ORIGINS : []),
  ];

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    // OCR 미리보기는 blob:, 인라인 아이콘은 data: 를 쓴다.
    `img-src 'self' data: blob:${monetizationEnabled ? ` ${ADSENSE_ORIGINS.join(" ")}` : ""}`,
    `connect-src 'self' ${OCR_ASSET_ORIGINS.join(" ")}`,
    // tesseract.js 는 blob: 워커를 만든다.
    "worker-src 'self' blob:",
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(monetizationEnabled
      ? [`frame-src ${ADSENSE_ORIGINS.join(" ")}`]
      : ["frame-src 'none'"]),
    "upgrade-insecure-requests",
  ];

  return directives.join("; ");
}

export function securityHeaders(
  options: SecurityHeaderOptions,
): Record<string, string> {
  const policyHeader = options.enforce
    ? "content-security-policy"
    : "content-security-policy-report-only";

  return {
    [policyHeader]: buildContentSecurityPolicy(options),
    // 카카오 임포트 토큰이 fragment 로 오므로 referrer 로 새지 않지만,
    // 브라우저 기본값에 기대지 않고 정책으로 고정한다.
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    // frame-ancestors 를 이해하지 못하는 브라우저용 이중 방어.
    "x-frame-options": "DENY",
    "cross-origin-opener-policy": "same-origin",
  };
}

/**
 * 이미 만들어진 응답에 공통 헤더를 씌운다.
 *
 * 응답이 이미 정한 값은 덮지 않는다 — 예를 들어 캡처 전달 응답의
 * `Cache-Control: no-store` 나 `X-Content-Type-Options` 는 그 경로가
 * 의도적으로 세운 것이다.
 */
export function withSecurityHeaders(
  response: Response,
  options: SecurityHeaderOptions,
): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(securityHeaders(options))) {
    if (!headers.has(name)) headers.set(name, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
