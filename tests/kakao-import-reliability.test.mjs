import assert from "node:assert/strict";
import test from "node:test";
import {
  consumeKakaoImportWithBindings,
  KakaoImportError,
  storeKakaoImportWithBindings,
} from "../app/lib/kakao-import.ts";
import { createMemoryD1, testKakaoBindings } from "./helpers/memory-d1.mjs";

const secureUrl =
  "https://secure.kakaocdn.net/dn/test/cart.jpg?signature=temporary";

function secureImage(botUserId = "test-user") {
  return { privacyAgreement: "Y", urls: [secureUrl], botUserId };
}

function imageResponse() {
  return new Response(Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]), {
    headers: { "content-type": "image/jpeg", "content-length": "4" },
  });
}

async function withFetch(impl, run) {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  try {
    return await run();
  } finally {
    globalThis.fetch = original;
  }
}

test("일시적 전송 실패가 링크를 영구히 없애지 않는다", async () => {
  // 예전에는 먼저 소비로 표시하고 finally 에서 행을 지웠다. 카카오 CDN 이
  // 한 번 흔들리기만 해도 사용자는 캡처를 다시 받을 방법이 없었다.
  const db = createMemoryD1();
  const bindings = { DB: db, ...testKakaoBindings };
  const stored = await storeKakaoImportWithBindings(secureImage(), bindings);

  await withFetch(
    async () => {
      throw new Error("network down");
    },
    async () => {
      await assert.rejects(() =>
        consumeKakaoImportWithBindings(stored.token, bindings),
      );
    },
  );

  // 링크는 살아 있어야 한다.
  assert.equal(db.rows.size, 1);

  const recovered = await withFetch(async () => imageResponse(), () =>
    consumeKakaoImportWithBindings(stored.token, bindings),
  );
  assert.equal(recovered.contentType, "image/jpeg");
  assert.equal(db.rows.size, 0);
});

test("전송에 성공한 뒤에만 소비 처리한다", async () => {
  const db = createMemoryD1();
  const bindings = { DB: db, ...testKakaoBindings };
  const stored = await storeKakaoImportWithBindings(secureImage(), bindings);

  await withFetch(
    async () => {
      // fetch 시점에는 아직 소비되지 않은 상태여야 한다.
      assert.equal([...db.rows.values()][0].consumedAt, null);
      return imageResponse();
    },
    () => consumeKakaoImportWithBindings(stored.token, bindings),
  );

  await assert.rejects(
    () => consumeKakaoImportWithBindings(stored.token, bindings),
    (error) => error instanceof KakaoImportError && error.status === 410,
  );
});

test("동시에 두 번 열어도 한 번만 전달된다", async () => {
  const db = createMemoryD1();
  const bindings = { DB: db, ...testKakaoBindings };
  const stored = await storeKakaoImportWithBindings(secureImage(), bindings);

  const results = await withFetch(async () => imageResponse(), () =>
    Promise.allSettled([
      consumeKakaoImportWithBindings(stored.token, bindings),
      consumeKakaoImportWithBindings(stored.token, bindings),
    ]),
  );

  const fulfilled = results.filter((result) => result.status === "fulfilled");
  const rejected = results.filter((result) => result.status === "rejected");
  assert.equal(fulfilled.length, 1, "전달은 한 번만 성공해야 한다");
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].reason.status, 410);
});

test("사용자별 상한은 동시 요청에서도 지켜진다", async () => {
  // 예전에는 COUNT 로 읽고 나서 INSERT 해, 동시 요청이 같은 빈자리를 보고
  // 나란히 통과했다. 이제 세는 것과 넣는 것이 한 문장이다.
  const db = createMemoryD1();
  const bindings = { DB: db, ...testKakaoBindings };

  const attempts = await Promise.allSettled(
    Array.from({ length: 6 }, () =>
      storeKakaoImportWithBindings(secureImage("same-user"), bindings),
    ),
  );

  const accepted = attempts.filter((result) => result.status === "fulfilled");
  assert.equal(accepted.length, 3, "상한 3건을 넘겨 받으면 안 된다");
  assert.equal(db.rows.size, 3);

  for (const rejection of attempts.filter((r) => r.status === "rejected")) {
    assert.equal(rejection.reason.status, 429);
  }
});

test("만료된 링크는 복호화·외부 fetch 전에 거부한다", async () => {
  const db = createMemoryD1();
  const bindings = { DB: db, ...testKakaoBindings };
  const stored = await storeKakaoImportWithBindings(secureImage(), bindings);

  // 저장된 행을 만료시킨다.
  [...db.rows.values()][0].expiresAt = Date.now() - 1;

  await withFetch(
    async () => {
      throw new Error("외부 fetch 가 일어나면 안 된다");
    },
    async () => {
      await assert.rejects(
        () => consumeKakaoImportWithBindings(stored.token, bindings),
        (error) => error instanceof KakaoImportError && error.status === 410,
      );
    },
  );
});

test("소비 시점에도 만료 행을 정리한다", async () => {
  // 예전에는 새 임포트가 들어올 때만 정리해, 아무도 새로 만들지 않으면
  // 만료 행이 계속 남았다.
  const db = createMemoryD1();
  const bindings = { DB: db, ...testKakaoBindings };

  const staleToken = await storeKakaoImportWithBindings(
    secureImage("other-user"),
    bindings,
  );
  const fresh = await storeKakaoImportWithBindings(secureImage(), bindings);
  assert.equal(db.rows.size, 2);

  // 다른 사용자의 행만 만료시킨다.
  const staleHash = await sha256Hex(staleToken.token);
  db.rows.get(staleHash).expiresAt = Date.now() - 1;

  await withFetch(async () => imageResponse(), () =>
    consumeKakaoImportWithBindings(fresh.token, bindings),
  );

  assert.equal(db.rows.size, 0, "만료 행과 소비 행이 모두 정리돼야 한다");
});

/** 저장소는 토큰 원문이 아니라 해시로 키를 잡는다. */
async function sha256Hex(value) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
