import type { Metadata } from "next";
import { StaticPage } from "../components/static-page";

export const metadata: Metadata = {
  title: "이용약관 — OISO KOREA",
  description:
    "OISO KOREA 가격 비교 정보와 외부 판매처 이용에 관한 기본 약관입니다.",
};

export default function TermsPage() {
  return (
    <StaticPage
      eyebrow="TERMS"
      title="이용약관"
      description="가격 비교 정보를 이용할 때 알아야 할 서비스 범위와 책임을 안내합니다."
    >
      <section>
        <h2>서비스의 성격</h2>
        <p>
          OISO KOREA는 면세점과 국내 판매처의 가격을 비교하고 구매 판단에
          필요한 정보를 제공하는 서비스입니다. 상품을 직접 판매하거나 결제,
          배송, 교환, 환불을 중개하지 않습니다.
        </p>
      </section>

      <section>
        <h2>가격과 상품정보</h2>
        <p>
          가격, 재고, 쿠폰, 배송비와 상품 구성은 판매처 상황에 따라 변경될 수
          있습니다. 표시된 정보는 구매를 보장하는 견적이 아니며, 사용자는
          결제 전 판매처에서 최종 가격과 조건을 확인해야 합니다.
        </p>
      </section>

      <section>
        <h2>외부 서비스</h2>
        <p>
          외부 링크를 통해 이동한 판매처에서 이루어지는 주문과 계약에는 해당
          판매처의 약관이 적용됩니다. OISO KOREA는 외부 사이트의 상품 품질,
          배송, 교환, 환불을 대신 책임지지 않습니다.
        </p>
      </section>

      <section>
        <h2>주류 정보</h2>
        <p>
          주류 정보는 성인을 위한 참고자료입니다. 구매와 수령에는 법령,
          면세한도, 성인 인증, 판매처별 수령 규정이 적용되며 국내 가격은
          합법적인 픽업 구매를 기준으로 비교합니다.
        </p>
      </section>

      <section>
        <h2>서비스 변경</h2>
        <p>
          가격 수집 범위와 기능은 데이터 제공처의 정책이나 기술 상황에 따라
          변경될 수 있습니다. 중요한 변경은 사이트 내 안내 또는 이 약관의
          업데이트를 통해 공개합니다.
        </p>
      </section>
    </StaticPage>
  );
}
