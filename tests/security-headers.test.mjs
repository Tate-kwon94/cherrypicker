import assert from "node:assert/strict";
import test from "node:test";
import {
  buildContentSecurityPolicy,
  securityHeaders,
  withSecurityHeaders,
} from "../worker/security-headers.ts";

const off = { monetizationEnabled: false };
const on = { monetizationEnabled: true };

function directives(policy) {
  return new Map(
    policy.split("; ").map((entry) => {
      const [name, ...values] = entry.split(" ");
      return [name, values];
    }),
  );
}

test("기본은 Report-Only 다", () => {
  // vinext 가 인라인 부트스트랩 script 를 발행하므로 관측 없이 enforce 로
  // 올리면 무엇이 깨지는지 모른 채 사용자에게 먼저 도달한다.
  assert.ok("content-security-policy-report-only" in securityHeaders(off));
  assert.ok(!("content-security-policy" in securityHeaders(off)));

  assert.ok(
    "content-security-policy" in securityHeaders({ ...off, enforce: true }),
  );
});

test("수익화가 꺼져 있으면 광고 출처를 허용하지 않는다", () => {
  // 정책이 기능보다 넓으면 플래그를 꺼도 CSP 는 광고를 계속 허용한다.
  const policy = buildContentSecurityPolicy(off);

  assert.doesNotMatch(policy, /googlesyndication/);
  assert.doesNotMatch(policy, /doubleclick/);
  assert.match(policy, /frame-src 'none'/);

  const enabled = buildContentSecurityPolicy(on);
  assert.match(enabled, /pagead2\.googlesyndication\.com/);
});

test("제3자 출처는 더 이상 우리 페이지에서 코드를 실행하지 않는다", () => {
  // M-26. worker 스크립트와 wasm 코어를 자체 호스팅으로 옮겼다.
  // 남은 CDN 사용처는 언어 데이터뿐이고, 그건 데이터이지 코드가 아니다.
  const parsed = directives(buildContentSecurityPolicy(off));

  assert.equal(
    parsed.get("script-src").includes("https://cdn.jsdelivr.net"),
    false,
  );
  // 언어 데이터는 아직 CDN 에서 온다. 여기서 지우면 OCR 이 조용히 실패하지
  // 않고 CSP 위반으로 드러나야 하므로, 사실대로 적어 둔다.
  assert.ok(parsed.get("connect-src").includes("https://cdn.jsdelivr.net"));
  // tesseract.js 는 blob: 워커를 만들고 wasm 을 컴파일한다.
  assert.ok(parsed.get("worker-src").includes("blob:"));
  assert.ok(parsed.get("script-src").includes("'wasm-unsafe-eval'"));
});

test("수익화가 꺼져 있으면 스크립트 출처는 자기 자신뿐이다", () => {
  const parsed = directives(buildContentSecurityPolicy(off));
  const external = parsed
    .get("script-src")
    .filter((source) => source.startsWith("http"));

  assert.deepEqual(external, []);
});

test("클릭재킹과 참조자 유출을 함께 막는다", () => {
  const headers = securityHeaders(off);

  assert.equal(headers["referrer-policy"], "no-referrer");
  assert.equal(headers["x-frame-options"], "DENY");
  assert.equal(headers["x-content-type-options"], "nosniff");
  assert.match(
    headers["content-security-policy-report-only"],
    /frame-ancestors 'none'/,
  );
});

test("응답이 이미 정한 헤더는 덮어쓰지 않는다", () => {
  // 캡처 전달 응답의 no-store 처럼 그 경로가 의도적으로 세운 값이 있다.
  const original = new Response("body", {
    status: 200,
    headers: {
      "cache-control": "no-store, max-age=0",
      "referrer-policy": "same-origin",
    },
  });

  const wrapped = withSecurityHeaders(original, off);

  assert.equal(wrapped.headers.get("cache-control"), "no-store, max-age=0");
  assert.equal(wrapped.headers.get("referrer-policy"), "same-origin");
  assert.equal(wrapped.headers.get("x-frame-options"), "DENY");
});

test("상태 코드와 본문을 보존한다", async () => {
  const wrapped = withSecurityHeaders(
    new Response("not found", { status: 404, statusText: "Not Found" }),
    off,
  );

  assert.equal(wrapped.status, 404);
  assert.equal(await wrapped.text(), "not found");
});
