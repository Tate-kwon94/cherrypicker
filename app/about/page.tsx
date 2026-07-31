import type { Metadata } from "next";
import { StaticPage } from "../components/static-page";

export const metadata: Metadata = {
  title: "서비스 소개 — 체리피커",
  description:
    "면세점과 국내 리테일 가격을 동일한 용량과 실제 결제가 기준으로 비교하는 체리피커의 운영 목적을 소개합니다.",
};

export default function AboutPage() {
  return (
    <StaticPage
      eyebrow="ABOUT CHERRY PICKER"
      title="가격을 같은 기준으로 바꾸는 서비스"
      description="체리피커는 면세가가 정말 저렴한지, 국내에서 바로 사는 편이 나은지를 설명하는 구매 판단 도구입니다."
    >
      <section>
        <h2>왜 만들었나요?</h2>
        <p>
          면세 전용 구성과 국내 판매 구성은 용량과 수량이 자주 다릅니다.
          여기에 배송비, 회원 할인, 카드 조건까지 섞이면 표시 가격만으로는
          어느 쪽이 유리한지 판단하기 어렵습니다.
        </p>
        <p>
          체리피커는 최종 결제가와 ml·g·개당 가격을 함께 보여주고, 같은 용량으로
          환산한 절감액을 계산합니다. 주류는 가격뿐 아니라 단맛,
          스모키함, 바디감처럼 취향 실패를 줄이는 정보도 제공합니다.
        </p>
      </section>

      <section>
        <h2>가격을 계산하는 방식</h2>
        <ul>
          <li>상품가에 배송비를 더하고 누구나 받을 수 있는 할인을 뺍니다.</li>
          <li>개인 쿠폰과 특정 카드 할인은 별도 조건부 가격으로 봅니다.</li>
          <li>구성 차이는 ml·g·개당 단위가격으로 환산합니다.</li>
          <li>가격 확인 시각과 판매 조건을 함께 기록합니다.</li>
        </ul>
      </section>

      <section>
        <h2>수익과 추천의 관계</h2>
        <p>
          일부 판매처 링크에는 제휴 수수료가 적용될 수 있고, 향후 콘텐츠
          영역에 광고가 표시될 수 있습니다. 수익 여부는 최저가, 절감액,
          추천 순위 계산에서 제외하며 광고와 제휴 링크는 명확하게 표시합니다.
        </p>
      </section>
    </StaticPage>
  );
}
