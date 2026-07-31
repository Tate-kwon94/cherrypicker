import assert from "node:assert/strict";
import test from "node:test";
import {
  isAllowedKakaoImageUrl,
  KakaoImportError,
  parseKakaoSecureImage,
} from "../app/lib/kakao-import.ts";

const secureUrl =
  "http://secure.kakaocdn.net/dn/example/image.jpg?signature=signed-value";

test("카카오 보안이미지 플러그인 값을 파싱한다", () => {
  const result = parseKakaoSecureImage({
    action: {
      params: {
        secureimage: JSON.stringify({
          privacyAgreement: "Y",
          imageQuantity: "1",
          secureUrls: `List(${secureUrl})`,
          expire: "2026-08-01T00:10:00Z",
        }),
      },
    },
    userRequest: {
      user: {
        id: "fallback-user-id",
        properties: { plusfriendUserKey: "channel-user-id" },
      },
    },
  });

  assert.deepEqual(result, {
    privacyAgreement: "Y",
    urls: [secureUrl],
    botUserId: "channel-user-id",
  });
});

test("detailParams 형식과 여러 이미지도 읽되 카카오 CDN만 허용한다", () => {
  const secondUrl = "https://thumb.kakaocdn.net/second.webp?signature=two";
  const result = parseKakaoSecureImage({
    action: {
      detailParams: {
        secureimage: {
          value: JSON.stringify({
            privacyAgreement: "Y",
            secureUrls: `List(${secureUrl}, ${secondUrl})`,
          }),
        },
      },
    },
    userRequest: { user: { id: "bot-user" } },
  });

  assert.deepEqual(result.urls, [secureUrl, secondUrl]);
  assert.equal(result.botUserId, "bot-user");
  assert.equal(isAllowedKakaoImageUrl("https://secure.kakaocdn.net/a.jpg"), true);
  assert.equal(isAllowedKakaoImageUrl("https://kakaocdn.net.evil.test/a.jpg"), false);
  assert.equal(isAllowedKakaoImageUrl("https://user@secure.kakaocdn.net/a.jpg"), false);
});

test("별도 동의가 없거나 외부 URL이면 거부한다", () => {
  assert.throws(
    () =>
      parseKakaoSecureImage({
        action: {
          params: {
            secureimage: JSON.stringify({
              privacyAgreement: "N",
              secureUrls: `List(${secureUrl})`,
            }),
          },
        },
      }),
    KakaoImportError,
  );

  assert.throws(
    () =>
      parseKakaoSecureImage({
        action: {
          params: {
            secureimage: JSON.stringify({
              privacyAgreement: "Y",
              secureUrls: "List(https://example.com/private.jpg)",
            }),
          },
        },
      }),
    /카카오 보안이미지 주소/,
  );
});
