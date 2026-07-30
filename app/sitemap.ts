import type { MetadataRoute } from "next";
import { guideArticles } from "./guides/data";

const baseUrl = "https://salkka-dutyfree.tate-kwon.workers.dev";

export default function sitemap(): MetadataRoute.Sitemap {
  const updated = new Date("2026-07-30T00:00:00Z");
  const staticPages = [
    "",
    "/guides",
    "/about",
    "/privacy",
    "/terms",
    "/advertising",
  ];

  return [
    ...staticPages.map((path) => ({
      url: `${baseUrl}${path}`,
      lastModified: updated,
      changeFrequency: path === "" ? ("daily" as const) : ("monthly" as const),
      priority: path === "" ? 1 : 0.7,
    })),
    ...guideArticles.map((article) => ({
      url: `${baseUrl}/guides/${article.slug}`,
      lastModified: updated,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
