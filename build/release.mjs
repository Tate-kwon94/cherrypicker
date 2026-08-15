#!/usr/bin/env node
/**
 * 릴리스: 검증된 GitHub main 을 Sites 배포 저장소로 전달한다.
 *
 *   npm run release
 *
 * 두 저장소(GitHub = 개발·검증, Sites git = 배포 메커니즘)는 플랫폼 구조상
 * 하나로 합칠 수 없다 — Sites 콘솔에는 GitHub 연동이 없고(2026-08 확인),
 * 배포 토큰은 단기라 Actions 시크릿에 둘 수 없다(README 정책). 대신 사람
 * 손이 가는 부분을 이 한 명령으로 줄인다.
 *
 * 순서대로 검사하고, 하나라도 어긋나면 배포 없이 멈춘다:
 *   1. main 브랜치이고 작업 트리가 깨끗한가
 *   2. 로컬 main == origin/main 인가 (검증된 것과 다른 코드를 보내지 않게)
 *   3. GitHub verify 가 그 SHA 에서 통과했는가 — 지금까지 없던 게이트다.
 *      배포 푸시는 CI 를 거치지 않았다.
 *   4. git push openai main:main — 토큰은 이때 터미널이 직접 묻는다.
 *      어디에도 저장하지 않는다.
 */
import { execFileSync, spawnSync } from "node:child_process";
import process from "node:process";

const run = (cmd, args) =>
  execFileSync(cmd, args, { encoding: "utf8" }).trim();

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

// 1. 브랜치·트리 상태
if (run("git", ["branch", "--show-current"]) !== "main") {
  fail("main 브랜치에서만 릴리스합니다. `git checkout main` 후 다시 실행하세요.");
}
if (run("git", ["status", "--porcelain"]) !== "") {
  fail("작업 트리에 커밋되지 않은 변경이 있습니다. 커밋하거나 stash 하세요.");
}

// 2. origin/main 과 일치
run("git", ["fetch", "-q", "origin", "main"]);
const local = run("git", ["rev-parse", "HEAD"]);
const remote = run("git", ["rev-parse", "origin/main"]);
if (local !== remote) {
  fail(
    `로컬 main(${local.slice(0, 7)})이 origin/main(${remote.slice(0, 7)})과 다릅니다. ` +
      "검증된 것과 다른 코드를 배포할 수 없습니다 — pull 또는 push 로 맞추세요.",
  );
}

// 3. 그 SHA 의 GitHub verify 통과 확인
let conclusion = "";
try {
  conclusion = run("gh", [
    "run", "list",
    "--commit", local,
    "--workflow", "verify",
    "--json", "conclusion",
    "--jq", "[.[] | select(.conclusion == \"success\")] | length",
  ]);
} catch {
  fail("gh CLI 를 확인할 수 없습니다. `gh auth status` 로 로그인 상태를 보세요.");
}
if (conclusion === "0" || conclusion === "") {
  fail(
    `이 커밋(${local.slice(0, 7)})의 verify 성공 기록이 없습니다. ` +
      "GitHub Actions 가 아직 도는 중이거나 실패했습니다 — 통과 후 다시 실행하세요.",
  );
}
console.log(`✓ verify 통과 확인 (${local.slice(0, 7)})`);

// 4. 배포 푸시 — 소스 관리 정책상 Sites 저장소는 원격으로 등록하지 않으므로
// URL 로 직접 민다. 토큰 프롬프트가 사용자에게 가야 하므로 stdio 상속.
const DEPLOY_URL =
  "https://git.chatgpt-team.site/d5f6ca74-3c70-4114-9c48-6c2443d7b023/appgprj_6a6aea70ea048191a5af04fe8cbf02da.git";
console.log("Sites 배포 저장소로 푸시합니다. 사용자명/토큰을 물으면 입력하세요.");
const push = spawnSync("git", ["push", DEPLOY_URL, "main:main"], {
  stdio: "inherit",
});
if (push.status !== 0) {
  fail("배포 푸시가 실패했습니다. 토큰이 만료됐다면 새로 발급해 다시 실행하세요.");
}

console.log(`✓ 배포 완료: ${local.slice(0, 7)} → Sites main`);
console.log("  Sites 빌드가 끝나면 사이트에 반영됩니다.");
