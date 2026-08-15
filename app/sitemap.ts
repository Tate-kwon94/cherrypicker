import type { MetadataRoute } from "next";
import { guideArticles } from "./guides/data";
import { getConfiguredOrigin } from "./lib/site-origin";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // 설정된 origin 이 없으면 상대 경로를 낸다. 위조된 Host 가 canonical
  // 주소로 굳는 것보다, 절대 URL 이 빠지는 편이 안전하다.
  const origin = await getConfiguredOrigin();
  const url = (path: string) => (origin ? `${origin}${path}` : path);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: url("/"), changeFrequency: "daily", priority: 1 },
    { url: url("/guides"), changeFrequency: "weekly", priority: 0.8 },
    ...["about", "privacy", "terms", "price-contribution", "advertising"].map(
      (route) => ({
        url: url(`/${route}`),
        changeFrequency: "monthly" as const,
        priority: 0.7,
      }),
    ),
  ];

  return [
    ...staticRoutes,
    ...guideArticles.map((article) => ({
      url: url(`/guides/${article.slug}`),
      lastModified: article.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
