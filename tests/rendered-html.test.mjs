import assert from "node:assert/strict";
import test from "node:test";

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
const workerPromise = import(workerUrl.href).then((module) => module.default);

async function request(pathname) {
  const worker = await workerPromise;

  return worker.fetch(
    new Request(`https://oiso.example${pathname}`, {
      headers: {
        accept: "text/html",
        "x-forwarded-host": "oiso.example",
        "x-forwarded-proto": "https",
      },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("OISO KOREA 홈을 서버 렌더링한다", async () => {
  const response = await request("/");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="ko">/i);
  assert.match(html, /<title>OISO KOREA — 면세·리테일 실구매가 비교<\/title>/i);
  assert.match(html, /가격 보이소/);
  assert.match(html, /기본 상품은 기능 설명을 위한 예시 가격입니다/);
  assert.doesNotMatch(html, /Starter Project|Your site is taking shape/);
  assert.doesNotMatch(html, /salkka-dutyfree|\/Users\//);
});

test("현재 요청 호스트로 robots와 sitemap URL을 생성한다", async () => {
  const robotsResponse = await request("/robots.txt");
  assert.equal(robotsResponse.status, 200);
  const robots = await robotsResponse.text();
  assert.match(robots, /Sitemap: https:\/\/oiso\.example\/sitemap\.xml/);
  assert.doesNotMatch(robots, /salkka-dutyfree/);

  const sitemapResponse = await request("/sitemap.xml");
  assert.equal(sitemapResponse.status, 200);
  const sitemap = await sitemapResponse.text();
  assert.match(sitemap, /https:\/\/oiso\.example\/guides/);
  assert.match(sitemap, /estee-lauder-anr-unit-price/);
  assert.match(sitemap, /laphroaig-10-smoky-whisky/);
  assert.doesNotMatch(sitemap, /salkka-dutyfree/);
});
