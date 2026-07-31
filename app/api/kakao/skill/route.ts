import {
  KakaoImportError,
  kakaoSkillSecret,
  parseKakaoSecureImage,
  storeKakaoImport,
  verifyKakaoSkillRequest,
} from "../../../lib/kakao-import";

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
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return kakaoMessage("이미지 요청 형식을 확인해주세요.");
  }

  const secret = await kakaoSkillSecret();
  if (!(await verifyKakaoSkillRequest(request, secret))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const secureImage = parseKakaoSecureImage(await request.json());
    const stored = await storeKakaoImport(secureImage);
    const importUrl = new URL("/", "https://cherrypicker.co.kr");
    importUrl.searchParams.set("kakao_import", stored.token);
    importUrl.hash = "my-comparisons";
    const countNotice =
      stored.imageCount > 1 ? " 첫 번째 캡처부터 확인합니다." : "";

    return kakaoMessage(
      `10분 안에 한 번 열 수 있어요.${countNotice} 체리피커는 이미지 파일을 저장하지 않으며, 상품·판매처·가격만 기기 안에서 확인합니다.`,
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
