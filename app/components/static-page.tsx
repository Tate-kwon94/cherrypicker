import Link from "next/link";
import type { ReactNode } from "react";

type StaticPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  updated?: string;
};

export function StaticPage({
  eyebrow,
  title,
  description,
  children,
  updated = "2026년 7월 31일",
}: StaticPageProps) {
  return (
    <main className="info-shell">
      <header className="info-header">
        <Link className="brand" href="/" aria-label="체리피커 홈">
          <span className="brand-cherry" aria-hidden="true">
            <span />
            <span />
          </span>
          <span className="brand-word">CHERRY</span>
          <span className="brand-country">PICKER</span>
        </Link>
        <nav aria-label="안내 페이지">
          <Link href="/guides">여행가이드</Link>
          <Link href="/about">서비스 소개</Link>
          <Link href="/advertising">광고·제휴 원칙</Link>
          <Link href="/">가격 비교</Link>
        </nav>
      </header>

      <article className="info-article">
        <header className="info-hero">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{description}</p>
          <span>마지막 업데이트 {updated}</span>
        </header>
        <div className="info-body">{children}</div>
      </article>

      <footer className="info-footer">
        <div>
          <Link href="/privacy">개인정보처리방침</Link>
          <Link href="/terms">이용약관</Link>
          <Link href="/price-contribution">가격정보 제공 동의</Link>
          <Link href="/advertising">광고·제휴 원칙</Link>
        </div>
        <p>
          제휴 링크가 적용된 페이지에는 결과 묶음 아래에 수수료 고지를
          표시하며, 제휴 여부는 비교 순위에 반영하지 않습니다.
        </p>
      </footer>
    </main>
  );
}
