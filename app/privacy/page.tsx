import type { Metadata } from "next";
import { StaticPage } from "../components/static-page";

export const metadata: Metadata = {
  title: "개인정보처리방침 — 체리피커",
  description:
    "체리피커의 브라우저 저장정보, 외부 링크, 광고 쿠키 처리 방침입니다.",
};

export default function PrivacyPage() {
  return (
    <StaticPage
      eyebrow="PRIVACY"
      title="개인정보처리방침"
      description="현재 프로토타입에서 처리하는 정보와 향후 광고 기능이 활성화될 때의 데이터 사용 원칙을 안내합니다."
    >
      <section>
        <h2>현재 수집하는 정보</h2>
        <p>
          체리피커는 현재 회원가입 기능을 제공하지 않으며 이름, 주소,
          결제정보를 직접 수집하지 않습니다. 사용자가 가격 등록 기능에 입력한
          상품 URL, 가격, 배송비, 할인, 용량 정보는 해당 기기의 브라우저
          저장소에만 저장되며 서버로 전송되지 않습니다.
        </p>
      </section>

      <section>
        <h2>자동으로 처리될 수 있는 기술 정보</h2>
        <p>
          사이트 제공과 보안을 위해 호스팅 사업자가 접속 시각, 요청 경로,
          브라우저 종류, IP 주소 등 일반적인 접속 기록을 제한적으로 처리할 수
          있습니다. 이 정보는 장애 대응과 서비스 보안을 위해 사용될 수
          있습니다.
        </p>
      </section>

      <section>
        <h2>Google 광고와 쿠키</h2>
        <p>
          AdSense가 활성화되면 Google을 포함한 제3자 제공업체가 이전 방문
          기록을 바탕으로 광고를 제공하기 위해 쿠키를 사용할 수 있습니다.
          Google의 광고 쿠키를 통해 이 사이트 또는 다른 사이트 방문 기록을
          기반으로 광고가 표시될 수 있습니다.
        </p>
        <p>
          사용자는{" "}
          <a href="https://adssettings.google.com/" target="_blank" rel="noreferrer">
            Google 광고 설정
          </a>
          에서 맞춤 광고를 관리하거나 사용 중지할 수 있습니다. 유럽경제지역,
          영국, 스위스 방문자에게 맞춤 광고를 제공할 때는 Google이 인증한
          동의 관리 기능을 적용합니다.
        </p>
      </section>

      <section>
        <h2>외부 판매처 링크</h2>
        <p>
          쿠팡, 네이버, 면세점 등 외부 사이트로 이동한 뒤 처리되는 개인정보와
          결제정보에는 해당 판매처의 개인정보처리방침이 적용됩니다. 체리피커는
          외부 판매처의 로그인 정보나 결제정보를 받지 않습니다.
        </p>
      </section>

      <section>
        <h2>사용자 선택과 삭제</h2>
        <p>
          브라우저에 저장된 직접 등록 가격은 가격 계산 표에서 개별 삭제하거나
          브라우저의 사이트 데이터 삭제 기능으로 모두 지울 수 있습니다.
          개인정보 처리 방식이 달라질 경우 이 페이지의 업데이트 날짜와 함께
          변경 내용을 공개합니다.
        </p>
      </section>
    </StaticPage>
  );
}
