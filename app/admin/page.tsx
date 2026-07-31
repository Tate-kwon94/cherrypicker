import type { Metadata } from "next";
import Link from "next/link";
import { AdminPriceManager } from "./price-manager";
import { chatGPTSignOutPath } from "../chatgpt-auth";
import { requireAdminUser } from "../lib/admin-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "가격 운영 — 체리피커",
  description: "체리피커의 검수 가격을 등록하고 승인하는 운영 화면입니다.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminPage() {
  const admin = await requireAdminUser();

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <Link className="brand" href="/" aria-label="체리피커 홈">
          <span className="brand-cherry" aria-hidden="true">
            <span />
            <span />
          </span>
          <span className="brand-word">CHERRY</span>
          <span className="brand-country">PICKER</span>
        </Link>
        <div>
          <span>{admin.displayName}</span>
          <Link href={chatGPTSignOutPath("/")} prefetch={false}>
            로그아웃
          </Link>
        </div>
      </header>

      <section className="admin-hero">
        <p className="eyebrow">VERIFIED PRICE OPERATIONS</p>
        <h1>가격 등록·검수</h1>
        <p>
          원본 판매 페이지에서 직접 확인한 가격만 등록하세요. 승인되고 유효기간이
          남은 가격만 소비자 화면에 공개됩니다.
        </p>
      </section>

      <AdminPriceManager />
    </main>
  );
}
