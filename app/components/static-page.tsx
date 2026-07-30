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
  updated = "2026년 7월 30일",
}: StaticPageProps) {
  return (
    <main className="info-shell">
      <header className="info-header">
        <a className="brand" href="/" aria-label="OISO KOREA 홈">
          <span className="brand-word">OISO</span>
          <span className="brand-country">KOREA</span>
        </a>
        <nav aria-label="안내 페이지">
          <a href="/guides">가격 가이드</a>
          <a href="/about">서비스 소개</a>
          <a href="/advertising">광고·제휴 원칙</a>
          <a href="/">가격 비교</a>
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
          <a href="/privacy">개인정보처리방침</a>
          <a href="/terms">이용약관</a>
          <a href="/advertising">광고·제휴 원칙</a>
        </div>
        <p>
          이 사이트는 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의
          수수료를 제공받을 수 있습니다.
        </p>
      </footer>
    </main>
  );
}
