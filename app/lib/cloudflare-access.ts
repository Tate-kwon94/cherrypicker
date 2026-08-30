/**
 * Cloudflare Access JWT 검증.
 *
 * Cloudflare 직접 서빙에서 관리자 신원은 Access 가 프록시 단계에서 붙이는
 * `Cf-Access-Jwt-Assertion` 헤더로 온다. 이 헤더 자체는 누구나 보낼 수
 * 있으므로 — 팀의 공개키(JWKS)로 서명을 검증한 것만 신원으로 인정한다.
 * 서명·발급자·대상(aud)·만료 중 하나라도 어긋나면 신원 없음이다.
 *
 * 설정이 없으면 이 경로는 존재하지 않는 것과 같다: CF_ACCESS_TEAM_DOMAIN
 * 과 CF_ACCESS_AUD 둘 다 있어야 검증을 시도한다. Access 뒤에 두더라도
 * 앱의 ADMIN_EMAILS 허용목록은 별도로 통과해야 한다(이중 게이트).
 */

export type AccessConfig = {
  /** 예: your-team.cloudflareaccess.com (스킴 없이 저장한다) */
  teamDomain: string;
  /** Access 애플리케이션의 Audience(AUD) 태그 */
  aud: string;
};

type AccessJwk = JsonWebKey & { kid?: string };

async function readEnvValue(name: string): Promise<string> {
  const local = process.env[name];
  if (typeof local === "string" && local.trim() !== "") return local.trim();
  try {
    const { env } = await import("cloudflare:workers");
    const value = (env as unknown as Record<string, unknown>)[name];
    return typeof value === "string" ? value.trim() : "";
  } catch {
    return "";
  }
}

export function normalizeTeamDomain(value: string): string {
  return value
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");
}

export async function readAccessConfig(): Promise<AccessConfig | null> {
  const teamDomain = normalizeTeamDomain(
    await readEnvValue("CF_ACCESS_TEAM_DOMAIN"),
  );
  const aud = await readEnvValue("CF_ACCESS_AUD");
  if (!teamDomain || !aud) return null;
  return { teamDomain, aud };
}

function base64UrlToBytes(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  try {
    const raw = atob(padded);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

function decodeJsonSegment(segment: string): Record<string, unknown> | null {
  const bytes = base64UrlToBytes(segment);
  if (!bytes) return null;
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

type JwksFetcher = (
  teamDomain: string,
  options?: { forceRefresh?: boolean },
) => Promise<{ keys?: AccessJwk[] }>;

const JWKS_TTL_MS = 10 * 60 * 1000;
const jwksCache = new Map<string, { fetchedAt: number; keys: AccessJwk[] }>();

async function fetchJwksDefault(
  teamDomain: string,
  options: { forceRefresh?: boolean } = {},
): Promise<{ keys?: AccessJwk[] }> {
  const cached = jwksCache.get(teamDomain);
  if (
    !options.forceRefresh &&
    cached &&
    Date.now() - cached.fetchedAt < JWKS_TTL_MS
  ) {
    return { keys: cached.keys };
  }
  const response = await fetch(
    `https://${teamDomain}/cdn-cgi/access/certs`,
    { headers: { accept: "application/json" } },
  );
  if (!response.ok) {
    throw new Error(`Access JWKS ${response.status}`);
  }
  const payload = (await response.json()) as { keys?: AccessJwk[] };
  jwksCache.set(teamDomain, {
    fetchedAt: Date.now(),
    keys: payload.keys ?? [],
  });
  return payload;
}

/**
 * 토큰을 검증하고 이메일을 돌려준다. 어떤 이유로든 검증에 실패하면
 * null — 이유를 밖으로 구분해 주지 않는다(응답 차이로 새는 것 방지).
 */
export async function verifyAccessJwt(
  token: string,
  config: AccessConfig,
  options: { now?: number; fetchJwks?: JwksFetcher } = {},
): Promise<{ email: string } | null> {
  if (typeof token !== "string") return null;
  const now = options.now ?? Date.now();
  const fetchJwks = options.fetchJwks ?? fetchJwksDefault;

  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerPart, payloadPart, signaturePart] = parts;

  const header = decodeJsonSegment(headerPart);
  const payload = decodeJsonSegment(payloadPart);
  const signature = base64UrlToBytes(signaturePart);
  if (!header || !payload || !signature) return null;

  // 알고리즘은 서버가 고정한다. 토큰이 "none"이나 HS256 을 주장해도
  // RS256 외에는 검증 자체를 시작하지 않는다.
  if (header.alg !== "RS256") return null;
  const kid = typeof header.kid === "string" ? header.kid : "";
  if (!kid) return null;

  let keys: AccessJwk[];
  try {
    keys = (await fetchJwks(config.teamDomain)).keys ?? [];
  } catch {
    return null;
  }
  let jwk = keys.find((key) => key.kid === kid);
  if (!jwk) {
    // Cloudflare 는 약 6주마다 서명키를 회전한다. 캐시된 키 목록에 없는
    // kid 는 회전 직후의 정상 토큰일 수 있으므로 한 번은 새로 받아 본다 —
    // 없으면 관리자 로그인이 캐시 TTL 동안 전부 실패한다.
    try {
      keys = (await fetchJwks(config.teamDomain, { forceRefresh: true })).keys ?? [];
    } catch {
      return null;
    }
    jwk = keys.find((key) => key.kid === kid);
    if (!jwk) return null;
  }

  let verified = false;
  try {
    const key = await crypto.subtle.importKey(
      "jwk",
      { ...jwk, alg: "RS256" },
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    verified = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      signature.slice().buffer as ArrayBuffer,
      new TextEncoder().encode(`${headerPart}.${payloadPart}`),
    );
  } catch {
    return null;
  }
  if (!verified) return null;

  // 서명이 맞아도 다른 Access 앱·다른 팀·만료 토큰이면 신원이 아니다.
  const iss = typeof payload.iss === "string" ? payload.iss : "";
  if (iss !== `https://${config.teamDomain}`) return null;

  const audClaim = payload.aud;
  const audiences = Array.isArray(audClaim)
    ? audClaim
    : typeof audClaim === "string"
      ? [audClaim]
      : [];
  if (!audiences.includes(config.aud)) return null;

  const leewayMs = 60 * 1000;
  const exp = typeof payload.exp === "number" ? payload.exp * 1000 : 0;
  if (exp <= now) return null;
  const nbf = typeof payload.nbf === "number" ? payload.nbf * 1000 : 0;
  if (nbf > now + leewayMs) return null;

  const email = typeof payload.email === "string" ? payload.email.trim() : "";
  if (!email) return null;

  return { email };
}
