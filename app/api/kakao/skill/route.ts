import {
  KakaoImportError,
  kakaoSkillSecret,
  parseKakaoSecureImage,
  storeKakaoImport,
  verifyKakaoSkillRequest,
} from "../../../lib/kakao-import";
import {
  featureDisabledResponse,
  isFeatureEnabled,
} from "../../../lib/runtime-flags";
import { getConfiguredOrigin } from "../../../lib/site-origin";

export const dynamic = "force-dynamic";

function kakaoMessage(message: string, options?: { url?: string; title?: string }) {
  const output = options?.url
    ? {
        textCard: {
          title: options.title ?? "캡처를 받았어요",
          description: message,
          buttons: [
            {
              action: "webLink",
              label: "내 비교함에서 확인",
              webLinkUrl: options.url,
            },
          ],
        },
      }
    : { simpleText: { text: message } };

  return Response.json({
    version: "2.0",
    template: { outputs: [output] },
  });
}

export async function POST(request: Request) {
  // 플래그를 **가장 먼저** 본다. 비밀값 검증보다 앞이어야 꺼진 기능이
  // 응답 차이로 존재를 드러내지 않는다. 예전에는 이 플래그를 아무도 읽지
  // 않아, 비밀값만 설정하면 꺼둔 줄 알았던 경로가 그대로 열려 있었다.
  if (!(await isFeatureEnabled("KAKAO_IMPORT_ENABLED"))) {
    return featureDisabledResponse();
  }
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return kakaoMessage("이미지 요청 형식을 확인해주세요.");
  }

  const secret = await kakaoSkillSecret();
  if (!(await verifyKakaoSkillRequest(request, secret))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const secureImage = parseKakaoSecureImage(await request.json());
    // 사용자에게 보낼 링크이므로 요청 Host 로 만들지 않는다. 설정된
    // origin 이 없으면 링크를 만들지 않고 안내만 한다.
    const origin = await getConfiguredOrigin();
    if (!origin) {
      return kakaoMessage(
        "지금은 캡처 링크를 만들 수 없어요. 잠시 뒤 다시 시도해주세요.",
      );
    }

    const stored = await storeKakaoImport(secureImage);
    const importUrl = new URL("/", origin);
    // 토큰은 fragment 로 보낸다. 쿼리스트링은 서버에 전송되어 edge·origin
    // 로그와 분석 이벤트에 그대로 남지만, fragment 는 서버로 가지 않는다.
    // `#my-comparisons` 앵커 자리를 쓰므로 클라이언트가 소비 후 스크롤한다.
    importUrl.hash = `kakao_import=${stored.token}`;
    // 저장하는 것은 첫 장뿐이다. "첫 번째부터" 라고 쓰면 나머지도
    // 이어서 처리되는 것처럼 읽힌다.
    const countNotice =
      stored.imageCount > 1
        ? ` 여러 장을 보내셨는데 첫 번째 캡처 한 장만 확인합니다.`
        : "";

    return kakaoMessage(
      `2분 안에 한 번 열 수 있어요.${countNotice} 체리피커는 이미지 파일을 저장하지 않으며, 상품·판매처·가격만 기기 안에서 확인합니다.`,
      { url: importUrl.toString() },
    );
  } catch (error) {
    const message =
      error instanceof KakaoImportError
        ? error.message
        : "캡처를 받지 못했습니다. 잠시 뒤 다시 시도해주세요.";
    return kakaoMessage(message);
  }
}
