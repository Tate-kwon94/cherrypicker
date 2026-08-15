import type { MetadataRoute } from "next";
import { getConfiguredOrigin } from "./lib/site-origin";

export default async function robots(): Promise<MetadataRoute.Robots> {
  // canonical 선언은 설정된 origin 으로만 만든다. 요청 Host 로 만들면
  // 위조된 호스트로 요청해 sitemap 주소를 통째로 바꿔치기할 수 있다.
  const origin = await getConfiguredOrigin();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // 검수·관리 경로는 색인 대상이 아니다.
      disallow: ["/admin", "/api/"],
    },
    sitemap: origin ? `${origin}/sitemap.xml` : "/sitemap.xml",
  };
}
