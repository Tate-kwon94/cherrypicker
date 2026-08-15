#!/usr/bin/env node
/**
 * Tesseract 실행 자산을 `node_modules` 에서 `public/ocr/` 로 복사한다 (M-26).
 *
 * `createWorker` 는 경로를 주지 않으면 worker 스크립트와 wasm 코어를
 * jsdelivr 에서 받는다. 즉 제3자 출처가 우리 페이지 안에서 **코드를
 * 실행한다**. 그 출처가 바뀌거나 뚫리면 사용자의 장바구니 캡처를 읽는
 * 코드가 함께 바뀐다.
 *
 * 자산은 이미 `node_modules` 에 있으므로 받아올 필요가 없다. 저장소에
 * 커밋하지도 않는다 — 복사본이 원본과 어긋나면 어느 쪽이 맞는지 알 수 없고,
 * 버전은 `package.json` 이 이미 고정하고 있다.
 *
 * 언어 데이터(`kor.traineddata`)는 여기 없다. 그건 별도 결정이 필요하다 —
 * 파일이 크고, 받아서 어딘가에 두는 것은 이 스크립트가 정할 일이 아니다.
 * 그때까지 언어 데이터만 CDN 에서 오고, CSP 는 그 사실을 그대로 적는다.
 */
import { copyFile, mkdir, readFile, access } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import process from "node:process";

const root = process.cwd();
const target = resolve(root, "public/ocr");

/**
 * 복사 대상.
 *
 * SIMD 판과 비-SIMD 판을 모두 둔다 — tesseract.js 가 실행 시점에 브라우저
 * 지원을 보고 고르므로, 하나만 두면 지원하지 않는 기기에서 404 가 난다.
 */
const assets = [
  ["tesseract.js/dist/worker.min.js", "worker.min.js"],
  ["tesseract.js-core/tesseract-core-lstm.wasm", "tesseract-core-lstm.wasm"],
  ["tesseract.js-core/tesseract-core-lstm.wasm.js", "tesseract-core-lstm.wasm.js"],
  [
    "tesseract.js-core/tesseract-core-simd-lstm.wasm",
    "tesseract-core-simd-lstm.wasm",
  ],
  [
    "tesseract.js-core/tesseract-core-simd-lstm.wasm.js",
    "tesseract-core-simd-lstm.wasm.js",
  ],
];

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

const failures = [];

await mkdir(target, { recursive: true });

for (const [from, to] of assets) {
  const source = resolve(root, "node_modules", from);
  if (!(await exists(source))) {
    failures.push(
      `${from} 이 node_modules 에 없습니다. tesseract.js 버전이 바뀌어 파일 ` +
        `이름이 달라졌을 수 있습니다 — 자산이 없으면 조용히 CDN 으로 ` +
        `돌아가므로 통과가 아니라 실패입니다.`,
    );
    continue;
  }
  const destination = resolve(target, to);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(source, destination);
}

// 복사한 worker 가 우리가 기대한 버전인지 확인한다.
const declared = JSON.parse(
  await readFile(resolve(root, "package.json"), "utf8"),
).dependencies?.["tesseract.js"];
const installed = JSON.parse(
  await readFile(resolve(root, "node_modules/tesseract.js/package.json"), "utf8"),
).version;

if (declared && installed && declared !== installed) {
  failures.push(
    `tesseract.js 선언 버전(${declared})과 설치 버전(${installed})이 다릅니다. ` +
      `복사한 worker 가 앱이 기대하는 것과 다를 수 있습니다.`,
  );
}

if (failures.length > 0) {
  console.error("OCR 자산 복사 실패:");
  for (const message of failures) console.error(`  - ${message}`);
  process.exit(1);
}

console.log(`OCR 자산 ${assets.length}개를 public/ocr/ 로 복사했습니다.`);
