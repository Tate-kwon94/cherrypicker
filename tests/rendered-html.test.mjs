import assert from "node:assert/strict";
import { readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * 이 파일은 `dist/` 를 불러 서버 렌더 결과를 검증한다. 빌드가 오래되면
 * 방금 고친 코드가 아니라 예전 산출물을 통과시키므로, 소스보다 낡은
 * 빌드는 통과가 아니라 실패로 처리한다.
 */
function assertFreshBuild() {
  const bundle = join(repoRoot, "dist", "server", "index.js");
  let builtAt;
  try {
    builtAt = statSync(bundle).mtimeMs;
  } catch {
    assert.fail("dist 빌드가 없습니다. `npm run build` 를 먼저 실행하세요.");
  }

  let newestSource = 0;
  let newestPath = "";
  const stack = [join(repoRoot, "app"), join(repoRoot, "worker"), join(repoRoot, "db")];
  while (stack.length > 0) {
    const dir = stack.pop();
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (/\.(ts|tsx|css)$/.test(entry.name)) {
        const at = statSync(full).mtimeMs;
        if (at > newestSource) {
          newestSource = at;
          newestPath = full.slice(repoRoot.length + 1);
        }
      }
    }
  }

  assert.ok(
    builtAt >= newestSource,
    `dist 빌드가 소스보다 낡았습니다 (${newestPath} 이후 다시 빌드되지 않음). ` +
      "`npm run build` 를 먼저 실행하세요.",
  );
}

assertFreshBuild();

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
const workerPromise = import(workerUrl.href).then((module) => module.default);

