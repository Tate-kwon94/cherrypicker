import type { Metadata } from "next";
import { StaticPage } from "../components/static-page";

export const metadata: Metadata = {
  title: "광고·제휴 운영 원칙 — 체리피커",
  description:
    "쿠팡 파트너스, 디스플레이 광고, 협찬 콘텐츠와 가격 추천 순위를 분리하는 체리피커의 운영 원칙입니다.",
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
          쿠팡 파트너스 링크가 실제로 적용된 페이지에는 관련 상품 묶음 아래에
          “이 페이지는 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의
          수수료를 제공받습니다.”라는 고지를 표시합니다. 일반 검색 링크에는
          제휴 수익이 발생하는 것처럼 표시하지 않습니다.
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
          혼동되지 않는 별도 영역에만 배치합니다. 비교 결론과 가격 대안 사이에는
          광고를 넣지 않고, 결과 확인이 끝난 뒤 또는 여행가이드 본문에만
          배치합니다.
        </p>
      </section>

      <section>
        <h2>상품 이미지</h2>
        <p>
          상품 이미지에는 출처를 함께 표시합니다. 권리자께서 사용 중단이나
          교체를 요청하시면 확인 후 신속히 반영합니다. 문의는{" "}
          <a href="mailto:Tate_kwon@outlook.com">Tate_kwon@outlook.com</a>
          으로 보내주세요.
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
