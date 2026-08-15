import assert from "node:assert/strict";
import test from "node:test";
import {
  describeProductConflicts,
  findProductConflicts,
} from "../app/lib/offer-input.ts";

const registered = {
  brand: "SK-II",
  name: "페이셜 트리트먼트 에센스",
  category: "cosmetics",
  unit: "ml",
};

test("같은 상품 정보로 등록하면 충돌이 없다", () => {
  assert.deepEqual(findProductConflicts(registered, { ...registered }), []);
});

test("의미를 바꾸는 필드의 차이를 잡아낸다", () => {
  // category 는 신선도 규칙을, unit 은 단위가격 해석을 바꾼다.
  // 덮어쓰면 이미 승인된 다른 가격들의 의미까지 소급해서 달라진다.
  assert.deepEqual(
    findProductConflicts(registered, { ...registered, category: "liquor" }),
    [{ field: "category", existing: "cosmetics", submitted: "liquor" }],
  );
  assert.deepEqual(
    findProductConflicts(registered, { ...registered, unit: "g" }),
    [{ field: "unit", existing: "ml", submitted: "g" }],
  );
});

test("공개 화면에 나가는 표시 필드의 차이도 잡아낸다", () => {
  const conflicts = findProductConflicts(registered, {
    ...registered,
    brand: "SK2",
    name: "FTE",
  });

  assert.deepEqual(conflicts.map((conflict) => conflict.field), [
    "brand",
    "name",
  ]);
});

test("충돌 메시지는 무엇이 어떻게 다른지와 왜 막는지를 알려준다", () => {
  const message = describeProductConflicts(
    "skii",
    findProductConflicts(registered, {
      ...registered,
      brand: "SK2",
      category: "liquor",
    }),
  );

  assert.match(message, /skii/);
  assert.match(message, /브랜드: 등록됨 "SK-II" · 입력 "SK2"/);
  assert.match(message, /카테고리: 등록됨 "cosmetics" · 입력 "liquor"/);
  // 왜 거부하는지가 메시지에 있어야 운영자가 다음 행동을 안다.
  assert.match(message, /이미 승인된 다른 가격/);
  assert.match(message, /상품 정보 수정은 별도 작업/);
});
