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
 *   4. Sites 단기 토큰이 프로세스 환경으로 주입됐는가
 *   5. 토큰을 per-command HTTP header 로만 넘겨 main 을 push 한다.
 *      사용자명 prompt, remote URL, Git 설정 어디에도 토큰을 남기지 않는다.
 */
import { execFileSync, spawnSync } from "node:child_process";
import process from "node:process";
import { pathToFileURL } from "node:url";

export const SITES_TOKEN_ENV = "SITES_GIT_TOKEN";
export const SITES_AUTH_HEADER_ENV = "CHERRYPICKER_SITES_AUTH_HEADER";

export function createSitesGitAuth(token) {
  const normalized = typeof token === "string" ? token.trim() : "";
  if (!normalized) return null;

  return {
    gitArgs: [`--config-env=http.extraHeader=${SITES_AUTH_HEADER_ENV}`],
    env: {
      [SITES_AUTH_HEADER_ENV]: `Authorization: Bearer ${normalized}`,
      GIT_TERMINAL_PROMPT: "0",
    },
  };
}

const run = (cmd, args) =>
  execFileSync(cmd, args, { encoding: "utf8" }).trim();

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

function main() {
  // 토큰은 push 때까지 메모리에만 보관하고, 앞선 git/gh 자식 프로세스에는
  // 환경변수로 상속하지 않는다.
  const sitesToken = process.env[SITES_TOKEN_ENV];
  delete process.env[SITES_TOKEN_ENV];

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

  // 4. Sites 자격증명은 short-lived + http_extra_header 방식이다. 환경에
  // 토큰이 없으면 일반 Git credential prompt 로 물러서지 않고 즉시 멈춘다.
  const auth = createSitesGitAuth(sitesToken);
  if (!auth) {
    fail(
      `${SITES_TOKEN_ENV}이 없습니다. GitHub 사용자명을 입력하지 마세요. ` +
        "Codex에 `main <SHA> 배포해`라고 요청해 Sites 단기 자격증명을 주입한 뒤 실행해야 합니다.",
    );
  }

  // 5. 배포 푸시 — URL과 Git 설정에는 token을 남기지 않는다. config-env로
  // 이 자식 프로세스에만 Authorization header를 전달하고 prompt도 금지한다.
  const deployUrl =
    "https://git.chatgpt-team.site/d5f6ca74-3c70-4114-9c48-6c2443d7b023/appgprj_6a6aea70ea048191a5af04fe8cbf02da.git";
  const pushEnv = { ...process.env, ...auth.env };
  delete pushEnv[SITES_TOKEN_ENV];
  console.log("Sites 배포 저장소로 검증된 main을 전달합니다.");
  const push = spawnSync(
    "git",
    [...auth.gitArgs, "push", deployUrl, "main:main"],
    { stdio: "inherit", env: pushEnv },
  );
  if (push.status !== 0) {
    fail("배포 푸시가 실패했습니다. Sites 단기 토큰이 만료됐는지 확인하세요.");
  }

  console.log(`✓ 배포 완료: ${local.slice(0, 7)} → Sites main`);
  console.log("  Sites 빌드가 끝나면 사이트에 반영됩니다.");
}

const entrypoint = process.argv[1];
if (entrypoint && import.meta.url === pathToFileURL(entrypoint).href) {
  main();
}
