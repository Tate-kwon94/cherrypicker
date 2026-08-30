import assert from "node:assert/strict";
import { createSign, generateKeyPairSync } from "node:crypto";
import test from "node:test";
import {
  normalizeTeamDomain,
  verifyAccessJwt,
} from "../app/lib/cloudflare-access.ts";

const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "key-1", use: "sig" };
const otherPair = generateKeyPairSync("rsa", { modulusLength: 2048 });

const config = { teamDomain: "team.cloudflareaccess.com", aud: "aud-tag-1" };
const now = Date.UTC(2026, 7, 30, 12, 0, 0);
const fetchJwks = async () => ({ keys: [jwk] });

function b64url(value) {
  return Buffer.from(value).toString("base64url");
}

function signJwt({
  header = { alg: "RS256", kid: "key-1" },
  payload = {},
  key = privateKey,
} = {}) {
  const body = {
    iss: `https://${config.teamDomain}`,
    aud: [config.aud],
    email: "Tate_kwon@outlook.com",
    exp: Math.floor(now / 1000) + 600,
    nbf: Math.floor(now / 1000) - 60,
    ...payload,
  };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(body))}`;
  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  const signature = signer.sign(key).toString("base64url");
  return `${signingInput}.${signature}`;
}

test("정상 토큰은 이메일을 돌려준다", async () => {
  const identity = await verifyAccessJwt(signJwt(), config, { now, fetchJwks });
  assert.deepEqual(identity, { email: "Tate_kwon@outlook.com" });
});

test("서명이 다른 키의 것이면 신원이 아니다", async () => {
  // 헤더를 위조해 보내는 공격자는 팀의 개인키가 없다 — 여기서 끝나야 한다.
  const forged = signJwt({ key: otherPair.privateKey });
  assert.equal(await verifyAccessJwt(forged, config, { now, fetchJwks }), null);
});

test("본문을 바꾸면 서명이 깨진다", async () => {
  const token = signJwt();
  const [h, , s] = token.split(".");
  const tampered = `${h}.${b64url(
    JSON.stringify({
      iss: `https://${config.teamDomain}`,
      aud: [config.aud],
      email: "attacker@example.com",
      exp: Math.floor(now / 1000) + 600,
    }),
  )}.${s}`;
  assert.equal(await verifyAccessJwt(tampered, config, { now, fetchJwks }), null);
});

test("다른 Access 앱의 토큰(aud 불일치)은 거부한다", async () => {
  const other = signJwt({ payload: { aud: ["other-app"] } });
  assert.equal(await verifyAccessJwt(other, config, { now, fetchJwks }), null);
});

test("다른 팀 발급(iss 불일치)은 거부한다", async () => {
  const other = signJwt({ payload: { iss: "https://evil.cloudflareaccess.com" } });
  assert.equal(await verifyAccessJwt(other, config, { now, fetchJwks }), null);
});

test("만료 토큰은 거부한다", async () => {
  const expired = signJwt({ payload: { exp: Math.floor(now / 1000) - 10 } });
  assert.equal(await verifyAccessJwt(expired, config, { now, fetchJwks }), null);
});

test("알고리즘 다운그레이드는 검증을 시작하지도 않는다", async () => {
  // alg=none / HS256 은 서명 검증을 우회하는 고전 경로다.
  for (const alg of ["none", "HS256"]) {
    const token = signJwt({ header: { alg, kid: "key-1" } });
    assert.equal(await verifyAccessJwt(token, config, { now, fetchJwks }), null);
  }
});

test("모르는 kid·형식 불량·JWKS 장애는 전부 신원 없음이다", async () => {
  const unknownKid = signJwt({ header: { alg: "RS256", kid: "other" } });
  assert.equal(
    await verifyAccessJwt(unknownKid, config, { now, fetchJwks }),
    null,
  );
  for (const bad of ["", "a.b", "a.b.c.d", "!!!.@@@.###"]) {
    assert.equal(await verifyAccessJwt(bad, config, { now, fetchJwks }), null);
  }
  assert.equal(
    await verifyAccessJwt(signJwt(), config, {
      now,
      fetchJwks: async () => {
        throw new Error("jwks down");
      },
    }),
    null,
  );
});

test("이메일 없는 토큰은 신원이 아니다", async () => {
  const token = signJwt({ payload: { email: "" } });
  assert.equal(await verifyAccessJwt(token, config, { now, fetchJwks }), null);
});

test("팀 도메인 표기는 정규화된다", () => {
  assert.equal(
    normalizeTeamDomain("https://team.cloudflareaccess.com/"),
    "team.cloudflareaccess.com",
  );
  assert.equal(normalizeTeamDomain(" team.cloudflareaccess.com "), "team.cloudflareaccess.com");
});
