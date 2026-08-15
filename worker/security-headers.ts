/**
 * 모든 Worker 응답이 통과하는 공통 보안 헤더.
 *
 * 이 저장소에는 보안 헤더 설정 지점이 아예 없었다 — `next.config.ts` 에
 * `headers()` 도, middleware 도, Worker 의 헤더 주입도 없었다. 그래서
 * 적용점을 먼저 만든다. Worker 의 `fetch` 는 이미지 최적화 분기와 앱
 * 핸들러 두 곳에서 응답을 돌려주므로, 둘 다 이 helper 를 지난다.
 */

/**
 * Tesseract 언어 데이터(`kor.traineddata`)를 받아오는 곳.
 *
 * worker 스크립트와 wasm 코어는 자체 호스팅으로 옮겼다(M-26) — 그 둘이
 * 제3자 출처가 **우리 페이지 안에서 코드를 실행하는** 통로였다. 그래서
 * 이 출처는 이제 `script-src` 에 없다.
 *
 * 언어 데이터만 아직 여기서 온다. 저장소에 없는 큰 파일이라 어디에 둘지
 * 정해야 하고, 그 전까지 `connect-src` 에 적어 두는 것이 사실이다.
 * 비우는 순간 OCR 은 조용히 실패하지 않고 CSP 위반으로 드러난다.
 */
const OCR_LANG_ORIGINS = ["https://cdn.jsdelivr.net"];

/** 위반 리포트를 받는 우리 경로. */
export const CSP_REPORT_PATH = "/api/csp-report";

const ADSENSE_ORIGINS = [
  "https://pagead2.googlesyndication.com",
  "https://googleads.g.doubleclick.net",
  "https://tpc.googlesyndication.com",
];

/**
 * 요청 하나에 쓸 nonce 를 만든다.
 *
 * 매 요청 새로 만든다 — 값이 재사용되면 공격자가 미리 알 수 있고, 그러면
 * nonce 는 `'unsafe-inline'` 과 다를 바 없어진다.
 */
export function createScriptNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

export type SecurityHeaderOptions = {
  /**
   * 수익화가 켜졌을 때만 광고 출처를 허용한다. 정책이 기능보다 넓으면
   * 플래그를 꺼도 CSP 는 광고를 계속 허용하는 상태가 된다.
   */
  monetizationEnabled: boolean;
  /**
   * 이 요청의 인라인 스크립트 nonce.
   *
   * vinext 는 **요청** 헤더의 CSP 에서 nonce 를 읽어 자기 부트스트랩
   * `<script>` 에 찍는다. 그래서 Worker 가 요청에 심고 응답 정책에 같은
   * 값을 쓴다. 값이 있으면 `'unsafe-inline'` 을 뺀다 — 두 개를 함께 두면
   * 브라우저가 `'unsafe-inline'` 을 무시하는 게 아니라, nonce 없는
   * 인라인 스크립트도 그대로 허용된다.
   */
  scriptNonce?: string;
  /**
   * `true` 면 `Content-Security-Policy`, 아니면 `-Report-Only`.
   *
   * 지금은 Report-Only 다. nonce 배선이 끝났어도, 무엇이 걸리는지 실제
   * 배포에서 리포트로 확인하기 전에 enforce 로 올리면 무엇이 깨지는지
   * 모른 채 사용자에게 먼저 도달한다.
   */
  enforce?: boolean;
};

export function buildContentSecurityPolicy({
  monetizationEnabled,
  scriptNonce,
  enforce,
}: SecurityHeaderOptions): string {
  const scriptSrc = [
    "'self'",
    // nonce 가 있으면 그것만 쓴다. `'unsafe-inline'` 을 함께 두면 nonce 가
    // 무력해진다 — 브라우저는 둘 중 하나만 통과하면 실행하므로, nonce 없는
    // 인라인 스크립트도 그대로 허용된다.
    ...(scriptNonce ? [`'nonce-${scriptNonce}'`] : ["'unsafe-inline'"]),
    // tesseract.js 의 wasm 컴파일. 자산은 자체 호스팅이지만 wasm 을
    // 컴파일하는 권한 자체는 여전히 필요하다.
    "'wasm-unsafe-eval'",
    ...(monetizationEnabled ? ADSENSE_ORIGINS : []),
  ];

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    // OCR 미리보기는 blob:, 인라인 아이콘은 data: 를 쓴다.
    `img-src 'self' data: blob:${monetizationEnabled ? ` ${ADSENSE_ORIGINS.join(" ")}` : ""}`,
    `connect-src 'self' ${OCR_LANG_ORIGINS.join(" ")}`,
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
    // `upgrade-insecure-requests` 는 Report-Only 에서 무시되고, 브라우저가
    // 그 사실을 콘솔 오류로 찍는다 — 모든 페이지 로드마다. 진짜 문제를
    // 찾는 사람이 매번 이 줄을 먼저 만나게 된다. enforce 일 때만 낸다.
    ...(enforce ? ["upgrade-insecure-requests"] : []),
    // 리포트를 받을 곳. 이게 없으면 Report-Only 정책은 막지도, 보고하지도
    // 않는다 — "무엇이 깨지는지 보고 enforce 로 올린다"는 계획의 관측
    // 단계가 아예 일어나지 않는다.
    `report-uri ${CSP_REPORT_PATH}`,
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
