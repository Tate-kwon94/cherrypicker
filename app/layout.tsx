import type { Metadata } from "next";
import "./globals.css";
import { getSiteOrigin } from "./lib/site-origin";

const title = "체리피커 — 면세·리테일 실구매가 비교";
const description =
  "가격은 비교하고, 좋은 것만 픽하세요. 배송비와 단위가격을 반영해 온라인 면세점과 국내 리테일 가격을 같은 기준으로 비교합니다.";
const adsenseClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT?.startsWith(
  "ca-pub-",
)
  ? process.env.NEXT_PUBLIC_ADSENSE_CLIENT
  : undefined;

export async function generateMetadata(): Promise<Metadata> {
  const origin = await getSiteOrigin();
  const socialImage = new URL("/og.png", origin).toString();

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
          alt: "체리피커 — 가격은 비교하고, 좋은 것만 픽하세요",
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
      <body>{children}</body>
    </html>
  );
}
