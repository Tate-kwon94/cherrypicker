import assert from "node:assert/strict";
import test from "node:test";
import {
  consumeKakaoImportWithBindings,
  KakaoImportError,
  storeKakaoImportWithBindings,
} from "../app/lib/kakao-import.ts";
import { createMemoryD1, testKakaoBindings } from "./helpers/memory-d1.mjs";

test("카카오 보안이미지 주소를 암호화하고 링크를 한 번만 연다", async () => {
  const db = createMemoryD1();
  const bindings = { DB: db, ...testKakaoBindings };
  const secureUrl =
    "https://secure.kakaocdn.net/dn/test/cart.jpg?signature=temporary";
  const stored = await storeKakaoImportWithBindings(
    {
      privacyAgreement: "Y",
      urls: [secureUrl],
      botUserId: "test-user",
    },
    bindings,
  );

  assert.match(stored.token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(db.rows.size, 1);
  assert.equal(JSON.stringify([...db.rows.values()]).includes(secureUrl), false);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (request) => {
    assert.equal(String(request), secureUrl);
    return new Response(Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]), {
      headers: {
        "content-type": "image/jpeg",
        "content-length": "4",
      },
    });
  };

  try {
    const first = await consumeKakaoImportWithBindings(stored.token, bindings);
    assert.equal(first.contentType, "image/jpeg");
    assert.deepEqual(
      [...new Uint8Array(first.bytes)],
      [0xff, 0xd8, 0xff, 0xd9],
    );
    assert.equal(db.rows.size, 0);

    await assert.rejects(
      () => consumeKakaoImportWithBindings(stored.token, bindings),
      (error) =>
        error instanceof KakaoImportError &&
        error.status === 410 &&
        /이미 사용/.test(error.message),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
