import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StaticPage } from "../../components/static-page";
import { guideArticles } from "../data";

type GuidePageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return guideArticles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({
  params,
}: GuidePageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = guideArticles.find((item) => item.slug === slug);

  if (!article) return {};

  return {
    title: `${article.title} — 살까?`,
    description: article.subtitle,
  };
}

export default async function GuidePage({ params }: GuidePageProps) {
  const { slug } = await params;
  const article = guideArticles.find((item) => item.slug === slug);

  if (!article) notFound();

  return (
    <StaticPage
      eyebrow={`${article.category} · ${article.brand}`}
      title={article.title}
      description={article.subtitle}
    >
      <section className="guide-verdict">
        <span>한 줄 판단</span>
        <h2>{article.verdict}</h2>
        <p>{article.summary}</p>
      </section>

      <section>
        <h2>비교할 구성</h2>
        <div className="spec-comparison">
          <article>
            <span>면세 기준</span>
            <strong>{article.dutySpec}</strong>
          </article>
          <i aria-hidden="true">vs</i>
          <article>
            <span>국내 기준</span>
            <strong>{article.retailSpec}</strong>
          </article>
        </div>
      </section>

      <section>
        <h2>구매 전에 확인할 항목</h2>
        <ol className="checkpoint-list">
          {article.checkpoints.map((checkpoint) => (
            <li key={checkpoint}>{checkpoint}</li>
          ))}
        </ol>
      </section>

      <section>
        <h2>살까?의 판단 방식</h2>
        {article.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </section>

      <aside className="guide-caution">
        <strong>가격 확인 안내</strong>
        <p>{article.caution}</p>
      </aside>

      <nav className="guide-navigation" aria-label="다른 가격 가이드">
        <a href="/guides">모든 가격 가이드 보기</a>
        <a href="/">현재 비교 화면으로 이동</a>
      </nav>
    </StaticPage>
  );
}
