import assert from "node:assert/strict";
import test from "node:test";
import {
  dutyFreeRetailers,
  findRetailerByName,
  normalizeRetailerName,
  priceRetailers,
} from "../app/lib/retailers.ts";

test("4대 온라인 면세점을 표준 판매처로 제공한다", () => {
  assert.deepEqual(
    dutyFreeRetailers.map((retailer) => retailer.name),
    ["롯데면세점", "신라면세점", "신세계면세점", "현대면세점"],
  );
  assert.equal(
    new Set(priceRetailers.map((retailer) => retailer.id)).size,
    priceRetailers.length,
  );
});

test("공백과 구분 기호가 달라도 같은 판매처로 정규화한다", () => {
  assert.equal(normalizeRetailerName(" 롯데 면세점 "), "롯데면세점");
  assert.equal(findRetailerByName("롯데 면세점")?.id, "lotte-duty-free");
  assert.equal(
    normalizeRetailerName("SSG.COM · 트레이더스"),
    normalizeRetailerName("SSG.COM·트레이더스"),
  );
});
