import assert from "node:assert/strict";
import test from "node:test";
import {
  pilotProducts,
  pilotRequiredSourcesPerChannel,
} from "../app/lib/pilot-catalog.ts";

test("파일럿은 화장품 13개와 주류 5개로 구성한다", () => {
  // 2026-08-15 라로슈포제 2종 + 닥터지 수딩 폼(신라 단독 확인) 추가 —
  // 온라인 면세점 취급이 확인된 상품만 늘린다. 면세 채널에 없는 상품은
  // 비교가 성립하지 않는다.
  assert.equal(pilotProducts.length, 18);
  assert.equal(
    pilotProducts.filter((item) => item.category === "cosmetics").length,
    13,
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
  // 첫 번째 출처는 면세 채널이다. 원래는 4사 전부를 요구했지만, 신라
  // 단독 취급 상품(닥터지 수딩 폼)이 들어오면서 "4사 중 확인된 곳"으로
  // 완화했다 — 면세 출처는 한 곳이면 비교가 성립한다.
  const dutyOperators = ["롯데", "신라", "신세계", "현대"];
  assert.ok(
    pilotProducts.every((item) =>
      dutyOperators.some((mall) => item.sourceTargets[0].includes(mall)),
    ),
  );
  assert.ok(
    pilotProducts
      .filter((item) => item.category === "liquor")
      .every((item) => item.unit === "ml" && item.defaultVolume > 0),
  );
});
