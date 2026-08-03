import assert from "node:assert/strict";
import test from "node:test";

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
const workerPromise = import(workerUrl.href).then((module) => module.default);

async function callImport({ method = "POST", headers = {}, body } = {}) {
  const worker = await workerPromise;
  return worker.fetch(
    new Request("https://cherrypicker.co.kr/api/kakao/import", {
      method,
      headers: {
        "x-forwarded-host": "cherrypicker.co.kr",
        "x-forwarded-proto": "https",
        ...headers,
      },
      body,
    }),
    { ASSETS: { fetch: async () => new Response("nf", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("토큰을 쿼리스트링으로 받는 GET 경로는 사라졌다", async () => {
  // 쿼리스트링은 edge·origin 로그에 전체 URI 로 기록된다.
  // 일회용 토큰이라도 소비되기 전까지는 그 로그에서 살아 있다.
  const response = await callImport({ method: "GET" });
  assert.ok(
    response.status === 404 || response.status === 405,
    `GET 은 더 이상 지원하지 않아야 한다 (받은 상태: ${response.status})`,
  );
});

test("JSON 이 아닌 교환 요청은 거부한다", async () => {
  const response = await callImport({
    headers: { "content-type": "text/plain" },
    body: "token=abc",
  });
  assert.equal(response.status, 415);
});

test("교차 출처에서 온 교환 요청은 거부한다", async () => {
  const response = await callImport({
    headers: {
      "content-type": "application/json",
      "sec-fetch-site": "cross-site",
    },
    body: JSON.stringify({ token: "x".repeat(43) }),
  });
  assert.equal(response.status, 403);
});

test("동일 출처 요청은 Fetch Metadata 단계를 통과한다", async () => {
  // 토큰 자체가 1차 방어다. Fetch Metadata 는 보조이며,
  // 헤더를 보내지 않는 브라우저를 막지 않는다.
  for (const site of ["same-origin", "same-site", undefined]) {
    const response = await callImport({
      headers: {
        "content-type": "application/json",
        ...(site ? { "sec-fetch-site": site } : {}),
      },
      body: JSON.stringify({ token: "x".repeat(43) }),
    });
    assert.notEqual(
      response.status,
      403,
      `sec-fetch-site=${site ?? "(없음)"} 는 통과해야 한다`,
    );
  }
});

test("본문에 토큰이 없으면 통과시키지 않는다", async () => {
  const response = await callImport({
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  assert.ok(response.status >= 400, "토큰 없는 요청은 성공하면 안 된다");
});
