/**
 * 운영 기능 플래그 (Phase 0).
 *
 * 다섯 플래그는 모두 **request-time 서버 값**만 읽는다. `NEXT_PUBLIC_*`는
 * 빌드 산출물에 고정돼 배포 후 끌 수 없고, 클라이언트 번들에서는 `{}`로
 * 컴파일돼 값이 아예 사라진다. 따라서 기능을 끄는 수단으로 쓸 수 없다.
 *
 * 모든 플래그는 fail-closed다 — 값이 없거나, 오타이거나, 파싱할 수 없으면
 * `false`다. 켜려면 정확히 `"true"`여야 한다.
 */

export const RUNTIME_FLAG_NAMES = [
  "MONETIZATION_ENABLED",
  "KAKAO_IMPORT_ENABLED",
  "ALCOHOL_COMMERCE_ENABLED",
  "AUTO_CONFIRM_ENABLED",
  "ADMIN_UI_ENABLED",
] as const;

/**
 * `TELEMETRY_ENABLED` 는 없앴다.
 *
 * 이 저장소에는 텔레메트리 코드가 한 줄도 없다. 끌 대상이 없는 스위치는
 * 운영자에게 "끌 수 있다"고 말하지만 아무것도 하지 않는다 — 이 브랜치가
 * 반복해서 고친, 실행되지 않는 방어와 같은 것이다. 텔레메트리를 도입할 때
 * 그 코드와 함께 다시 넣는다.
 */

/**
 * 기능이 꺼져 있을 때의 응답.
 *
 * 404 를 쓴다. 403 이나 리다이렉트는 "여기 뭔가 있는데 당신은 못 본다"를
 * 알려주므로, 꺼진 기능의 존재 자체가 드러난다.
 */
export function featureDisabledResponse(): Response {
  return new Response("Not found", {
    status: 404,
    headers: { "cache-control": "no-store" },
  });
}

/**
 * 이 요청에서 기능이 켜져 있는지. 꺼져 있으면 호출부는 인증보다 **먼저**
 * 404 로 끝내야 한다 — 인증을 먼저 하면 이메일·로그인·권한 상태가 응답
 * 차이로 새어나간다.
 */
export async function isFeatureEnabled(
  name: RuntimeFlagName,
): Promise<boolean> {
  return (await readRuntimeFlags())[name];
}

export type RuntimeFlagName = (typeof RUNTIME_FLAG_NAMES)[number];

export type RuntimeFlags = Record<RuntimeFlagName, boolean>;

/** 모두 꺼진 상태. 판독에 실패하면 이 값을 쓴다. */
export const CLOSED_FLAGS: RuntimeFlags = Object.freeze(
  Object.fromEntries(RUNTIME_FLAG_NAMES.map((name) => [name, false])),
) as RuntimeFlags;

/**
 * 단일 플래그 값을 해석한다.
 * `"true"` 하나만 참이다. `"1"`, `"yes"`, `"TRUE"` 같은 관대한 해석은
 * 오타가 기능을 켜는 사고로 이어지므로 허용하지 않는다.
 */
export function parseFlag(value: unknown): boolean {
  return value === "true";
}

export function parseRuntimeFlags(
  source: Record<string, unknown> | null | undefined,
): RuntimeFlags {
  if (!source) return { ...CLOSED_FLAGS };

  return Object.fromEntries(
    RUNTIME_FLAG_NAMES.map((name) => [name, parseFlag(source[name])]),
  ) as RuntimeFlags;
}

/**
 * 서버 경계에서 플래그를 읽는다.
 *
 * `process.env`를 먼저 보고, 값이 없으면 Worker 바인딩으로 폴백한다.
 * `app/lib/admin-auth.ts`가 쓰는 것과 같은 패턴이며, 이 저장소에서
 * 런타임 값을 실제로 읽는 유일한 검증된 경로다.
 */
export async function readRuntimeFlags(): Promise<RuntimeFlags> {
  const fromProcess = parseRuntimeFlags(
    process.env as unknown as Record<string, unknown>,
  );
  if (RUNTIME_FLAG_NAMES.some((name) => fromProcess[name])) return fromProcess;

  try {
    const { env } = await import("cloudflare:workers");
    return parseRuntimeFlags(env as unknown as Record<string, unknown>);
  } catch {
    // 바인딩을 읽을 수 없으면 켜지 않는다.
    return { ...CLOSED_FLAGS };
  }
}

/** AdSense 설정. 수익화 플래그가 꺼져 있으면 값을 노출하지 않는다. */
export type AdsenseConfig = {
  client: string | null;
  homeContentSlot: string | null;
};

export const DISABLED_ADSENSE: AdsenseConfig = Object.freeze({
  client: null,
  homeContentSlot: null,
});

function adsenseClientOf(value: unknown): string | null {
  return typeof value === "string" && value.startsWith("ca-pub-")
    ? value
    : null;
}

export function resolveAdsenseConfig(
  source: Record<string, unknown> | null | undefined,
  monetizationEnabled: boolean,
): AdsenseConfig {
  if (!monetizationEnabled || !source) return DISABLED_ADSENSE;

  const client = adsenseClientOf(source.ADSENSE_CLIENT);
  if (!client) return DISABLED_ADSENSE;

  const slot = source.ADSENSE_SLOT_HOME_CONTENT;

  return {
    client,
    homeContentSlot: typeof slot === "string" && slot.length > 0 ? slot : null,
  };
}

export async function readAdsenseConfig(
  monetizationEnabled: boolean,
): Promise<AdsenseConfig> {
  if (!monetizationEnabled) return DISABLED_ADSENSE;

  const fromProcess = resolveAdsenseConfig(
    process.env as unknown as Record<string, unknown>,
    true,
  );
  if (fromProcess.client) return fromProcess;

  try {
    const { env } = await import("cloudflare:workers");
    return resolveAdsenseConfig(env as unknown as Record<string, unknown>, true);
  } catch {
    return DISABLED_ADSENSE;
  }
}
