import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const title = "OISO KOREA — 면세·리테일 실구매가 비교";
const description =
  "가격 보이소, 좋은 것만 사이소. 배송비와 단위가격을 반영해 온라인 면세점과 리테일 최저가를 비교하고 취향에 맞는 상품을 추천합니다.";
const adsenseClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT?.startsWith(
  "ca-pub-",
)
  ? process.env.NEXT_PUBLIC_ADSENSE_CLIENT
  : undefined;

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const origin = host ? `${protocol}://${host}` : "http://localhost:3000";
  const socialImage = new URL("/og-oiso.png", origin).toString();

  return {
    title,
    description,
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      title,
      description,
      type: "website",
      images: [
        {
          url: socialImage,
          width: 1792,
          height: 878,
          alt: "OISO KOREA — 가격 보이소, 좋은 것만 사이소",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [socialImage],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        {adsenseClient && (
          <script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClient}`}
            crossOrigin="anonymous"
          />
        )}
      </head>
      <body className={geist.variable}>{children}</body>
    </html>
  );
}
