import type { Metadata } from "next";
import { StaticPage } from "../components/static-page";

export const metadata: Metadata = {
  title: "가격정보 제공 동의 — 체리피커",
  description:
    "개인 비교 가격을 익명 가격정보로 제공할 때의 선택 항목과 처리 원칙입니다.",
};

export default function PriceContributionPage() {
  return (
    <StaticPage
      eyebrow="OPTIONAL PRICE CONTRIBUTION"
      title="가격정보 제공 동의"
      description="개인 비교와 공개 가격정보 제공은 분리됩니다. 이 동의는 선택 사항이며 동의하지 않아도 가격 비교를 이용할 수 있습니다."
    >
      <section>
        <h2>현재 상태</h2>
        <p>
          현재 파일럿은 가격정보 제공을 받지 않습니다. 장바구니 캡처와 직접
          입력 가격은 현재 비교에만 사용되며 공개 데이터로 전송되지 않습니다.
        </p>
      </section>

      <section>
        <h2>향후 제공을 선택할 때 수집할 정보</h2>
        <ul>
          <li>상품 식별정보, 옵션, 수량</li>
          <li>판매처, 최종 가격, 배송비·할인 조건</li>
          <li>가격을 확인한 날짜와 시각</li>
        </ul>
        <p>
          이름, 연락처, 주소, 주문번호, 회원번호, 결제정보와 원본 캡처는
          제공 대상에 포함하지 않습니다.
        </p>
      </section>

      <section>
        <h2>선택 방식</h2>
        <p>
          제공 기능을 시작할 때에는 미리 선택된 체크박스를 사용하지 않고,
          비교가 끝난 뒤 사용자가 직접 ‘익명 가격정보 제공’을 선택하도록
          합니다. 동의하지 않아도 비교 결과와 내 비교함 기능에는 제한이
          없습니다.
        </p>
      </section>

      <section>
        <h2>공개와 보관 원칙</h2>
        <p>
          제공된 값은 개인을 식별할 수 없도록 검수한 뒤 가격·판매처·확인일
          중심으로만 사용합니다. 오류 정정과 철회 절차, 구체적인 보관기간은
          기능 출시 전에 이 문서와 동의 화면에 명시합니다.
        </p>
      </section>
    </StaticPage>
  );
}
