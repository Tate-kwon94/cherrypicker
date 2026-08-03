import { headers } from "next/headers";

function parseOrigin(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * 설정으로 확정된 origin. 요청 헤더는 보지 않는다.
 *
 * 사용자에게 보내는 링크처럼 위조된 Host 가 섞이면 안 되는 자리는
 * 이 함수를 쓰고, 값이 없으면 만들지 않는다.
 */
export async function getConfiguredOrigin(): Promise<string | null> {
  const fromProcess = parseOrigin(process.env.NEXT_PUBLIC_SITE_URL);
  if (fromProcess) return fromProcess;

  try {
    const { env } = await import("cloudflare:workers");
    return parseOrigin(
      (env as unknown as Record<string, unknown>).NEXT_PUBLIC_SITE_URL,
    );
  } catch {
    return null;
  }
}

export async function getSiteOrigin(): Promise<string> {
  const configured = await getConfiguredOrigin();
  if (configured) return configured;

  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";

  return host ? `${protocol}://${host}` : "http://localhost:3000";
}
