/**
 * 비밀값·운영 설정 binding 의 **이름과 타입만** 선언한다.
 *
 * `wrangler types` 가 생성하는 `worker-configuration.d.ts` 는 wrangler.jsonc
 * 에 적힌 binding 만 안다. 그런데 secret 과 운영 플래그의 실제 값을 버전
 * 관리되는 설정 파일에 적을 수는 없다 — 그러면 저장소에 평문 비밀값이
 * 들어간다. 그래서 값은 secret binding·배포 환경에서 주입하고, 타입만
 * 이 파일에서 declaration merging 으로 보강한다.
 *
 * 이 선언은 **런타임 검증을 대체하지 않는다.** 타입이 있다고 값이 주입된
 * 것은 아니므로, 소비 지점은 여전히 부재를 fail-closed 로 처리해야 한다.
 * (app/lib/runtime-flags.ts 의 parseFlag, app/lib/kakao-import.ts 의
 * secret 부재 검사가 그 역할을 한다.)
 *
 * 이 파일은 생성물이 아니라 손으로 관리한다. binding 을 추가하면 여기에도
 * 이름을 추가해야 한다.
 */
declare namespace Cloudflare {
  interface Env {
    /** `/admin` 접근을 허용할 ChatGPT 계정 이메일(쉼표 구분). */
    ADMIN_EMAILS?: string;
    /** 카카오 오픈빌더 스킬과 공유하는 장기 secret. */
    KAKAO_SKILL_TOKEN?: string;
    /** 메타데이터·robots·sitemap 의 canonical origin. */
    NEXT_PUBLIC_SITE_URL?: string;

    /** 운영 기능 플래그. 정확히 "true" 일 때만 켜진다. */
    MONETIZATION_ENABLED?: string;
    KAKAO_IMPORT_ENABLED?: string;
    ALCOHOL_COMMERCE_ENABLED?: string;
    TELEMETRY_ENABLED?: string;
    AUTO_CONFIRM_ENABLED?: string;
    ADMIN_UI_ENABLED?: string;

    /** AdSense. MONETIZATION_ENABLED 가 켜졌을 때만 읽는다. */
    ADSENSE_CLIENT?: string;
    ADSENSE_SLOT_HOME_CONTENT?: string;
  }
}
