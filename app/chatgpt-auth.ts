import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { parseProxyTrust } from "./lib/proxy-trust";

export type ChatGPTUser = {
  displayName: string;
  email: string;
  fullName: string | null;
};

const USER_EMAIL_HEADER = "oai-authenticated-user-email";
const USER_FULL_NAME_HEADER = "oai-authenticated-user-full-name";
const USER_FULL_NAME_ENCODING_HEADER =
  "oai-authenticated-user-full-name-encoding";
const PERCENT_ENCODED_UTF8 = "percent-encoded-utf-8";
const SIGN_IN_PATH = "/signin-with-chatgpt";
const SIGN_OUT_PATH = "/signout-with-chatgpt";
const CALLBACK_PATH = "/callback";

/**
 * oai-* 사용자 헤더는 OpenAI Sites 프록시가 주입하고, 클라이언트가 보낸
 * 사본은 그 프록시가 차단해 줄 때만 믿을 수 있다. Cloudflare 직접 서빙
 * 에는 그 프록시가 없다 — 아무나 이 헤더를 붙여 관리자를 사칭할 수 있다.
 * 그래서 신뢰는 배포 환경이 명시적으로 선언한다: SITES_PROXY_TRUSTED 가
 * "true" 인 환경(= Sites)만 헤더를 읽고, 그 밖에서는 로그인 없음으로
 * 처리한다. Cloudflare 의 관리자 인증은 별도 방식(Cloudflare Access 등)
 * 이 붙기 전까지 닫혀 있다.
 */
async function userHeadersTrusted(): Promise<boolean> {
  if (parseProxyTrust(process.env.SITES_PROXY_TRUSTED)) return true;
  try {
    const { env } = await import("cloudflare:workers");
    return parseProxyTrust(
      (env as unknown as Record<string, unknown>).SITES_PROXY_TRUSTED,
    );
  } catch {
    return false;
  }
}

export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  if (!(await userHeadersTrusted())) return null;
  const requestHeaders = await headers();
  const email = requestHeaders.get(USER_EMAIL_HEADER);
  if (!email) return null;

  const encodedFullName = requestHeaders.get(USER_FULL_NAME_HEADER);
  const fullName =
    encodedFullName &&
    requestHeaders.get(USER_FULL_NAME_ENCODING_HEADER) === PERCENT_ENCODED_UTF8
      ? safeDecodeURIComponent(encodedFullName)
      : null;

  return {
    displayName: fullName ?? email,
    email,
    fullName,
  };
}

export async function requireChatGPTUser(
  returnTo: string,
): Promise<ChatGPTUser> {
  const user = await getChatGPTUser();
  if (user) return user;

  redirect(chatGPTSignInPath(returnTo));
}

export function chatGPTSignInPath(returnTo: string): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  return `${SIGN_IN_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
}

export function chatGPTSignOutPath(returnTo = "/"): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  return `${SIGN_OUT_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
}

function safeRelativeReturnPath(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) return "/";

  let url: URL;
  try {
    url = new URL(value, "https://app.local");
  } catch {
    return "/";
  }
  if (url.origin !== "https://app.local") return "/";
  if (isReservedAuthPath(url.pathname)) return "/";

  return `${url.pathname}${url.search}${url.hash}`;
}

function isReservedAuthPath(pathname: string): boolean {
  return (
    pathname === SIGN_IN_PATH ||
    pathname === SIGN_OUT_PATH ||
    pathname === CALLBACK_PATH
  );
}

function safeDecodeURIComponent(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}
