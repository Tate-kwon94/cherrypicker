const importTtlMs = 10 * 60 * 1000;
const maxImageBytes = 12 * 1024 * 1024;
const maxActiveImportsPerUser = 3;

type UnknownRecord = Record<string, unknown>;

type KakaoBindings = {
  DB?: D1Database;
  KAKAO_SKILL_TOKEN?: string;
  KAKAO_URL_ENCRYPTION_KEY?: string;
  KAKAO_USER_HASH_PEPPER?: string;
  NEXT_PUBLIC_SITE_URL?: string;
};

/**
 * 카카오 임포트가 쓰는 비밀값 세 개.
 *
 * 예전에는 `KAKAO_SKILL_TOKEN` 하나가 세 역할을 겸했다 — 스킬 요청 인증의
 * bearer, 저장 URL 의 AES 키 재료, 사용자 식별자 해시의 pepper. 그래서
 * 인증 토큰이 유출되면 저장된 URL 복호화와 사용자 해시 역산까지 함께
 * 열렸고, 토큰을 회전하려면 세 가지가 동시에 깨졌다.
 *
 * 회전 시 유의: URL 암호화 키를 바꾸면 아직 소비되지 않은 링크는 복호화할
 * 수 없어 410 으로 만료된다. TTL 이 10분이므로 회전 후 한 TTL 만 기다리면
 * 영향이 사라진다. 별도 마이그레이션은 두지 않는다.
 */
export type KakaoSecrets = {
  skillToken: string;
  urlEncryptionKey: string;
  userHashPepper: string;
};

/**
 * 세 비밀값을 모두 확보했을 때만 임포트를 가능하게 한다.
 * 하나라도 없으면 null 이고, 호출부는 기능을 닫는다.
 */
export function resolveKakaoSecrets(
  source: Record<string, unknown> | null | undefined,
): KakaoSecrets | null {
  if (!source) return null;

  const skillToken = stringValue(source.KAKAO_SKILL_TOKEN);
  const urlEncryptionKey = stringValue(source.KAKAO_URL_ENCRYPTION_KEY);
  const userHashPepper = stringValue(source.KAKAO_USER_HASH_PEPPER);
  if (!skillToken || !urlEncryptionKey || !userHashPepper) return null;

  // 같은 값을 두 자리에 넣으면 분리한 의미가 없다.
  const distinct = new Set([skillToken, urlEncryptionKey, userHashPepper]);
  if (distinct.size < 3) return null;

  return { skillToken, urlEncryptionKey, userHashPepper };
}

export type KakaoSecureImage = {
  privacyAgreement: "Y";
  urls: string[];
  botUserId: string;
};

type ImportRow = {
  encrypted_url: string;
  encryption_iv: string;
};

export class KakaoImportError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "KakaoImportError";
    this.status = status;
  }
}

function asRecord(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object"
    ? (value as UnknownRecord)
    : null;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function secureImageParameter(payload: UnknownRecord): string {
  const action = asRecord(payload.action);
  const params = asRecord(action?.params);
  const direct = stringValue(params?.secureimage);
  if (direct) return direct;

  const details = asRecord(action?.detailParams);
  const secureImage = asRecord(details?.secureimage);
  return stringValue(secureImage?.value);
}

function secureUrls(value: unknown): string[] {
  const raw = stringValue(value);
  const inner = raw.startsWith("List(") && raw.endsWith(")")
    ? raw.slice(5, -1)
    : raw;

  return inner
    .split(/,\s*(?=https?:\/\/)/i)
    .map((url) => url.trim())
    .filter(Boolean);
}

export function isAllowedKakaoImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return (
      // 사적인 장바구니 캡처를 평문으로 가져오지 않는다.
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      (host === "kakaocdn.net" || host.endsWith(".kakaocdn.net"))
    );
  } catch {
    return false;
  }
}

