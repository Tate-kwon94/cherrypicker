import HomeClient from "./page-client";
import { readAdsenseConfig, readRuntimeFlags } from "./lib/runtime-flags";

// 플래그는 request-time 에 읽어야 배포 후에도 끌 수 있다. 정적 렌더로
// 캐시되면 빌드 시점 값이 굳어 킬스위치가 동작하지 않는다.
export const dynamic = "force-dynamic";

export default async function Home() {
  const flags = await readRuntimeFlags();
  const adsense = await readAdsenseConfig(flags.MONETIZATION_ENABLED);

  return <HomeClient flags={flags} adsense={adsense} />;
}
