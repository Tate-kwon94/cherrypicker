#!/usr/bin/env node
/**
 * 쿠팡 파트너스 딥링크 동기화.
 *
 * 최종승인 후 발급되는 Open API 키로, 사이트의 쿠팡 URL 들을 파트너스
 * 링크로 일괄 변환해 `app/lib/coupang-links.ts` 의 GENERATED 블록을 다시
 * 쓴다. 승인 전에는 실행할 수 없다 — 키가 없으면 무엇을 해야 하는지
 * 알려주고 실패한다.
 *
 *   COUPANG_ACCESS_KEY=... COUPANG_SECRET_KEY=... node build/sync-coupang-links.mjs
 *   node build/sync-coupang-links.mjs --dry-run   # 파일을 쓰지 않고 결과만 출력
 *
 * 서명·엔드포인트는 실제 키로 검증 완료(2026-08-29): 변환 6건 성공,
 * 발급된 링크마다 리다이렉트에 lptag 귀속과 의도한 랜딩을 확인했다.
 * 변환 결과는 링크 형식을 검사한 뒤에만 파일에 쓴다 — 형식이 어긋난
 * 응답이 조용히 테이블에 들어가면, 링크는 동작하는데 수익만 새는 상태가
 * 된다.
 */
import crypto from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import process from "node:process";

const API_HOST = "api-gateway.coupang.com";
const DEEPLINK_PATH = "/v2/providers/affiliate_open_api/apis/openapi/v1/deeplink";
const PARTNER_PREFIX = "https://link.coupang.com/";
const TABLE_PATH = "app/lib/coupang-links.ts";

/**
 * 변환 대상. 키는 coupang-links.ts 테이블의 키와 같아야 한다.
 *
 * 검색 URL 을 변환한다 — 간편 링크가 검색·기획전 URL 을 받는 것과 같은
 * 방식이고, 상품 페이지 URL 은 품절·판매자 변경으로 죽지만 검색은 죽지
 * 않는다. 특정 상품 페이지로 보내고 싶으면 여기 URL 만 바꾸면 된다.
 */
const search = (query) =>
  `https://www.coupang.com/np/search?q=${encodeURIComponent(query)}`;

/**
 * 여기 없는 키는 동기화가 건드리지 않는다 — 간편 링크로 직접 채운 항목
 * (cicaplast, hyalu 등)은 TARGETS 에 넣지 않는 한 그대로 보존된다.
 */
export const TARGETS = {
  cosmetics: {
    anr: search("에스티 로더 어드밴스드 나이트 리페어"),
    skii: search("SK-II 페이셜 트리트먼트 에센스"),
    sulwhasoo: search("설화수 자음생크림 클래식"),
  },
  travel: {
    "휴대용 멀티 충전기": search("여행용 멀티 충전기 USB C"),
    "접이식 보조가방": search("여행용 접이식 보조가방"),
    "캐리어 무게측정기": search("휴대용 캐리어 무게측정기"),
  },
};

/** 쿠팡 Open API HMAC 서명 (CEA). 공개 문서 기준 — 실제 키 검증 전. */
export function buildAuthorization({ method, path, accessKey, secretKey, now = new Date() }) {
  const pad = (value) => String(value).padStart(2, "0");
  const signedDate =
    String(now.getUTCFullYear()).slice(2) +
    pad(now.getUTCMonth() + 1) +
    pad(now.getUTCDate()) +
    "T" +
    pad(now.getUTCHours()) +
    pad(now.getUTCMinutes()) +
    pad(now.getUTCSeconds()) +
    "Z";
  const [pathname, query = ""] = path.split("?");
  const message = signedDate + method + pathname + query;
  const signature = crypto
    .createHmac("sha256", secretKey)
    .update(message)
    .digest("hex");
  return `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${signedDate}, signature=${signature}`;
}

async function convert(urls, { accessKey, secretKey }) {
  const response = await fetch(`https://${API_HOST}${DEEPLINK_PATH}`, {
    method: "POST",
    headers: {
      Authorization: buildAuthorization({
        method: "POST",
        path: DEEPLINK_PATH,
        accessKey,
        secretKey,
      }),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ coupangUrls: urls }),
  });
  if (!response.ok) {
    throw new Error(
      `딥링크 API ${response.status}: ${(await response.text()).slice(0, 300)}`,
    );
  }
  const payload = await response.json();
  // 응답: { rCode, rMessage, data: [{ originalUrl, shortenUrl, landingUrl }] }
  if (payload.rCode !== undefined && String(payload.rCode) !== "0") {
    throw new Error(`딥링크 API rCode ${payload.rCode}: ${payload.rMessage ?? ""}`);
  }
  const byOriginal = new Map();
  for (const entry of payload.data ?? []) {
    byOriginal.set(entry.originalUrl, entry.shortenUrl ?? entry.landingUrl);
  }
  return byOriginal;
}

/**
 * GENERATED 블록 안의 기존 항목을 읽는다. 사람이 간편 링크로 직접 채운
 * 값을 동기화가 지우지 않으려면, 다시 쓰기 전에 먼저 읽어야 한다.
 */