export function parseKakaoSecureImage(payload: unknown): KakaoSecureImage {
  const body = asRecord(payload);
  if (!body) throw new KakaoImportError("카카오 요청 형식을 확인해주세요.");

  let parameter: UnknownRecord | null = null;
  try {
    parameter = asRecord(JSON.parse(secureImageParameter(body)));
  } catch {
    throw new KakaoImportError("보안이미지 정보를 읽지 못했습니다.");
  }

  if (stringValue(parameter?.privacyAgreement) !== "Y") {
    throw new KakaoImportError("이미지 전송 동의가 필요합니다.");
  }

  const urls = secureUrls(parameter?.secureUrls);
  if (urls.length === 0 || urls.some((url) => !isAllowedKakaoImageUrl(url))) {
    throw new KakaoImportError("카카오 보안이미지 주소를 확인하지 못했습니다.");
  }

  const userRequest = asRecord(body.userRequest);
  const user = asRecord(userRequest?.user);
  const properties = asRecord(user?.properties);
  const botUserId =
    stringValue(properties?.plusfriendUserKey) ||
    stringValue(user?.id) ||
    "anonymous";

  return { privacyAgreement: "Y", urls, botUserId };
}

async function runtimeBindings(): Promise<KakaoBindings> {
  const { env } = await import("cloudflare:workers");
  return env as unknown as KakaoBindings;
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from<string>(binary as unknown as ArrayLike<string>, (character) =>
    character.charCodeAt(0),
  ) as Uint8Array<ArrayBuffer>;
}

async function encryptionKey(keyMaterial: string): Promise<CryptoKey> {
  const material = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`cherrypicker-kakao-import\0${keyMaterial}`),
  );
  return crypto.subtle.importKey("raw", material, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

async function encryptUrl(
  url: string,
  keyMaterial: string,
): Promise<{ encryptedUrl: string; encryptionIv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await encryptionKey(keyMaterial),
    new TextEncoder().encode(url),
  );
  return {
    encryptedUrl: encodeBase64Url(new Uint8Array(encrypted)),
    encryptionIv: encodeBase64Url(iv),
  };
}

async function decryptUrl(
  encryptedUrl: string,
  encryptionIv: string,
  keyMaterial: string,
): Promise<string> {
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: decodeBase64Url(encryptionIv) },
    await encryptionKey(keyMaterial),
    decodeBase64Url(encryptedUrl),
  );
  const url = new TextDecoder().decode(decrypted);
  if (!isAllowedKakaoImageUrl(url)) {
    throw new KakaoImportError("임시 이미지 주소가 올바르지 않습니다.", 410);
  }
  return url;
}

