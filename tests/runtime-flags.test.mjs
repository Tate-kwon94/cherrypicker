import assert from "node:assert/strict";
import test from "node:test";
import {
  parseFlag,
  parseRuntimeFlags,
  resolveAdsenseConfig,
  CLOSED_FLAGS,
  DISABLED_ADSENSE,
  RUNTIME_FLAG_NAMES,
} from "../app/lib/runtime-flags.ts";

test("정식 플래그 집합은 다섯 개다", () => {
  // TELEMETRY_ENABLED 를 뺐다 — 이 저장소에 텔레메트리 코드가 없어
  // 끌 대상이 없는 스위치였다. tests/flag-enforcement.test.mjs 가
  // 남은 다섯 개가 실제로 무언가를 막는지 검사한다.
  assert.equal(RUNTIME_FLAG_NAMES.length, 5);
  assert.deepEqual([...RUNTIME_FLAG_NAMES].sort(), [
    "ADMIN_UI_ENABLED",
    "ALCOHOL_COMMERCE_ENABLED",
    "AUTO_CONFIRM_ENABLED",
    "KAKAO_IMPORT_ENABLED",
    "MONETIZATION_ENABLED",
  ]);
});

test("정확히 \"true\"일 때만 켜진다", () => {
  assert.equal(parseFlag("true"), true);
  for (const value of ["TRUE", "True", "1", "yes", "on", "", " true", true, 1]) {
    assert.equal(parseFlag(value), false, `${String(value)} 는 켜면 안 된다`);
  }
});

test("값이 없거나 판독에 실패하면 전부 꺼진 상태다", () => {
  assert.deepEqual(parseRuntimeFlags(null), CLOSED_FLAGS);
  assert.deepEqual(parseRuntimeFlags(undefined), CLOSED_FLAGS);
  assert.deepEqual(parseRuntimeFlags({}), CLOSED_FLAGS);
  for (const name of RUNTIME_FLAG_NAMES) {
    assert.equal(CLOSED_FLAGS[name], false);
  }
});

test("오타는 기능을 켜지 않는다", () => {
  const flags = parseRuntimeFlags({
    MONETIZATION_ENABLE: "true", // 이름 오타
    KAKAO_IMPORT_ENABLED: "ture", // 값 오타
    ADMIN_UI_ENABLED: "true",
  });

  assert.equal(flags.MONETIZATION_ENABLED, false);
  assert.equal(flags.KAKAO_IMPORT_ENABLED, false);
  assert.equal(flags.ADMIN_UI_ENABLED, true);
});

test("수익화가 꺼져 있으면 AdSense 설정을 노출하지 않는다", () => {
  const source = {
    ADSENSE_CLIENT: "ca-pub-1234567890",
    ADSENSE_SLOT_HOME_CONTENT: "9876543210",
  };

  assert.deepEqual(resolveAdsenseConfig(source, false), DISABLED_ADSENSE);
  assert.deepEqual(resolveAdsenseConfig(source, true), {
    client: "ca-pub-1234567890",
    homeContentSlot: "9876543210",
  });
});

test("AdSense client 형식이 아니면 슬롯도 함께 막는다", () => {
  assert.deepEqual(
    resolveAdsenseConfig(
      { ADSENSE_CLIENT: "pub-123", ADSENSE_SLOT_HOME_CONTENT: "999" },
      true,
    ),
    DISABLED_ADSENSE,
  );
  assert.deepEqual(
    resolveAdsenseConfig({ ADSENSE_SLOT_HOME_CONTENT: "999" }, true),
    DISABLED_ADSENSE,
  );
});
