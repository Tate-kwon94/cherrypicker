#!/usr/bin/env node
/**
 * GitHub 기반 운영 릴리스.
 *
 * 로컬 main과 GitHub main, verify 성공 기록을 확인한 다음 GitHub Actions의
 * Cloudflare 배포 workflow를 정확한 SHA로 실행하고 끝날 때까지 기다린다.
 * Cloudflare 자격증명은 GitHub Actions secret에만 있고 로컬로 내려오지 않는다.
 */
import { execFileSync, spawnSync } from "node:child_process";
import process from "node:process";
import { pathToFileURL } from "node:url";

export const DEPLOY_WORKFLOW = "deploy-cloudflare.yml";

const run = (cmd, args) =>
  execFileSync(cmd, args, { encoding: "utf8" }).trim();

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

export function selectTriggeredRun(runs, { sha, startedAt }) {
  return runs.find((runItem) =>
    runItem.headSha === sha &&
    Date.parse(runItem.createdAt) >= startedAt - 5_000,
  ) ?? null;
}

function wait(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function main() {
  if (run("git", ["branch", "--show-current"]) !== "main") {
    fail("main 브랜치에서만 릴리스합니다. `git checkout main` 후 다시 실행하세요.");
  }
  if (run("git", ["status", "--porcelain"]) !== "") {
    fail("작업 트리에 커밋되지 않은 변경이 있습니다. 커밋하거나 stash 하세요.");
  }

  run("git", ["fetch", "-q", "origin", "main"]);
  const local = run("git", ["rev-parse", "HEAD"]);
  const remote = run("git", ["rev-parse", "origin/main"]);
  if (local !== remote) {
    fail(
      `로컬 main(${local.slice(0, 7)})이 origin/main(${remote.slice(0, 7)})과 다릅니다. ` +
        "pull 또는 push로 먼저 맞추세요.",
    );
  }

  let verified = "";
  try {
    verified = run("gh", [
      "run", "list",
      "--commit", local,
      "--workflow", "verify",
      "--json", "conclusion",
      "--jq", "[.[] | select(.conclusion == \"success\")] | length",
    ]);
  } catch {
    fail("GitHub CLI 로그인이 필요합니다. `gh auth login` 후 다시 실행하세요.");
  }
  if (verified === "0" || verified === "") {
    fail(`이 커밋(${local.slice(0, 7)})의 verify 성공 기록이 없습니다.`);
  }

  console.log(`✓ verify 통과 확인 (${local.slice(0, 7)})`);
  const startedAt = Date.now();
  run("gh", [
    "workflow", "run", DEPLOY_WORKFLOW,
    "--ref", "main",
    "--field", `commit_sha=${local}`,
  ]);
  console.log("GitHub Actions가 Cloudflare 운영 배포를 시작했습니다.");

  let triggered = null;
  for (let attempt = 0; attempt < 20 && !triggered; attempt += 1) {
    if (attempt > 0) wait(1_500);
    const runs = JSON.parse(run("gh", [
      "run", "list",
      "--workflow", DEPLOY_WORKFLOW,
      "--event", "workflow_dispatch",
      "--branch", "main",
      "--limit", "20",
      "--json", "databaseId,headSha,createdAt,url",
    ]));
    triggered = selectTriggeredRun(runs, { sha: local, startedAt });
  }

  if (!triggered) {
    fail("방금 시작한 Cloudflare 배포 실행을 GitHub에서 찾지 못했습니다.");
  }

  const watched = spawnSync(
    "gh",
    ["run", "watch", String(triggered.databaseId), "--exit-status"],
    { stdio: "inherit" },
  );
  if (watched.status !== 0) {
    fail(`Cloudflare 배포가 실패했습니다: ${triggered.url}`);
  }

  console.log(`✓ Cloudflare 배포 완료: ${local.slice(0, 7)}`);
  console.log(`  실행 기록: ${triggered.url}`);
}

const entrypoint = process.argv[1];
if (entrypoint && import.meta.url === pathToFileURL(entrypoint).href) {
  main();
}
