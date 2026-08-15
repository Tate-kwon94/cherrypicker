import assert from "node:assert/strict";
import test from "node:test";
import {
  buildIdentityKey,
  classifySavedAt,
  createVerifiedPick,
  findExistingPick,
  appendPick,
  normalizeStoredPicks,
  MAX_SAVED_PICKS,
  SAVED_AT_EPOCH_FLOOR_MS,
  SAVED_PICK_SCHEMA_VERSION,
} from "../app/lib/saved-picks.ts";

const NOW = 1_770_000_000_000; // 2026-02-02

test("새 저장은 검수 쌍 근거와 기기 시각으로 기록한다", () => {
  const pick = createVerifiedPick({
    category: "cosmetics",
    productId: "anr",
    title: "에스티 로더 어드밴스드 나이트 리페어",
    savedAt: NOW,
    now: NOW,
  });

  assert.equal(pick.schemaVersion, SAVED_PICK_SCHEMA_VERSION);
  assert.equal(pick.basis, "verified-pair");
  assert.deepEqual(pick.savedAt, { basis: "device-clock", epochMs: NOW });
  // 금액 필드는 존재하지 않는다. 합산해서 공개 문자열로 샐 값이 없다.
  assert.equal("amount" in pick, false);
  assert.equal("amountState" in pick, false);
  // identityKey 는 저장하지 않고 파생한다.
  assert.equal("identityKey" in pick, false);
});

test("캡처 근거 pick은 표현할 수 없다", () => {
  // 팩토리에 basis 인자가 없다. 호출부가 근거를 고를 수 없다는 것이
  // H-02 의 저장소 측 방어다.
  const pick = createVerifiedPick({
    category: "cosmetics",
    productId: "anr",
    title: "ANR",
    savedAt: NOW,
    now: NOW,
  });
  assert.equal(pick.basis, "verified-pair");

  // 손으로 써 넣어도 읽을 때 강등된다.
  const { picks } = normalizeStoredPicks(
    JSON.stringify([{ ...pick, basis: "captured" }]),
    NOW,
  );
  assert.equal(picks[0].basis, "unknown");
});

test("시계가 이상해도 저장은 실패하지 않고 시각만 unknown이 된다", () => {
  // 던지면 시계가 이상한 기기에서 저장 버튼이 죽고, Date.now() 로 대체하면
  // 없는 데이터를 지어낸다. 숫자는 rawValue 로 살린다.
  const pick = createVerifiedPick({
    category: "cosmetics",
    productId: "anr",
    title: "ANR",
    savedAt: 4_821, // event.timeStamp — epoch 가 아니다
    now: NOW,
  });

  assert.equal(pick.basis, "verified-pair");
  assert.deepEqual(pick.savedAt, { basis: "unknown", rawValue: 4_821 });
});

test("읽기 재검증은 상한을 보지 않아 시계 되돌림이 저장소에 굳지 않는다", () => {
  // 기기 시계가 3일 앞선 상태에서 저장한 뒤 NTP 가 시계를 되돌린 상황.
  const skewed = NOW + 3 * 86_400_000;
  const pick = createVerifiedPick({
    category: "cosmetics",
    productId: "anr",
    title: "ANR",
    savedAt: skewed,
    now: skewed,
  });
  assert.equal(pick.savedAt.basis, "device-clock");

  // 시계가 돌아온 뒤 다시 읽어도 강등되지 않는다. 강등되면 마운트 되쓰기가
  // 그 판정을 저장소에 영구히 박아 넣는다.
  const { picks } = normalizeStoredPicks(JSON.stringify([pick]), NOW);
  assert.deepEqual(picks[0].savedAt, { basis: "device-clock", epochMs: skewed });
});

test("쓰기에서는 상한을 본다", () => {
  const far = NOW + 400 * 86_400_000;
  const pick = createVerifiedPick({
    category: "cosmetics",
    productId: "anr",
    title: "ANR",
    savedAt: far,
    now: NOW,
  });
  assert.deepEqual(pick.savedAt, { basis: "unknown", rawValue: far });
});

