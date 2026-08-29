#!/usr/bin/env node
/**
 * 쿠팡 파트너스 상품 API 로 국내(리테일) 검수 가격 등록안을 만든다.
 *
 *   COUPANG_ACCESS_KEY=... COUPANG_SECRET_KEY=... node build/sync-coupang-products.mjs --discover
 *   COUPANG_ACCESS_KEY=... COUPANG_SECRET_KEY=... node build/sync-coupang-products.mjs [--dry-run]
 *
 * --discover: coupang-product-map.mjs 에서 productId 가 미확정인 상품의
 *   검색 후보를 보여 준다. 사람이 본품 단품의 productId 를 골라 맵에 적는다.
 * 기본 실행: 확정된 상품의 현재 가격을 수집해, admin 화면의 "일괄 등록"에
 *   붙여넣을 수 있는 등록안 JSON 을 build/out/coupang-offer-drafts.json 에
 *   쓴다. 등록안은 쓰기 전에 parseOfferDraft 로 검증한다 — 세트·증정
 *   구성이 걸리면 그 상품만 제외하고 사유를 보여 준다.
 *
 * 이 스크립트는 비교의 국내 절반만 자동화한다. 면세 가격은 API 가 없어
 * 계속 admin 에서 손으로 등록한다.
 *
 * 배송비 원칙: 무료배송이 응답으로 확인될 때(isRocket/isFreeShipping)만
 * 등록안을 만든다. 배송비를 지어내면 국내가가 실제보다 싸 보이고, 그
 * 오차는 비교 결론을 조용히 뒤집는다.
 *
 * ⚠️ 검색 API 는 시간당 호출 제한이 있다(커뮤니티 보고 기준 ~10회, 초과
 * 시 403). --discover 와 본 실행을 같은 시간대에 몰지 말 것. 검색 실패는
 * 상품 단위로 건너뛰고 나머지 결과는 그대로 쓴다.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import process from "node:process";
import { buildAuthorization } from "./sync-coupang-links.mjs";
import { COUPANG_PRODUCT_MAP } from "./coupang-product-map.mjs";
import { pilotProducts } from "../app/lib/pilot-catalog.ts";
import {
  nonSingleUnitMarkers,
  OfferValidationError,
  parseOfferDraft,
} from "../app/lib/offer-input.ts";
import { DAY_MS } from "../app/lib/freshness.ts";

const API_HOST = "api-gateway.coupang.com";
const SEARCH_PATH =
  "/v2/providers/affiliate_open_api/apis/openapi/products/search";
const OUT_PATH = "build/out/coupang-offer-drafts.json";

async function searchProducts(keyword, { accessKey, secretKey, limit = 10 }) {
  const query = `keyword=${encodeURIComponent(keyword)}&limit=${limit}`;
  const path = `${SEARCH_PATH}?${query}`;
  const response = await fetch(`https://${API_HOST}${path}`, {
    method: "GET",
    headers: {
      Authorization: buildAuthorization({
        method: "GET",
        path,
        accessKey,
        secretKey,
      }),
    },
  });
  if (!response.ok) {
    throw new Error(
      `상품 검색 API ${response.status}: ${(await response.text()).slice(0, 300)}`,
    );
  }
  const payload = await response.json();
  if (payload.rCode !== undefined && String(payload.rCode) !== "0") {
    throw new Error(`상품 검색 API rCode ${payload.rCode}: ${payload.rMessage ?? ""}`);
  }
  return payload.data?.productData ?? [];
}

/** 응답 한 건을 admin 등록안으로 바꾼다. 순수 함수 — 테스트가 직접 부른다. */
export function buildOfferDraft({ catalogId, mapEntry, product, apiItem, now }) {
  const freeShipping =
    apiItem.isRocket === true || apiItem.isFreeShipping === true;
  if (!freeShipping) {
    return {
      skipped: true,
      catalogId,
      reason:
        "무료배송이 확인되지 않아 자동 등록안을 만들지 않습니다 — 배송비를 " +
        "지어내지 않고, 이 상품은 실제 배송비와 함께 손으로 등록하세요.",
    };
  }

  // 세트·증정 가드는 쿠팡 리스팅 제목에 대고 돌린다. 등록안의 상품명은
  // 아래에서 카탈로그 본품명으로 넣으므로 — 수동 등록과 같아야 상품
  // 정체성 가드(price-store)를 통과한다 — 여기서 검사하지 않으면 묶음
  // 가격이 본품 이름을 달고 들어간다.
  const listingTitle = String(apiItem.productName ?? "").slice(0, 160);
  const nonSingleUnit = nonSingleUnitMarkers.find(({ pattern }) =>
    pattern.test(listingTitle),
  );
  if (nonSingleUnit) {
    throw new OfferValidationError(
      `쿠팡 리스팅 제목에 ${nonSingleUnit.label}이 보입니다 — 본품 단품이 ` +
        `아니므로 등록안을 만들지 않습니다: ${listingTitle}`,
    );
  }

  const draft = {
    productId: catalogId,
    brand: product.brand,
    // 카탈로그 본품명. 수동 등록(면세 채널)과 같은 이름이어야 같은 상품
    // 행으로 합쳐진다. 리스팅 제목은 notes 에 증거로 남긴다.
    productName: product.name,
    category: product.category,
    sourceName: "쿠팡",
    // 증거 URL 은 추적 링크가 아니라 재검증 가능한 상품 페이지로 남긴다.
    sourceUrl: `https://www.coupang.com/vp/products/${apiItem.productId}`,
    channel: "retail",
    listPrice: Number(apiItem.productPrice),
    shipping: 0,
    instantDiscount: 0,
    currency: "KRW",
    volume: product.defaultVolume,
    unit: product.unit,
    observedAt: now,
    expiresAt: now + DAY_MS,
    evidenceType: "official_listing",
    storeLocation: "",
    abv: null,
    barcode: mapEntry.barcode ?? "",
    notes: `쿠팡 파트너스 상품 API 자동 수집 (productId=${apiItem.productId}, isRocket=${apiItem.isRocket === true}, isFreeShipping=${apiItem.isFreeShipping === true}) — 리스팅: ${listingTitle}`.slice(0, 500),
  };
  // 여기서 검증해야 실패가 상품 단위로 드러난다. admin 붙여넣기 단계까지
  // 미루면 어떤 상품이 왜 빠졌는지 알기 어렵다.
  parseOfferDraft(draft, now);
  return { skipped: false, catalogId, draft, imageUrl: apiItem.productImage ?? "" };
}

