import assert from "node:assert/strict";
import test from "node:test";

import {
  DEPLOY_WORKFLOW,
  selectTriggeredRun,
} from "../build/release-github.mjs";

test("GitHub 배포 workflow 이름을 고정한다", () => {
  assert.equal(DEPLOY_WORKFLOW, "deploy-cloudflare.yml");
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
