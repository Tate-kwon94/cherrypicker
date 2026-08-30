import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  DEPLOY_WORKFLOW,
  selectTriggeredRun,
} from "../build/release-github.mjs";

test("GitHub 배포 workflow 이름을 고정한다", () => {
  assert.equal(DEPLOY_WORKFLOW, "deploy-cloudflare.yml");
});

test("배포 workflow가 운영 감사와 배포 직전 main 재검증을 강제한다", () => {
  const workflow = readFileSync(
    new URL("../.github/workflows/deploy-cloudflare.yml", import.meta.url),
    "utf8",
  );
  const auditIndex = workflow.indexOf(
    "npm audit --omit=dev --audit-level=high",
  );
  const mainChecks = [...workflow.matchAll(/git fetch origin main/g)];
  const deployIndex = workflow.indexOf("npm run deploy:cloudflare:built");

  assert.ok(auditIndex > workflow.indexOf("npm run verify"));
  assert.equal(mainChecks.length, 2);
  assert.ok(mainChecks[1].index > auditIndex);
  assert.ok(mainChecks[1].index < deployIndex);
});

test("현재 SHA로 방금 시작한 workflow만 선택한다", () => {
  const startedAt = Date.parse("2026-08-29T14:00:00Z");
  const runs = [
    {
      databaseId: 3,
      headSha: "new-sha",
      createdAt: "2026-08-29T14:00:02Z",
      url: "https://github.example/new",
    },
    {
      databaseId: 2,
      headSha: "other-sha",
      createdAt: "2026-08-29T14:00:01Z",
      url: "https://github.example/other",
    },
    {
      databaseId: 1,
      headSha: "new-sha",
      createdAt: "2026-08-29T13:50:00Z",
      url: "https://github.example/old",
    },
  ];

  assert.equal(
    selectTriggeredRun(runs, { sha: "new-sha", startedAt })?.databaseId,
    3,
  );
  assert.equal(
    selectTriggeredRun(runs, { sha: "missing", startedAt }),
    null,
  );
});
