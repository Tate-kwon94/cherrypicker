import assert from "node:assert/strict";
import test from "node:test";
import {
  isAllowedKakaoImageUrl,
  resolveKakaoSecrets,
} from "../app/lib/kakao-import.ts";

const complete = {
  KAKAO_SKILL_TOKEN: "skill-token-value",
  KAKAO_URL_ENCRYPTION_KEY: "url-encryption-key-value",
  KAKAO_USER_HASH_PEPPER: "user-hash-pepper-value",
};

test("세 비밀값이 모두 있을 때만 임포트를 연다", () => {
  assert.deepEqual(resolveKakaoSecrets(complete), {
    skillToken: "skill-token-value",
    urlEncryptionKey: "url-encryption-key-value",
    userHashPepper: "user-hash-pepper-value",
  });

  for (const missing of Object.keys(complete)) {
    const partial = { ...complete };
    delete partial[missing];
    assert.equal(
      resolveKakaoSecrets(partial),
      null,
      `${missing} 없이 열리면 안 된다`,
    );
  }

  assert.equal(resolveKakaoSecrets(null), null);
  assert.equal(resolveKakaoSecrets({}), null);
});

test("같은 값을 재사용하면 분리한 의미가 없으므로 거부한다", () => {
  // 예전에는 KAKAO_SKILL_TOKEN 하나가 bearer·AES 키·해시 pepper 를 겸했다.
  // 인증 토큰이 유출되면 저장 URL 복호화와 사용자 해시까지 함께 열렸다.
  const reused = {
    KAKAO_SKILL_TOKEN: "same",
    KAKAO_URL_ENCRYPTION_KEY: "same",
    KAKAO_USER_HASH_PEPPER: "different",
  };
  assert.equal(resolveKakaoSecrets(reused), null);

  const allSame = {
    KAKAO_SKILL_TOKEN: "same",
    KAKAO_URL_ENCRYPTION_KEY: "same",
    KAKAO_USER_HASH_PEPPER: "same",
  };
  assert.equal(resolveKakaoSecrets(allSame), null);
});

test("빈 문자열은 값이 있는 것으로 보지 않는다", () => {
  assert.equal(
    resolveKakaoSecrets({ ...complete, KAKAO_URL_ENCRYPTION_KEY: "" }),
    null,
  );
  assert.equal(
    resolveKakaoSecrets({ ...complete, KAKAO_USER_HASH_PEPPER: "   " }),
    null,
  );
});

test("캡처 이미지는 HTTPS 로만 가져온다", () => {
  // 사적인 장바구니 캡처를 평문 경로로 받지 않는다.
  assert.equal(
    isAllowedKakaoImageUrl("https://dn.kakaocdn.net/secure/abc"),
    true,
  );
  assert.equal(
    isAllowedKakaoImageUrl("http://dn.kakaocdn.net/secure/abc"),
    false,
  );
});

test("허용 호스트 밖이거나 자격증명이 붙은 주소는 거부한다", () => {
  for (const url of [
    "https://evil.example.com/secure/abc",
    "https://kakaocdn.net.evil.com/abc",
    "https://user:pw@dn.kakaocdn.net/abc",
    "https://dn.kakaocdn.net:8443/abc",
    "not a url",
  ]) {
    assert.equal(isAllowedKakaoImageUrl(url), false, `${url} 는 거부해야 한다`);
  }
});