test("바닥값 이전 시각은 저장 시각으로 인정하지 않는다", () => {
  assert.deepEqual(classifySavedAt(0, NOW, "device-clock"), {
    basis: "unknown",
    rawValue: 0,
  });
  assert.deepEqual(
    classifySavedAt(SAVED_AT_EPOCH_FLOOR_MS - 1, NOW, "device-clock"),
    { basis: "unknown", rawValue: SAVED_AT_EPOCH_FLOOR_MS - 1 },
  );
  assert.deepEqual(classifySavedAt(SAVED_AT_EPOCH_FLOOR_MS, NOW, "device-clock"), {
    basis: "device-clock",
    epochMs: SAVED_AT_EPOCH_FLOOR_MS,
  });
});

test("legacy 시각은 검증하지 않고 그대로 보존한다", () => {
  // 아무것도 주장하지 않으므로 반증할 것도 없다.
  assert.deepEqual(classifySavedAt(4_821, NOW, "legacy-import"), {
    basis: "legacy-import",
    rawValue: 4_821,
  });
  assert.deepEqual(classifySavedAt(undefined, NOW, "legacy-import"), {
    basis: "unknown",
    rawValue: null,
  });
});

test("복원 결과는 재저장해도 같은 상태를 유지한다", () => {
  const first = normalizeStoredPicks(
    JSON.stringify([
      createVerifiedPick({
        category: "liquor",
        productId: null,
        title: "라프로익 10년",
        savedAt: NOW,
        now: NOW,
      }),
    ]),
    NOW,
  );
  const second = normalizeStoredPicks(JSON.stringify(first.picks), NOW);
  const third = normalizeStoredPicks(JSON.stringify(second.picks), NOW);

  assert.deepEqual(second.picks, first.picks);
  assert.deepEqual(third.picks, second.picks);
});

test("v1 레코드는 identity가 복구될 때만 검수 근거로 승격한다", () => {
  const v1 = {
    schemaVersion: 1,
    identityKey: "cosmetics:anr",
    category: "cosmetics",
    productId: "anr",
    title: "ANR",
    comparisonMode: "pending",
    amount: null,
    amountState: "pending",
    savedAt: NOW,
    savedAtBasis: "user-action",
  };

  const { picks, droppedItems } = normalizeStoredPicks(
    JSON.stringify([v1]),
    NOW,
  );
  assert.equal(droppedItems, 0);
  assert.equal(picks[0].basis, "verified-pair");
  assert.equal(picks[0].productId, "anr");
  // 저장돼 있던 identityKey 를 믿지 않고 다시 계산한다. 값은 같아야 한다.
  assert.equal(buildIdentityKey(picks[0]), "cosmetics:anr");
});

test("legacy 계열 v1 행은 검수 근거로 승격하지 않는다", () => {
  // 구 승격 코드가 인식 못 한 basis 를 전부 "user-action" 으로 기본값
  // 처리했으므로, 손상된 행이 attestation 으로 올라갈 수 있었다.
  const damaged = {
    schemaVersion: 1,
    category: "other",
    productId: null,
    title: "구 항목",
    comparisonMode: "legacy-unknown",
    savedAt: 4_821,
    savedAtBasis: "무엇인지 모를 값",
  };

  const { picks } = normalizeStoredPicks(JSON.stringify([damaged]), NOW);
  assert.equal(picks[0].basis, "unknown");
});

test("v1의 손으로 써 넣은 금액은 되살리지 않는다", () => {
  const withAmount = {
    schemaVersion: 1,
    category: "cosmetics",
    productId: "anr",
    title: "ANR",
    amount: 32_000,
    amountState: "verified",
    savedAt: NOW,
    savedAtBasis: "user-action",
  };

  const { picks } = normalizeStoredPicks(JSON.stringify([withAmount]), NOW);
  assert.equal("amount" in picks[0], false);
});