export function parseGeneratedBlock(source, blockName) {
  const begin = new RegExp(`[ \\t]*// BEGIN GENERATED ${blockName}\\b[^\\n]*\\n([\\s\\S]*?)[ \\t]*// END GENERATED ${blockName}\\b`);
  const match = source.match(begin);
  if (!match) {
    throw new Error(`coupang-links.ts 에서 GENERATED ${blockName} 마커를 찾지 못했습니다.`);
  }
  const entries = {};
  for (const line of match[1].split("\n")) {
    if (/^\s*(\/\/.*)?$/.test(line)) continue;
    const entry = line.match(/^\s*("(?:[^"\\]|\\.)*"|[A-Za-z_$][\w$]*):\s*("(?:[^"\\]|\\.)*"),?\s*$/);
    if (!entry) {
      // 읽지 못한 줄을 넘어가면 다음 병합 때 그 항목이 조용히 사라진다 —
      // 링크는 동작을 멈추는 게 아니라 귀속만 끊기므로, 여기서 멈춘다.
      throw new Error(
        `GENERATED ${blockName} 블록의 줄을 해석하지 못했습니다: ${line.trim()}`,
      );
    }
    const key = entry[1].startsWith('"') ? JSON.parse(entry[1]) : entry[1];
    entries[key] = JSON.parse(entry[2]);
  }
  return entries;
}

/**
 * 변환 결과를 블록에 병합한다. 기존 항목은 보존하고, TARGETS 로 변환된
 * 키만 갱신한다 — 통째로 교체하면 직접 채운 링크가 지워진다.
 */
export function mergeGeneratedBlock(source, blockName, converted) {
  const existing = parseGeneratedBlock(source, blockName);
  return rewriteGeneratedBlock(source, blockName, { ...existing, ...converted });
}

/**
 * GENERATED 블록 안쪽만 다시 쓴다. 마커 밖(사람이 쓴 주석·직접 채운 값)은
 * 건드리지 않는다. 마커가 없으면 실패한다 — 조용히 아무 데나 쓰는 것보다
 * 낫다.
 */
export function rewriteGeneratedBlock(source, blockName, entries) {
  const begin = new RegExp(`([ \\t]*// BEGIN GENERATED ${blockName}\\b[^\\n]*\\n)([\\s\\S]*?)([ \\t]*// END GENERATED ${blockName}\\b)`);
  const match = source.match(begin);
  if (!match) {
    throw new Error(`coupang-links.ts 에서 GENERATED ${blockName} 마커를 찾지 못했습니다.`);
  }
  const body = Object.entries(entries)
    .map(([key, url]) => {
      const safeKey = /^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key);
      return `  ${safeKey}: ${JSON.stringify(url)},\n`;
    })
    .join("");
  // 문자열 템플릿 치환은 body 속 `$&` 같은 시퀀스를 해석해 파일을 망가뜨릴
  // 수 있다 — 함수 치환은 결과를 문자 그대로 넣는다.
  return source.replace(begin, (_match, head, _oldBody, tail) => head + body + tail);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const accessKey = process.env.COUPANG_ACCESS_KEY;
  const secretKey = process.env.COUPANG_SECRET_KEY;

  if (!accessKey || !secretKey) {
    console.error(
      [
        "쿠팡 파트너스 API 키가 없습니다.",
        "",
        "이 스크립트는 최종승인 후 발급되는 Open API 키가 필요합니다.",
        "  1. 파트너스 활동으로 누적 판매금액 15만 원 도달 (본인 구매는 집계 제외)",
        "  2. 자동 최종승인 심사 통과",
        "  3. 콘솔에서 API 키 발급 후:",
        "     COUPANG_ACCESS_KEY=... COUPANG_SECRET_KEY=... node build/sync-coupang-links.mjs",
        "",
        "키 없이 링크를 채우려면 콘솔의 '간편 링크 만들기'에서 생성해",
        "app/lib/coupang-links.ts 의 GENERATED 블록에 직접 붙여 넣으세요.",
      ].join("\n"),
    );
    process.exit(1);
  }

  const allUrls = [
    ...Object.values(TARGETS.cosmetics),
    ...Object.values(TARGETS.travel),
  ];
  console.log(`딥링크 변환 요청: ${allUrls.length}건`);
  const converted = await convert(allUrls, { accessKey, secretKey });

  const resolveEntries = (targets) => {
    const entries = {};
    for (const [key, originalUrl] of Object.entries(targets)) {
      const partnerUrl = converted.get(originalUrl);
      if (!partnerUrl) {
        throw new Error(`${key}: 변환 결과가 없습니다 (${originalUrl})`);
      }
      if (!partnerUrl.startsWith(PARTNER_PREFIX)) {
        // 형식이 어긋난 링크가 테이블에 들어가면 링크는 동작하는데 수익만
        // 조용히 샌다 — 여기서 멈추는 것이 낫다.
        throw new Error(`${key}: 파트너스 링크 형식이 아닙니다 — ${partnerUrl}`);
      }
      entries[key] = partnerUrl;
    }
    return entries;
  };

  const cosmetics = resolveEntries(TARGETS.cosmetics);
  const travel = resolveEntries(TARGETS.travel);

  const tablePath = resolve(process.cwd(), TABLE_PATH);
  let source = await readFile(tablePath, "utf8");
  source = mergeGeneratedBlock(source, "cosmetics", cosmetics);
  source = mergeGeneratedBlock(source, "travel", travel);

  if (dryRun) {
    console.log("--dry-run: 파일을 쓰지 않았습니다. 변환 결과:");
    console.log(JSON.stringify({ cosmetics, travel }, null, 2));
    return;
  }

  await writeFile(tablePath, source);
  console.log(`${TABLE_PATH} 갱신 완료. npm run verify 로 형식 검사를 돌리세요.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