function mappedEntries() {
  const byId = new Map(pilotProducts.map((item) => [item.id, item]));
  return Object.entries(COUPANG_PRODUCT_MAP).map(([catalogId, mapEntry]) => {
    const product = byId.get(catalogId);
    if (!product) {
      throw new Error(`매핑의 ${catalogId} 가 pilot-catalog 에 없습니다.`);
    }
    return { catalogId, mapEntry, product };
  });
}

async function main() {
  const discover = process.argv.includes("--discover");
  const dryRun = process.argv.includes("--dry-run");
  const accessKey = process.env.COUPANG_ACCESS_KEY;
  const secretKey = process.env.COUPANG_SECRET_KEY;

  if (!accessKey || !secretKey) {
    console.error(
      "쿠팡 파트너스 API 키가 없습니다.\n" +
        "  COUPANG_ACCESS_KEY=... COUPANG_SECRET_KEY=... node build/sync-coupang-products.mjs",
    );
    process.exit(1);
  }

  const entries = mappedEntries();

  if (discover) {
    const unpinned = entries.filter(({ mapEntry }) => !mapEntry.productId);
    if (unpinned.length === 0) {
      console.log("모든 상품의 productId 가 확정돼 있습니다.");
      return;
    }
    for (const { catalogId, mapEntry } of unpinned) {
      console.log(`\n## ${catalogId} — 검색어: ${mapEntry.keyword}`);
      const items = await searchProducts(mapEntry.keyword, { accessKey, secretKey });
      if (items.length === 0) {
        console.log("  (검색 결과 없음 — keyword 를 바꿔 보세요)");
        continue;
      }
      for (const item of items) {
        console.log(
          `  productId=${item.productId}  ${Number(item.productPrice).toLocaleString("ko-KR")}원  ` +
            `로켓=${item.isRocket === true}  ${String(item.productName).slice(0, 70)}`,
        );
      }
    }
    console.log(
      "\n본품 단품의 productId 를 build/coupang-product-map.mjs 에 적은 뒤 다시 실행하세요.",
    );
    return;
  }

  const pinned = entries.filter(({ mapEntry }) => mapEntry.productId);
  if (pinned.length === 0) {
    console.error(
      "확정된 productId 가 없습니다. 먼저 --discover 로 후보를 보고 맵에 적으세요.",
    );
    process.exit(1);
  }

  const now = Date.now();
  const drafts = [];
  const skipped = [];
  for (const { catalogId, mapEntry, product } of pinned) {
    let items;
    try {
      items = await searchProducts(mapEntry.keyword, { accessKey, secretKey });
    } catch (error) {
      // 레이트리밋(403) 등으로 한 건이 실패해도 이미 수집한 결과는 산다.
      skipped.push({ catalogId, reason: error.message });
      continue;
    }
    const apiItem = items.find(
      (item) => String(item.productId) === String(mapEntry.productId),
    );
    if (!apiItem) {
      // 다른 상품으로 대체하지 않는다 — 확정한 그 상품이 아니면 가격이 아니다.
      skipped.push({
        catalogId,
        reason: `확정한 productId=${mapEntry.productId} 가 검색 결과에 없습니다 (keyword 조정 필요).`,
      });
      continue;
    }
    try {
      const result = buildOfferDraft({ catalogId, mapEntry, product, apiItem, now });
      if (result.skipped) skipped.push(result);
      else drafts.push(result);
    } catch (error) {
      skipped.push({ catalogId, reason: error.message });
    }
  }

  for (const item of skipped) {
    console.log(`제외 — ${item.catalogId}: ${item.reason}`);
  }
  console.log(`등록안 ${drafts.length}건, 제외 ${skipped.length}건`);

  const output = {
    generatedAt: new Date(now).toISOString(),
    drafts: drafts.map((item) => item.draft),
    images: Object.fromEntries(
      drafts.filter((d) => d.imageUrl).map((d) => [d.catalogId, d.imageUrl]),
    ),
  };

  if (dryRun) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  await mkdir(resolve(process.cwd(), "build/out"), { recursive: true });
  await writeFile(
    resolve(process.cwd(), OUT_PATH),
    JSON.stringify(output, null, 2),
  );
  console.log(
    `${OUT_PATH} 에 썼습니다. /admin 의 "일괄 등록(JSON)"에 drafts 배열을 붙여넣으세요.\n` +
      "면세 가격은 이 스크립트가 다루지 않습니다 — 양채널이 모여야 비교가 열립니다.",
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