test("schemaVersion 없는 구 레코드는 삭제하지 않고 보존한다", () => {
  const legacy = {
    key: "cosmetics-anr-duty",
    title: "ANR 면세 우위",
    amount: 32_000,
    savedAt: 4_821, // event.timeStamp — epoch 가 아니다
  };

  const { picks, droppedItems } = normalizeStoredPicks(
    JSON.stringify([legacy]),
    NOW,
  );

  assert.equal(droppedItems, 0);
  assert.equal(picks.length, 1);
  assert.equal(picks[0].basis, "unknown");
  // 비-epoch 시각을 epoch 로 위장하지 않고, 숫자도 버리지 않는다.
  assert.deepEqual(picks[0].savedAt, { basis: "legacy-import", rawValue: 4_821 });
  // 합성 key 에서 상품 identity 를 추측하지 않는다.
  assert.equal(buildIdentityKey(picks[0]), null);
});

test("시각이 아예 없으면 1970년으로 날조하지 않는다", () => {
  const { picks } = normalizeStoredPicks(
    JSON.stringify([{ title: "구 항목" }]),
    NOW,
  );
  assert.deepEqual(picks[0].savedAt, { basis: "unknown", rawValue: null });
});

test("이해할 수 없는 미래 버전 행은 파괴하지 않고 건너뛴다", () => {
  const future = {
    schemaVersion: 3,
    category: "cosmetics",
    productId: "anr",
    title: "ANR",
    basis: "verified-pair",
    savedAt: { basis: "device-clock", epochMs: NOW },
    amount: 25_000,
  };

  const { picks, droppedItems, blockedByNewerSchema } = normalizeStoredPicks(
    JSON.stringify([future]),
    NOW,
  );

  assert.equal(picks.length, 0);
  // 버린 게 아니라 건너뛴 것이다. droppedItems 로 세면 호출부가 손실로 오해한다.
  assert.equal(droppedItems, 0);
  assert.equal(blockedByNewerSchema, true);
});

test("섞인 배열에서도 미래 행을 봤다는 사실이 전달된다", () => {
  const v2 = createVerifiedPick({
    category: "cosmetics",
    productId: "anr",
    title: "ANR",
    savedAt: NOW,
    now: NOW,
  });
  const { picks, blockedByNewerSchema } = normalizeStoredPicks(
    JSON.stringify([v2, { schemaVersion: 9, title: "미래" }]),
    NOW,
  );

  assert.equal(picks.length, 1);
  // 이 값이 false 면 호출부가 부분 목록을 저장소에 되쓰고 미래 행을 지운다.
  assert.equal(blockedByNewerSchema, true);
});

test("손상된 JSON은 격리하고 저장소를 비우지 않는다", () => {
  const { picks, quarantined } = normalizeStoredPicks("{not json", NOW);

  assert.deepEqual(picks, []);
  assert.equal(quarantined, "{not json");
});

test("배열 안 개별 항목이 깨져도 나머지는 살린다", () => {
  const good = createVerifiedPick({
    category: "cosmetics",
    productId: "anr",
    title: "ANR",
    savedAt: NOW,
    now: NOW,
  });

  const { picks, droppedItems, quarantined } = normalizeStoredPicks(
    JSON.stringify([good, null, { title: "" }, 42]),
    NOW,
  );

  assert.equal(quarantined, null);
  assert.equal(picks.length, 1);
  assert.equal(droppedItems, 3);
});

test("identity를 모르는 항목끼리는 같은 선택으로 병합하지 않는다", () => {
  const { picks } = normalizeStoredPicks(
    JSON.stringify([
      { title: "구 항목 A", savedAt: 1 },
      { title: "구 항목 B", savedAt: 2 },
    ]),
    NOW,
  );

  assert.equal(picks.length, 2);
  assert.equal(findExistingPick(picks, null), undefined);
});

