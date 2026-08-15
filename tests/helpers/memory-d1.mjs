/**
 * `kakao_cart_imports` 테이블만 흉내 내는 최소 D1 대역.
 *
 * 실제 D1 하네스(DEPLOY-01a0)가 생기기 전까지 임포트 수명주기를 검증하는
 * 용도다. 문장 텍스트로 분기하므로 SQL 이 바뀌면 여기도 함께 고쳐야 한다 —
 * 그 결합은 의도적이다. 조용히 통과하는 대역보다 같이 깨지는 편이 낫다.
 *
 * `meta.changes` 를 실제와 같은 의미로 돌려주는 것이 핵심이다. 여기에
 * 의존하는 코드(사용자별 상한, 소비 선점)가 이 값으로 경쟁을 판정한다.
 */
export function createMemoryD1() {
  const rows = new Map();

  function matchesLive(row, now) {
    return row.consumedAt === null && row.expiresAt > now;
  }

  return {
    rows,
    prepare(sql) {
      let values = [];
      const statement = {
        bind(...next) {
          values = next;
          return statement;
        },

        async first() {
          if (sql.includes("SELECT encrypted_url, encryption_iv")) {
            const [tokenHash, now] = values;
            const row = rows.get(tokenHash);
            if (!row || !matchesLive(row, now)) return null;
            return {
              encrypted_url: row.encryptedUrl,
              encryption_iv: row.encryptionIv,
            };
          }
          return null;
        },

        async run() {
          // 사용자별 상한을 확인하며 넣는 단일 문장.
          if (sql.startsWith("INSERT INTO kakao_cart_imports")) {
            const [
              tokenHash,
              encryptedUrl,
              encryptionIv,
              botUserHash,
              createdAt,
              expiresAt,
              quotaBotUserHash,
              quotaNow,
              limit,
            ] = values;

            const active = [...rows.values()].filter(
              (row) =>
                row.botUserHash === quotaBotUserHash && matchesLive(row, quotaNow),
            ).length;
            if (active >= limit) return { meta: { changes: 0 }, success: true };

            rows.set(tokenHash, {
              encryptedUrl,
              encryptionIv,
              botUserHash,
              createdAt,
              expiresAt,
              consumedAt: null,
            });
            return { meta: { changes: 1 }, success: true };
          }

          // 소비 선점. 이미 소비됐거나 만료면 0 건이다.
          if (sql.includes("UPDATE kakao_cart_imports")) {
            const [consumedAt, tokenHash, now] = values;
            const row = rows.get(tokenHash);
            if (!row || !matchesLive(row, now)) {
              return { meta: { changes: 0 }, success: true };
            }
            row.consumedAt = consumedAt;
            return { meta: { changes: 1 }, success: true };
          }

          if (sql.includes("DELETE FROM kakao_cart_imports")) {
            if (sql.includes("WHERE token_hash = ?")) {
              const removed = rows.delete(values[0]);
              return { meta: { changes: removed ? 1 : 0 }, success: true };
            }
            // 만료·소비 행 정리
            const [now] = values;
            let changes = 0;
            for (const [tokenHash, row] of rows) {
              if (row.expiresAt <= now || row.consumedAt !== null) {
                rows.delete(tokenHash);
                changes += 1;
              }
            }
            return { meta: { changes }, success: true };
          }

          return { meta: { changes: 0 }, success: true };
        },
      };
      return statement;
    },
  };
}

export const testKakaoBindings = {
  // 세 용도는 각자의 키를 쓴다. 같은 값을 재사용하면 resolve 가 거부한다.
  KAKAO_SKILL_TOKEN: "test-skill-token",
  KAKAO_URL_ENCRYPTION_KEY: "test-url-encryption-key",
  KAKAO_USER_HASH_PEPPER: "test-user-hash-pepper",
};
