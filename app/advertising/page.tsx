import type { Metadata } from "next";
import { StaticPage } from "../components/static-page";

export const metadata: Metadata = {
  title: "광고·제휴 운영 원칙 — 살까?",
  description:
    "쿠팡 파트너스, 디스플레이 광고, 협찬 콘텐츠와 가격 추천 순위를 분리하는 살까?의 운영 원칙입니다.",
};

export default function AdvertisingPage() {
  return (
    <StaticPage
      eyebrow="ADVERTISING & AFFILIATES"
      title="광고·제휴 운영 원칙"
      description="수익 활동을 명확히 표시하고 가격 비교 결과의 독립성을 지키기 위한 기준입니다."
    >
      <section>
        <h2>쿠팡 파트너스 고지</h2>
        <p>
          이 사이트는 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의
          수수료를 제공받을 수 있습니다. 제휴 링크가 적용된 버튼과 콘텐츠에는
          사용자가 알아볼 수 있도록 제휴 사실을 표시합니다.
        </p>
      </section>

      <section>
        <h2>가격 순위와 수익의 분리</h2>
        <ul>
          <li>제휴 수수료는 최저가와 절감액 계산에 사용하지 않습니다.</li>
          <li>추천 순위는 가격, 단위가격, 상품 매칭과 취향 기준으로 결정합니다.</li>
          <li>제휴하지 않은 판매처도 더 저렴하면 동일하게 표시합니다.</li>
          <li>협찬 상품은 광고 또는 협찬임을 명시합니다.</li>
        </ul>
      </section>

      <section>
        <h2>디스플레이 광고 배치</h2>
        <p>
          광고는 `Advertisements`로 구분하며 가격 확인 버튼, 메뉴, 추천 카드와
          혼동되지 않는 별도 영역에만 배치합니다. 광고 클릭을 유도하거나
          콘텐츠보다 많은 광고를 노출하지 않습니다.
        </p>
      </section>

      <section>
        <h2>정정과 검토</h2>
        <p>
          판매처와의 경제적 이해관계가 새로 생기거나 가격 산정 방식이 변경되면
          관련 고지와 이 운영 원칙을 함께 갱신합니다. 광고 또는 제휴 여부와
          무관하게 잘못 매칭된 상품과 오래된 가격은 추천에서 제외하는 것을
          목표로 합니다.
        </p>
      </section>
    </StaticPage>
  );
}
