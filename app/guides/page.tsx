import type { Metadata } from "next";
import { StaticPage } from "../components/static-page";
import { guideArticles } from "./data";

export const metadata: Metadata = {
  title: "가격 가이드 — 살까?",
  description:
    "화장품과 위스키를 총액, 단위가격, 용량, 취향 기준으로 비교하는 구매 가이드입니다.",
};

export default function GuidesPage() {
  return (
    <StaticPage
      eyebrow="PRICE GUIDES"
      title="가격표보다 먼저 볼 것들"
      description="면세와 국내 가격을 같은 기준으로 바꾸고, 상품 특성까지 함께 판단하는 방법을 정리했습니다."
    >
      <section>
        <h2>화장품·주류 비교 가이드</h2>
        <p>
          모든 가이드는 상품가와 배송비, 적용 가능한 할인, 용량 차이, 구매
          조건을 분리해 설명합니다. 현재 표시 가격은 서비스 구조 검증용
          예시이며 실제 구매 전 재확인이 필요합니다.
        </p>
        <div className="guide-index">
          {guideArticles.map((article) => (
            <a href={`/guides/${article.slug}`} key={article.slug}>
              <span>{article.category}</span>
              <small>{article.brand}</small>
              <strong>{article.title}</strong>
              <p>{article.subtitle}</p>
              <b>가이드 읽기 →</b>
            </a>
          ))}
        </div>
      </section>
    </StaticPage>
  );
}