test("안정 identity가 같으면 중복 저장을 막는다", () => {
  const pick = createVerifiedPick({
    category: "cosmetics",
    productId: "anr",
    title: "ANR",
    savedAt: NOW,
    now: NOW,
  });
  const identity = buildIdentityKey(pick);

  assert.notEqual(identity, null);
  assert.equal(findExistingPick([pick], identity), pick);
  assert.equal(findExistingPick([pick], "cosmetics:other"), undefined);
});

const make = (productId, title) =>
  createVerifiedPick({
    category: "cosmetics",
    productId,
    title,
    savedAt: NOW,
    now: NOW,
  });

test("추가는 다른 탭이 저장한 항목을 지우지 않는다", () => {
  // 탭 B 가 저장한 발베니가 저장소에 있고, 탭 A 는 마운트 시점 스냅샷을 들고 있다.
  // 저장 직전에 저장소를 다시 읽으므로 발베니가 살아남는다.
  const stored = [make("p1", "P1"), make("p2", "P2"), make("balvenie", "발베니")];

  const next = appendPick(stored, make("anr", "ANR"));

  assert.equal(next.length, 4);
  assert.ok(next.some((pick) => pick.productId === "balvenie"));
  assert.ok(next.some((pick) => pick.productId === "anr"));
});

test("이미 있는 선택은 다시 더하지 않는다", () => {
  const stored = [make("anr", "ANR")];
  assert.equal(appendPick(stored, make("anr", "ANR")).length, 1);
});

test("identity 없는 legacy 행은 저장할 때마다 늘어나지 않는다", () => {
  // 실제로 겪은 회귀: 저장소 목록과 화면 스냅샷을 함께 넘겼더니, identity 를
  // 만들 수 없는 legacy 행이 중복 판정을 통과해 저장할 때마다 배로 늘었다.
  // 여섯 번 저장에 사본 48개가 쌓이고 사용자가 직접 저장한 항목이 상한에
  // 밀려 사라졌다.
  let storage = JSON.stringify([{ title: "에스티로더 갈색병", savedAt: 8_123 }]);
  const mounted = normalizeStoredPicks(storage, NOW);
  storage = JSON.stringify(mounted.picks);

  for (let index = 1; index <= 6; index += 1) {
    const current = normalizeStoredPicks(storage, NOW);
    storage = JSON.stringify(
      appendPick(current.picks, make(`p${index}`, `P${index}`)),
    );
  }

  const final = normalizeStoredPicks(storage, NOW).picks;
  // legacy 행 1개 + 저장한 6개.
  assert.equal(final.length, 7);
  assert.equal(final.filter((pick) => pick.productId === null).length, 1);
  for (let index = 1; index <= 6; index += 1) {
    assert.ok(final.some((pick) => pick.productId === `p${index}`));
  }
});

test("주류 pick은 취향 슬롯이 아니라 병을 가리킨다", () => {
  // 취향 키로 저장하면 "처음 마셔요"의 추천 병이 바뀌는 순간 이미 저장된
  // 항목 전부가 사용자가 고른 적 없는 상품을 가리킨다.
  const bottle = buildIdentityKey({
    category: "liquor",
    productId: "balvenie-doublewood-12",
  });
  const tasteSlot = buildIdentityKey({
    category: "liquor",
    productId: "beginner",
  });

  assert.equal(bottle, "liquor:balvenie-doublewood-12");
  assert.notEqual(bottle, tasteSlot);

  // 취향 키로 저장됐던 구 항목은 새 identity 와 같다고 보지 않는다.
  // 되돌릴 수 없는 값을 추측하느니 눈에 보이는 중복이 낫다.
  const legacy = createVerifiedPick({
    category: "liquor",
    productId: "beginner",
    title: "발베니 12 더블우드",
    savedAt: NOW,
    now: NOW,
  });
  assert.equal(findExistingPick([legacy], bottle), undefined);
});

test("추가는 상한을 넘지 않는다", () => {
  const many = Array.from({ length: MAX_SAVED_PICKS + 10 }, (_, index) =>
    make(`p${index}`, `P${index}`),
  );
  assert.equal(appendPick(many, make("new", "NEW")).length, MAX_SAVED_PICKS);
});
