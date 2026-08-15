import assert from "node:assert/strict";
import test from "node:test";
import {
  pilotProducts,
  pilotRequiredSourcesPerChannel,
} from "../app/lib/pilot-catalog.ts";

test("파일럿은 화장품 12개와 주류 5개로 구성한다", () => {
  // 2026-08-15 라로슈포제 2종 추가 — 4대 온라인 면세점 취급이 확인된
  // 상품만 늘린다. 면세 채널에 없는 상품은 비교가 성립하지 않는다.
  assert.equal(pilotProducts.length, 17);
  assert.equal(
    pilotProducts.filter((item) => item.category === "cosmetics").length,
    12,
  );
  assert.equal(
    pilotProducts.filter((item) => item.category === "liquor").length,
    5,
  );
});

test("파일럿 상품 ID는 고유하고 양쪽 가격 출처를 요구한다", () => {
  assert.equal(
    new Set(pilotProducts.map((item) => item.id)).size,
    pilotProducts.length,
  );
  assert.ok(pilotProducts.every((item) => item.sourceTargets.length >= 2));
  assert.equal(pilotRequiredSourcesPerChannel, 2);
  assert.ok(
    pilotProducts.every((item) =>
      item.sourceTargets[0].includes("롯데·신라·신세계·현대"),
    ),
  );
  assert.ok(
    pilotProducts
      .filter((item) => item.category === "liquor")
      .every((item) => item.unit === "ml" && item.defaultVolume > 0),
  );
});
