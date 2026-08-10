/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import {
  buildContentSecurityPolicy,
  createScriptNonce,
  withSecurityHeaders,
} from "./security-headers";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  ADMIN_EMAILS?: string;
  KAKAO_SKILL_TOKEN?: string;
  MONETIZATION_ENABLED?: string;
  NEXT_PUBLIC_SITE_URL?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    // 요청마다 새 nonce. 재사용하면 공격자가 미리 알 수 있어 nonce 의
    // 의미가 사라진다.
    const scriptNonce = createScriptNonce();
    // 정책이 기능보다 넓으면 플래그를 꺼도 CSP 는 광고를 계속 허용한다.
    const headerOptions = {
      monetizationEnabled: env.MONETIZATION_ENABLED === "true",
      scriptNonce,
    };

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      const optimized = await handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
      return withSecurityHeaders(optimized, headerOptions);
    }

    // vinext 는 **요청** 헤더의 CSP 에서 nonce 를 읽어 자기 하이드레이션
    // 부트스트랩 `<script>` 에 찍는다. 응답에만 실으면 그 스크립트에는
    // nonce 가 없고, `'unsafe-inline'` 을 뺀 정책에서 앱이 죽는다.
    const requestWithNonce = new Request(request, {
      headers: (() => {
        const headers = new Headers(request.headers);
        headers.set(
          "content-security-policy",
          buildContentSecurityPolicy(headerOptions),
        );
        return headers;
      })(),
    });

    // 두 반환 경로가 모두 같은 helper 를 지난다.
    return withSecurityHeaders(
      await handler.fetch(requestWithNonce, env, ctx),
      headerOptions,
    );
  },
};

export default worker;
