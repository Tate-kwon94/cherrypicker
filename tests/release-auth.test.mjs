import assert from "node:assert/strict";
import test from "node:test";

import {
  createSitesGitAuth,
  SITES_AUTH_HEADER_ENV,
} from "../build/release.mjs";

test("Sites 단기 토큰이 없으면 Git 인증으로 물러서지 않는다", () => {
  assert.equal(createSitesGitAuth(undefined), null);
  assert.equal(createSitesGitAuth("   "), null);
});

test("Sites 토큰은 명령 인자가 아니라 per-command header 환경으로만 넘긴다", () => {
  const token = "test-short-lived-token";
  const auth = createSitesGitAuth(token);

  assert.ok(auth);
  assert.deepEqual(auth.gitArgs, [
    `--config-env=http.extraHeader=${SITES_AUTH_HEADER_ENV}`,
  ]);
  assert.equal(
    auth.env[SITES_AUTH_HEADER_ENV],
    `Authorization: Bearer ${token}`,
  );
  assert.equal(auth.env.GIT_TERMINAL_PROMPT, "0");
  assert.equal(auth.gitArgs.join(" ").includes(token), false);
});