async function request(pathname, host = "cherrypicker.co.kr") {
  const worker = await workerPromise;

  return worker.fetch(
    new Request(`https://${host}${pathname}`, {
      headers: {
        accept: "text/html",
        "x-forwarded-host": host,
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
  assert.match(html, /캡처에서 상품·판매처·가격을/);
  assert.match(html, /양쪽 가격이 모이면|검수 가격을 불러오고/);
  assert.match(html, /주류 100ml 단가/);
  assert.doesNotMatch(html, /Starter Project|Your site is taking shape/);
  assert.doesNotMatch(html, /OISO|오이소|보이소|사이소|salkka-dutyfree|\/Users\//i);
});

test("검수 가격이 0건이면 공개 추천도 예시 가격도 만들지 않는다", async () => {
  // D1 바인딩 없이 렌더하므로 publishedOffers·capturedOffers가 모두 비어 있다.
  // 이 상태에서 예전에는 하드코딩 fixture가 비교표를 채웠고, fixture를 그냥
  // 제거하면 offers[0]/offers[1] 폴백이 undefined가 되어 렌더 전에 터졌다.
  const response = await request("/");
  assert.equal(response.status, 200);

  const html = await response.text();

  // 예외 없이 pending 카드가 나온다.
  assert.match(html, /comparison-pending-card/);
  assert.match(html, /검수된 가격이 각각 한 건 이상 모이면/);
  assert.match(html, /class="quick-decision pending"/);

  // 공개 헤드라인·결정 카드는 만들어지지 않는다.
  // (pending 변형과 구분하려면 실제 헤드라인 마커를 봐야 한다.)
  assert.doesNotMatch(html, /quick-decision-title/);
  assert.doesNotMatch(html, /decision-options/);
  assert.doesNotMatch(html, /cherry-pick-badge/);

  // 하드코딩 fixture의 판매처 문구가 공개 경로로 새지 않는다.
  assert.doesNotMatch(html, /온라인 면세 예시/);
  assert.doesNotMatch(html, /예시 가격/);
  assert.doesNotMatch(html, /픽업 예시가/);

  // 검수 가격이 없으면 금액 자체가 표시되지 않는다.
  assert.deepEqual(html.match(/[0-9,]+원/g), null);
});

test("수익화 플래그가 꺼져 있으면 광고 표면이 SSR에 없다", async () => {
  // 기본값은 fail-closed 다. 플래그를 켜지 않은 상태가 곧 차단 상태여야 한다.
  const html = await (await request("/")).text();

  assert.doesNotMatch(html, /pagead2\.googlesyndication\.com/);
  assert.doesNotMatch(html, /adsbygoogle/);
  assert.doesNotMatch(html, /class="ad-placement"/);
  assert.doesNotMatch(html, /rel="noreferrer sponsored"/);
});

test("수익화 플래그를 켜야만 광고 표면이 나타난다", async () => {
  const previous = {
    MONETIZATION_ENABLED: process.env.MONETIZATION_ENABLED,
    ADSENSE_CLIENT: process.env.ADSENSE_CLIENT,
    ADSENSE_SLOT_HOME_CONTENT: process.env.ADSENSE_SLOT_HOME_CONTENT,
  };
  process.env.MONETIZATION_ENABLED = "true";
  process.env.ADSENSE_CLIENT = "ca-pub-0000000000000000";
  process.env.ADSENSE_SLOT_HOME_CONTENT = "1234567890";

  try {
    const html = await (await request("/")).text();

    assert.match(html, /pagead2\.googlesyndication\.com/);
    assert.match(html, /ca-pub-0000000000000000/);
    assert.match(html, /class="ad-placement"/);
    assert.match(html, /rel="noreferrer sponsored"/);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("플래그 값이 오타이면 켜지지 않는다", async () => {
  const previous = process.env.MONETIZATION_ENABLED;
  process.env.MONETIZATION_ENABLED = "ture";
  process.env.ADSENSE_CLIENT = "ca-pub-0000000000000000";

  try {
    const html = await (await request("/")).text();
    assert.doesNotMatch(html, /pagead2\.googlesyndication\.com/);
    assert.doesNotMatch(html, /class="ad-placement"/);
  } finally {
    if (previous === undefined) delete process.env.MONETIZATION_ENABLED;
    else process.env.MONETIZATION_ENABLED = previous;
    delete process.env.ADSENSE_CLIENT;
  }
});

test("검수 가격이 없으면 내 비교함 링크를 렌더하지 않는다", async () => {
  // 저장 요약은 체리픽 블록 안에서만 나오므로, 저장한 선택이 없을 때
  // 헤더에 링크를 두면 갈 곳이 없는 죽은 앵커가 된다.
  const html = await (await request("/")).text();
  assert.doesNotMatch(html, /href="#my-comparisons"/);
});

test("모든 응답이 공통 보안 헤더를 통과한다", async () => {
  // 이 저장소에는 헤더 설정 지점이 아예 없었다. Worker 의 두 반환 경로가
  // 모두 같은 helper 를 지나는지 실제 응답으로 확인한다.
  for (const path of ["/", "/privacy", "/robots.txt"]) {
    const response = await request(path);

    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
    assert.equal(response.headers.get("x-frame-options"), "DENY");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.match(
      response.headers.get("content-security-policy-report-only") ?? "",
      /frame-ancestors 'none'/,
      `${path} 에 CSP 가 없다`,
    );
    // 수익화가 꺼져 있으므로 정책도 광고를 허용하지 않아야 한다.
    assert.doesNotMatch(
      response.headers.get("content-security-policy-report-only") ?? "",
      /googlesyndication/,
    );
  }
});

test("설정된 origin 으로 robots와 sitemap URL을 생성한다", async () => {
  const previous = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.NEXT_PUBLIC_SITE_URL = "https://cherrypicker.co.kr";
  try {
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
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = previous;
  }
});

test("위조된 Host 로 요청해도 canonical URL 이 오염되지 않는다", async () => {
  // NEXT_PUBLIC_SITE_URL 이 설정되지 않은 이 환경에서는 요청 Host 를
  // canonical 주소로 굳히지 않아야 한다. 예전에는 Host 폴백 때문에
  // sitemap 전체가 공격자 도메인으로 채워질 수 있었다.
  const robots = await (await request("/robots.txt", "evil.example.com")).text();
  assert.doesNotMatch(robots, /evil\.example\.com/);
  // 설정 origin 이 없으면 절대 URL 대신 상대 경로를 낸다.
  assert.match(robots, /Sitemap: \/sitemap\.xml/);
  assert.match(robots, /Disallow.*\/admin/s);

  const sitemap = await (await request("/sitemap.xml", "evil.example.com")).text();
  assert.doesNotMatch(sitemap, /evil\.example\.com/);
});

test("상품 이미지는 최적화 엔드포인트를 거치지 않고 직접 서빙된다", async () => {
  // vinext 는 images.unoptimized 를 무시하므로, 래퍼로 우회하지 않으면
  // 정적 상품컷이 IMAGES 바인딩에 의존하는 /_vinext/image 로 샌다.
  const html = await (await request("/")).text();
  assert.doesNotMatch(html, /_vinext\/image/);
  assert.match(html, /src="\/products\//);
});

test("가격 운영 화면은 켜져 있을 때 ChatGPT 로그인을 요구한다", async () => {
  const previous = process.env.ADMIN_UI_ENABLED;
  process.env.ADMIN_UI_ENABLED = "true";
  try {
    const response = await request("/admin");
    assert.ok([302, 307, 308].includes(response.status));
    assert.match(
      response.headers.get("location") ?? "",
      /\/signin-with-chatgpt\?return_to=%2Fadmin/,
    );
  } finally {
    if (previous === undefined) delete process.env.ADMIN_UI_ENABLED;
    else process.env.ADMIN_UI_ENABLED = previous;
  }
});

test("가격 운영 화면은 꺼져 있으면 로그인 리다이렉트조차 하지 않는다", async () => {
  // 인증을 먼저 실행하면 리다이렉트 자체가 "여기 뭔가 있다"를 알려준다.
  const response = await request("/admin");
  assert.equal(response.status, 404);
});

test("카카오 임시 이미지 처리 원칙을 공개한다", async () => {
  const privacyResponse = await request("/privacy");
  assert.equal(privacyResponse.status, 200);
  const privacy = await privacyResponse.text();
  assert.match(privacy, /카카오톡 보안이미지 연결/);
  assert.match(privacy, /최대 2분/);
  assert.match(privacy, /한 번만 사용할 수 있으며/);
  assert.match(privacy, /이미지 파일을 서버에.*저장하지 않고/);
  assert.match(privacy, /사용 즉시 임시 연결정보를 삭제/);
});

test("인라인 부트스트랩 스크립트가 응답 정책의 nonce를 달고 나온다", async () => {
  // nonce 는 주장이 아니라 측정할 것이다. 정책에만 적고 스크립트에 찍히지
  // 않으면, `'unsafe-inline'` 을 뺀 순간 앱이 흰 화면이 된다.
  const response = await request("/");
  const html = await response.text();
  const policy =
    response.headers.get("content-security-policy") ??
    response.headers.get("content-security-policy-report-only");

  const scriptSrc = policy
    .split(";")
    .map((directive) => directive.trim())
    .find((directive) => directive.startsWith("script-src"));

  const nonce = scriptSrc.match(/'nonce-([^']+)'/)?.[1];
  assert.ok(nonce, `script-src 에 nonce 가 없습니다: ${scriptSrc}`);

  // script-src 가 nonce 를 쓰면 'unsafe-inline' 은 함께 있으면 안 된다.
  // 둘이 같이 있으면 nonce 없는 인라인 스크립트도 그대로 실행된다.
  // (style-src 의 'unsafe-inline' 은 별개 문제라 여기서 보지 않는다.)
  assert.equal(scriptSrc.includes("'unsafe-inline'"), false);

  const inlineScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>/g)].map(
    (match) => match[1],
  );
  assert.ok(inlineScripts.length > 0, "인라인 스크립트가 없습니다");
  for (const attributes of inlineScripts) {
    assert.ok(
      attributes.includes(`nonce="${nonce}"`),
      `nonce 없는 인라인 스크립트가 있습니다: <script${attributes}>`,
    );
  }
});

test("nonce는 요청마다 다르다", async () => {
  const read = async () => {
    const response = await request("/");
    const policy =
      response.headers.get("content-security-policy") ??
      response.headers.get("content-security-policy-report-only");
    return policy.match(/'nonce-([^']+)'/)?.[1];
  };

  const [first, second] = await Promise.all([read(), read()]);
  assert.ok(first && second);
  // 재사용하면 공격자가 미리 알 수 있어 nonce 의 의미가 사라진다.
  assert.notEqual(first, second);
});
