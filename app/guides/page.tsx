import type { Metadata } from "next";
import { ProductImage } from "../components/product-image";
import Link from "next/link";
import { StaticPage } from "../components/static-page";
import { guideArticles } from "./data";

export const metadata: Metadata = {
  title: "여행가이드 — 체리피커",
  description:
    "면세·국내 가격 비교부터 호텔·편의점 픽업과 출국 전 준비물까지 정리한 여행 쇼핑 가이드입니다.",
};

export default function GuidesPage() {
  return (
    <StaticPage
      eyebrow="TRAVEL SHOPPING GUIDES"
      title="여행 쇼핑을 더 쉽게"
      description="면세와 국내 가격을 같은 기준으로 비교하고, 주문·픽업·출국 준비까지 이어지는 방법을 정리했습니다."
    >
      <section>
        <h2>필요한 순간부터 골라보세요</h2>
        <div className="guide-tip-grid">
          <article>
            <span>01</span>
            <h3>가격 비교</h3>
            <p>면세점·쿠팡·올리브영·국내 픽업가를 최종 결제가와 단위가격으로 맞춥니다.</p>
          </article>
          <article>
            <span>02</span>
            <h3>수령 준비</h3>
            <p>공항 수령과 국내 배송·매장 픽업 중 가격 차이를 감수할 만한 방법을 고릅니다.</p>
          </article>
          <article>
            <span>03</span>
            <h3>여행 준비물</h3>
            <p>충전기, 보조가방, 무게측정기처럼 쇼핑 전후에 바로 쓰는 물품만 간추립니다.</p>
          </article>
        </div>
      </section>

      <section>
        <h2>상품별 가격 비교법</h2>
        <p>
          상품가와 배송비, 적용 가능한 할인, 용량 차이, 구매 조건을 분리해
          설명합니다. 가격은 판매처에서 실제 결제 전에 다시 확인해야 합니다.
        </p>
        <div className="guide-index">
          {guideArticles.map((article) => (
            <Link href={`/guides/${article.slug}`} key={article.slug}>
              <span className="guide-card-image">
                <ProductImage
                  src={article.image}
                  alt=""
                  width={320}
                  height={180}
                  loading="lazy"
                />
              </span>
              <span className="guide-card-category">{article.category}</span>
              <small>{article.brand}</small>
              <strong>{article.title}</strong>
              <p>{article.subtitle}</p>
              <b>가이드 읽기 →</b>
            </Link>
          ))}
        </div>
      </section>
    </StaticPage>
  );
}
