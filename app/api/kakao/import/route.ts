import {
  consumeKakaoImport,
  KakaoImportError,
} from "../../../lib/kakao-import";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token")?.trim() ?? "";

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
