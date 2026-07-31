import assert from "node:assert/strict";
import test from "node:test";
import {
  conveniencePickupRetailers,
  dutyFreeRetailers,
  findRetailerByName,
  fulfillmentLabelForRetailer,
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

test("편의점 주류 스마트오더를 별도 픽업 가격원으로 제공한다", () => {
  assert.deepEqual(
    conveniencePickupRetailers.map((retailer) => retailer.name),
    [
      "포켓CU 예약구매",
      "GS25 와인25플러스",
      "세븐일레븐 주류 픽업",
      "이마트24 보틀오더",
    ],
  );
  assert.equal(findRetailerByName("와인25+")?.id, "wine25-plus");
  assert.equal(findRetailerByName("보틀오더")?.id, "emart24-bottle-order");
  assert.equal(
    fulfillmentLabelForRetailer("이마트24", "retail", true),
    "편의점 픽업",
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