async function fetchKakaoImage(initialUrl: string): Promise<{
  bytes: ArrayBuffer;
  contentType: string;
}> {
  let currentUrl = initialUrl;

  for (let redirect = 0; redirect <= 2; redirect += 1) {
    if (!isAllowedKakaoImageUrl(currentUrl)) {
      throw new KakaoImportError("허용되지 않은 이미지 주소입니다.");
    }

    const response = await fetch(currentUrl, {
      redirect: "manual",
      signal: AbortSignal.timeout(3_500),
      headers: { Accept: "image/jpeg,image/png,image/webp" },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new KakaoImportError("이미지 이동 주소가 없습니다.");
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    if (!response.ok) {
      throw new KakaoImportError("카카오 이미지를 가져오지 못했습니다.", 502);
    }

    const contentType = (response.headers.get("content-type") ?? "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    if (!["image/jpeg", "image/png", "image/webp"].includes(contentType)) {
      throw new KakaoImportError("지원하지 않는 이미지 형식입니다.");
    }

    const declaredSize = Number(response.headers.get("content-length") ?? 0);
    if (declaredSize > maxImageBytes) {
      throw new KakaoImportError("캡처 이미지는 12MB 이하여야 합니다.");
    }

    const bytes = await response.arrayBuffer();
    if (bytes.byteLength === 0 || bytes.byteLength > maxImageBytes) {
      throw new KakaoImportError("캡처 이미지 크기를 확인해주세요.");
    }
    return { bytes, contentType };
  }

  throw new KakaoImportError("이미지 이동 횟수가 너무 많습니다.");
}

async function cleanExpiredImports(db: D1Database) {
  await db.prepare(
    `DELETE FROM kakao_cart_imports
      WHERE expires_at <= ? OR consumed_at IS NOT NULL`,
  )
    .bind(Date.now())
    .run();
}

export async function kakaoSkillSecret(): Promise<string> {
  const secrets = resolveKakaoSecrets(
    (await runtimeBindings()) as unknown as Record<string, unknown>,
  );
  return secrets?.skillToken ?? "";
}

export async function verifyKakaoSkillRequest(
  request: Request,
  configuredSecret: string,
): Promise<boolean> {
  if (!configuredSecret) return false;
  // 헤더로만 받는다. 쿼리스트링은 edge·origin 로그와 분석 이벤트에 그대로
  // 남으므로 장기 secret 을 실어 보낼 자리가 아니다.
  const supplied =
    request.headers.get("x-cherrypicker-skill-token")?.trim() ?? "";
  if (!supplied) return false;
  const [expectedHash, suppliedHash] = await Promise.all([
    sha256(configuredSecret),
    sha256(supplied),
  ]);
  return expectedHash === suppliedHash;
}

export async function storeKakaoImport(
  secureImage: KakaoSecureImage,
): Promise<{ token: string; expiresAt: number; imageCount: number }> {
  return storeKakaoImportWithBindings(secureImage, await runtimeBindings());
}

export async function storeKakaoImportWithBindings(
  secureImage: KakaoSecureImage,
  bindings: KakaoBindings,
): Promise<{ token: string; expiresAt: number; imageCount: number }> {
  const secrets = resolveKakaoSecrets(
    bindings as unknown as Record<string, unknown>,
  );
  if (!bindings.DB || !secrets) {
    throw new KakaoImportError("임시 저장소 연결을 확인해주세요.", 503);
  }

  await cleanExpiredImports(bindings.DB);
  const botUserHash = await sha256(
    `${secrets.userHashPepper}\0${secureImage.botUserId}`,
  );
  const active = await bindings.DB.prepare(
    `SELECT COUNT(*) AS count
       FROM kakao_cart_imports
      WHERE bot_user_hash = ? AND consumed_at IS NULL AND expires_at > ?`,
  )
    .bind(botUserHash, Date.now())
    .first<{ count: number }>();
  if ((active?.count ?? 0) >= maxActiveImportsPerUser) {
    throw new KakaoImportError(
      "아직 열지 않은 캡처가 있어요. 기존 링크를 먼저 확인해주세요.",
      429,
    );
  }

  const token = randomToken();
  const tokenHash = await sha256(token);
  const encrypted = await encryptUrl(
    secureImage.urls[0],
    secrets.urlEncryptionKey,
  );
  const createdAt = Date.now();
  const expiresAt = createdAt + importTtlMs;

  await bindings.DB.prepare(
    `INSERT INTO kakao_cart_imports (
       token_hash, encrypted_url, encryption_iv, bot_user_hash,
       created_at, expires_at, consumed_at
     ) VALUES (?, ?, ?, ?, ?, ?, NULL)`,
  )
    .bind(
      tokenHash,
      encrypted.encryptedUrl,
      encrypted.encryptionIv,
      botUserHash,
      createdAt,
      expiresAt,
    )
    .run();

  return { token, expiresAt, imageCount: secureImage.urls.length };
}

export async function consumeKakaoImport(token: string): Promise<{
  bytes: ArrayBuffer;
  contentType: string;
  observedAt: number;
}> {
  return consumeKakaoImportWithBindings(token, await runtimeBindings());
}

export async function consumeKakaoImportWithBindings(
  token: string,
  bindings: KakaoBindings,
): Promise<{
  bytes: ArrayBuffer;
  contentType: string;
  observedAt: number;
}> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
    throw new KakaoImportError("유효하지 않은 캡처 링크입니다.", 404);
  }

  const secrets = resolveKakaoSecrets(
    bindings as unknown as Record<string, unknown>,
  );
  if (!bindings.DB || !secrets) {
    throw new KakaoImportError("임시 저장소 연결을 확인해주세요.", 503);
  }

  const now = Date.now();
  const tokenHash = await sha256(token);
  const row = await bindings.DB.prepare(
    `UPDATE kakao_cart_imports
        SET consumed_at = ?
      WHERE token_hash = ? AND consumed_at IS NULL AND expires_at > ?
      RETURNING encrypted_url, encryption_iv`,
  )
    .bind(now, tokenHash, now)
    .first<ImportRow>();
  if (!row) {
    throw new KakaoImportError("링크가 만료됐거나 이미 사용되었습니다.", 410);
  }

  try {
    const secureUrl = await decryptUrl(
      row.encrypted_url,
      row.encryption_iv,
      secrets.urlEncryptionKey,
    );
    const image = await fetchKakaoImage(secureUrl);
    return { ...image, observedAt: now };
  } finally {
    await bindings.DB.prepare(
      "DELETE FROM kakao_cart_imports WHERE token_hash = ?",
    )
      .bind(tokenHash)
      .run();
  }
}
