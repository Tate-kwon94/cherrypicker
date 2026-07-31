import type { MetadataRoute } from "next";
import { guideArticles } from "./guides/data";
import { getSiteOrigin } from "./lib/site-origin";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = await getSiteOrigin();
  const lastModified = new Date("2026-07-31T00:00:00.000Z");

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${origin}/`,
      lastModified,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${origin}/guides`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...["about", "privacy", "terms", "advertising"].map((route) => ({
      url: `${origin}/${route}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];

  return [
    ...staticRoutes,
    ...guideArticles.map((article) => ({
      url: `${origin}/guides/${article.slug}`,
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
