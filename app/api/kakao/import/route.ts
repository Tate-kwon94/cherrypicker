import {
  consumeKakaoImport,
  KakaoImportError,
} from "../../../lib/kakao-import";
import {
  featureDisabledResponse,
  isFeatureEnabled,
} from "../../../lib/runtime-flags";

export const dynamic = "force-dynamic";

/**
 * 브라우저가 우리 페이지에서 보낸 요청인지 확인한다.
 *
 * `Origin` 은 브라우저별로 누락될 수 있어 단독 인증수단으로 쓰지 않는다.
 * Fetch Metadata 는 보조 방어이며, 토큰 자체의 엔트로피·1회성·TTL 을
 * 대체하지 않는다.
 */
function isSameSiteFetch(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  // 헤더를 보내지 않는 브라우저는 통과시킨다. 여기서 막으면 지원 범위가
  // 좁아지는 대신 얻는 것이 없다 — 토큰이 여전히 1차 방어다.
  if (site === null) return true;
  return site === "same-origin" || site === "same-site";
}

export async function POST(request: Request) {
  if (!(await isFeatureEnabled("KAKAO_IMPORT_ENABLED"))) {
    return featureDisabledResponse();
  }
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return Response.json(
      { error: "JSON 요청만 허용합니다." },
      { status: 415, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!isSameSiteFetch(request)) {
    return Response.json(
      { error: "잘못된 요청입니다." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  const payload = (await request.json().catch(() => null)) as {
    token?: unknown;
  } | null;
  const token =
    typeof payload?.token === "string" ? payload.token.trim() : "";

  try {
    const image = await consumeKakaoImport(token);
    return new Response(image.bytes, {
      headers: {
        "Content-Type": image.contentType,
        "Content-Length": String(image.bytes.byteLength),
        "Cache-Control": "no-store, max-age=0",
        Pragma: "no-cache",
        "X-Content-Type-Options": "nosniff",
        "X-Cherrypicker-Observed-At": String(image.observedAt),
      },
    });
  } catch (error) {
    const status = error instanceof KakaoImportError ? error.status : 500;
    const message =
      error instanceof KakaoImportError
        ? error.message
        : "캡처를 불러오지 못했습니다.";
    return Response.json(
      { error: message },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
