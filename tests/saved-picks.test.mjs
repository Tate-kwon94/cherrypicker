import assert from "node:assert/strict";
import test from "node:test";
import {
  createPendingPick,
  findExistingPick,
  normalizeStoredPicks,
  sumVerifiedAmounts,
  SAVED_PICK_SCHEMA_VERSION,
} from "../app/lib/saved-picks.ts";

test("Phase 0 신규 저장은 금액을 비우고 epoch 시각을 기록한다", () => {
  const pick = createPendingPick({
    category: "cosmetics",
    productId: "anr",
    title: "에스티 로더 어드밴스드 나이트 리페어",
    savedAt: 1_770_000_000_000,
  });

  assert.equal(pick.schemaVersion, SAVED_PICK_SCHEMA_VERSION);
  assert.equal(pick.amount, null);
  assert.equal(pick.amountState, "pending");
  assert.equal(pick.comparisonMode, "pending");
  assert.equal(pick.savedAtBasis, "user-action");
  assert.equal(pick.savedAt, 1_770_000_000_000);
});

test("금액 없는 pick은 복원에서 탈락하지 않는다", () => {
  const pending = createPendingPick({
    category: "cosmetics",
    productId: "anr",
    title: "ANR",
    savedAt: 1_770_000_000_000,
  });

  const { picks, quarantined, droppedItems } = normalizeStoredPicks(
    JSON.stringify([pending]),
  );

  assert.equal(quarantined, null);
  assert.equal(droppedItems, 0);
  assert.equal(picks.length, 1);
  assert.equal(picks[0].amount, null);
  assert.equal(picks[0].amountState, "pending");
});

test("복원 결과는 재저장해도 같은 상태를 유지한다", () => {
  const first = normalizeStoredPicks(
    JSON.stringify([
      createPendingPick({
        category: "liquor",
        productId: null,
        title: "라프로익 10년",
        savedAt: 1_770_000_000_000,
      }),
    ]),
  );
  const second = normalizeStoredPicks(JSON.stringify(first.picks));

  assert.deepEqual(second.picks, first.picks);
});

test("schemaVersion 없는 구 레코드는 삭제하지 않고 legacy-unknown으로 보존한다", () => {
  const legacy = {
    key: "cosmetics-anr-duty",
    title: "ANR 면세 우위",
    amount: 32_000,
    savedAt: 4_821, // event.timeStamp — epoch가 아니다
  };

  const { picks, droppedItems } = normalizeStoredPicks(
    JSON.stringify([legacy]),
  );

  assert.equal(droppedItems, 0);
  assert.equal(picks.length, 1);
  assert.equal(picks[0].comparisonMode, "legacy-unknown");
  assert.equal(picks[0].amountState, "legacy-unknown");
  // 검증되지 않은 구 금액은 되살리지 않는다.
  assert.equal(picks[0].amount, null);
  // 비-epoch 시각을 epoch로 위장하지 않는다.
  assert.equal(picks[0].savedAt, 4_821);
  assert.equal(picks[0].savedAtBasis, "legacy-import");
  // 합성 key에서 상품 identity를 추측하지 않는다.
  assert.equal(picks[0].identityKey, null);
});

test("손상된 JSON은 격리하고 저장소를 비우지 않는다", () => {
  const { picks, quarantined } = normalizeStoredPicks("{not json");

  assert.deepEqual(picks, []);
  assert.equal(quarantined, "{not json");
});

test("배열 안 개별 항목이 깨져도 나머지는 살린다", () => {
  const good = createPendingPick({
    category: "cosmetics",
    productId: "anr",
    title: "ANR",
    savedAt: 1,
  });

  const { picks, droppedItems, quarantined } = normalizeStoredPicks(
    JSON.stringify([good, null, { title: "" }, 42]),
  );

  assert.equal(quarantined, null);
  assert.equal(picks.length, 1);
  assert.equal(droppedItems, 3);
});

test("총액은 검증된 금액만 합산하고 NaN이 되지 않는다", () => {
  const pending = createPendingPick({
    category: "cosmetics",
    productId: "anr",
    title: "ANR",
    savedAt: 1,
  });
  const verified = { ...pending, amount: 12_000, amountState: "verified" };

  assert.equal(sumVerifiedAmounts([pending]), 0);
  assert.equal(sumVerifiedAmounts([pending, verified]), 12_000);
  assert.ok(Number.isFinite(sumVerifiedAmounts([pending, pending])));
});

test("identity를 모르는 항목끼리는 같은 선택으로 병합하지 않는다", () => {
  const { picks } = normalizeStoredPicks(
    JSON.stringify([
      { title: "구 항목 A", amount: 1, savedAt: 1 },
      { title: "구 항목 B", amount: 2, savedAt: 2 },
    ]),
  );

  assert.equal(picks.length, 2);
  assert.equal(findExistingPick(picks, null), undefined);
});

test("안정 identity가 같으면 중복 저장을 막는다", () => {
  const pick = createPendingPick({
    category: "cosmetics",
    productId: "anr",
    title: "ANR",
    savedAt: 1,
  });

  assert.notEqual(pick.identityKey, null);
  assert.equal(findExistingPick([pick], pick.identityKey), pick);
  assert.equal(findExistingPick([pick], "cosmetics:other"), undefined);
});
