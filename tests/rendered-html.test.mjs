import assert from "node:assert/strict";
import test from "node:test";

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
const workerPromise = import(workerUrl.href).then((module) => module.default);

async function request(pathname) {
  const worker = await workerPromise;

  return worker.fetch(
    new Request(`https://cherrypicker.co.kr${pathname}`, {
      headers: {
        accept: "text/html",
        "x-forwarded-host": "cherrypicker.co.kr",
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

test("체리피커 홈을 서버 렌더링한다", async () => {
  const response = await request("/");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="ko">/i);
  assert.match(html, /<title>체리피커 — 면세·리테일 실구매가 비교<\/title>/i);
  assert.match(html, /가격은 비교하고/);
  assert.match(html, /좋은 것만.*cherry-pick.*픽.*하세요/);
  assert.doesNotMatch(html, /좋은 것만 고르세요/);
  assert.match(html, /검수 가격을 불러오고 있어요/);
  assert.match(html, /검수된 가격이 각각 한 건 이상 모이면/);
  assert.doesNotMatch(html, /SAMPLE COMPARISONS|예시 데이터/);
  assert.doesNotMatch(html, /지금 어떤 상황인가요/);
  assert.match(html, /상품명 검색 또는 장바구니 캡처/);
  assert.match(html, /내 비교함/);
  assert.match(html, /캡처에서 상품·판매처·가격을/);
  assert.match(html, /양쪽 가격이 모이면|검수 가격을 불러오고/);
  assert.match(html, /주류 100ml 단가/);
  assert.doesNotMatch(html, /Starter Project|Your site is taking shape/);
  assert.doesNotMatch(html, /OISO|오이소|보이소|사이소|salkka-dutyfree|\/Users\//i);
});

test("현재 요청 호스트로 robots와 sitemap URL을 생성한다", async () => {
  const robotsResponse = await request("/robots.txt");
  assert.equal(robotsResponse.status, 200);
  const robots = await robotsResponse.text();
  assert.match(robots, /Sitemap: https:\/\/cherrypicker\.co\.kr\/sitemap\.xml/);
  assert.doesNotMatch(robots, /salkka-dutyfree/);

  const sitemapResponse = await request("/sitemap.xml");
  assert.equal(sitemapResponse.status, 200);
  const sitemap = await sitemapResponse.text();
  assert.match(sitemap, /https:\/\/cherrypicker\.co\.kr\/guides/);
  assert.match(sitemap, /estee-lauder-anr-unit-price/);
  assert.match(sitemap, /laphroaig-10-smoky-whisky/);
  assert.doesNotMatch(sitemap, /salkka-dutyfree/);
});

test("가격 운영 화면은 ChatGPT 로그인을 요구한다", async () => {
  const response = await request("/admin");
  assert.ok([302, 307, 308].includes(response.status));
  assert.match(
    response.headers.get("location") ?? "",
    /\/signin-with-chatgpt\?return_to=%2Fadmin/,
  );
});

test("카카오 임시 이미지 처리 원칙을 공개한다", async () => {
  const privacyResponse = await request("/privacy");
  assert.equal(privacyResponse.status, 200);
  const privacy = await privacyResponse.text();
  assert.match(privacy, /카카오톡 보안이미지 연결/);
  assert.match(privacy, /최대 10분/);
  assert.match(privacy, /한 번만 사용할 수 있으며/);
  assert.match(privacy, /이미지 파일을 서버에.*저장하지 않고/);
  assert.match(privacy, /사용 즉시 임시 연결정보를 삭제/);
});
