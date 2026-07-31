import assert from "node:assert/strict";
import test from "node:test";
import {
  pilotProducts,
  pilotRequiredSourcesPerChannel,
} from "../app/lib/pilot-catalog.ts";

test("파일럿은 화장품 10개와 주류 5개로 구성한다", () => {
  assert.equal(pilotProducts.length, 15);
  assert.equal(
    pilotProducts.filter((item) => item.category === "cosmetics").length,
    10,
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
