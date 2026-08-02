import assert from "node:assert/strict";
import test from "node:test";
import {
  consumeKakaoImportWithBindings,
  KakaoImportError,
  storeKakaoImportWithBindings,
} from "../app/lib/kakao-import.ts";

function createMemoryDb() {
  const rows = new Map();

  return {
    rows,
    prepare(sql) {
      let values = [];
      const statement = {
        bind(...nextValues) {
          values = nextValues;
          return statement;
        },
        async first() {
          if (sql.includes("SELECT COUNT(*) AS count")) {
            const [botUserHash, now] = values;
            const count = [...rows.values()].filter(
              (row) =>
                row.botUserHash === botUserHash &&
                row.consumedAt === null &&
                row.expiresAt > now,
            ).length;
            return { count };
          }

          if (sql.includes("UPDATE kakao_cart_imports")) {
            const [consumedAt, tokenHash, now] = values;
            const row = rows.get(tokenHash);
            if (!row || row.consumedAt !== null || row.expiresAt <= now) {
              return null;
            }
            row.consumedAt = consumedAt;
            return {
              encrypted_url: row.encryptedUrl,
              encryption_iv: row.encryptionIv,
            };
          }
          return null;
        },
        async run() {
          if (sql.startsWith("INSERT INTO kakao_cart_imports")) {
            const [
              tokenHash,
              encryptedUrl,
              encryptionIv,
              botUserHash,
              createdAt,
              expiresAt,
            ] = values;
            rows.set(tokenHash, {
              encryptedUrl,
              encryptionIv,
              botUserHash,
              createdAt,
              expiresAt,
              consumedAt: null,
            });
          } else if (sql.includes("WHERE token_hash = ?")) {
            rows.delete(values[0]);
          } else if (sql.startsWith("DELETE FROM kakao_cart_imports")) {
            const [now] = values;
            for (const [tokenHash, row] of rows) {
              if (row.expiresAt <= now || row.consumedAt !== null) {
                rows.delete(tokenHash);
              }
            }
          }
          return { success: true };
        },
      };
      return statement;
    },
  };
}

test("카카오 보안이미지 주소를 암호화하고 링크를 한 번만 연다", async () => {
  const db = createMemoryDb();
  const bindings = {
    DB: db,
    // 세 용도는 각자의 키를 쓴다. 같은 값을 재사용하면 resolve 가 거부한다.
    KAKAO_SKILL_TOKEN: "test-skill-token",
    KAKAO_URL_ENCRYPTION_KEY: "test-url-encryption-key",
    KAKAO_USER_HASH_PEPPER: "test-user-hash-pepper",
  };
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
