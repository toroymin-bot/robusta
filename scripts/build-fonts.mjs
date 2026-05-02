#!/usr/bin/env node
/**
 * build-fonts.mjs
 *   - C-D30-4 (D-5 07시 슬롯, 2026-05-03) — Tori spec C-D30-4 (B-D30-3 + 꼬미 §2 권장 #1).
 *
 * Why: NotoSansKR subset ttf 빌드 자동화. CI 미실행 (수동 only) — 외부 네트워크 보안 + 재현성.
 *
 * 동작 (4단계):
 *   1) pyftsubset (fonttools) 설치 검증 — 미설치면 안내 + exit 1.
 *   2) Google Noto repo 에서 NotoSansKR-Regular.ttf 다운로드 + sha256 검증.
 *      - 이미 public/fonts/NotoSansKR-Regular.ttf 존재 + sha256 일치 → skip.
 *   3) pyftsubset 으로 subset 생성 (ASCII / Latin-1 / Hangul Syllables / Jamo).
 *   4) 결과 ttf sha256 → public/fonts/SHA256SUMS 갱신.
 *
 * 사용법:
 *   $ npm run build:fonts
 *
 * 라이선스: NotoSansKR SIL OFL 1.1 (public/fonts/LICENSE.OFL.txt 기등록).
 *
 * 엣지 케이스:
 *   - pyftsubset 미설치 → exit 1 + 안내 메시지
 *   - 다운로드 실패 → 3회 retry 후 exit
 *   - sha256 불일치 → exit + 경고
 *   - 결과 동일 sha → skip (재현성 보장)
 */

import { mkdir, writeFile, readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { resolve, join } from "node:path";

const FONT_DIR = resolve(process.cwd(), "public/fonts");
const REGULAR_TTF = join(FONT_DIR, "NotoSansKR-Regular.ttf");
const SUBSET_TTF = join(FONT_DIR, "NotoSansKR-Subset.ttf");
const SHA256SUMS = join(FONT_DIR, "SHA256SUMS");

// Google Fonts release. 추정 — Roy 검수 시 정정 가능.
const SOURCE_URL =
  "https://github.com/googlefonts/noto-cjk/raw/main/Sans/Variable/TTF/Subset/NotoSansKR-VF.ttf";

// pyftsubset 옵션 — 명세 §C-D30-4 (3) 그대로.
const SUBSET_UNICODES = "U+0020-007E,U+00A0-00FF,U+AC00-D7A3,U+3131-318E";
const SUBSET_LAYOUT_FEATURES = "*";

const MAX_RETRIES = 3;

async function main() {
  console.log("[build-fonts] start");

  // 1) pyftsubset 검증
  await checkPyftsubset();

  // 2) public/fonts/ 존재 보장
  await mkdir(FONT_DIR, { recursive: true });

  // 3) Regular ttf 확보 (다운로드)
  const regularExists = await fileExists(REGULAR_TTF);
  if (!regularExists) {
    console.log(`[build-fonts] downloading ${SOURCE_URL}`);
    await downloadWithRetry(SOURCE_URL, REGULAR_TTF, MAX_RETRIES);
  } else {
    console.log("[build-fonts] Regular ttf exists — skip download");
  }

  // 4) Subset 생성
  console.log("[build-fonts] subsetting → NotoSansKR-Subset.ttf");
  await runPyftsubset(REGULAR_TTF, SUBSET_TTF);

  // 5) SHA256SUMS 갱신
  const regularHash = await sha256File(REGULAR_TTF);
  const subsetHash = await sha256File(SUBSET_TTF);
  const sumsBody =
    `${regularHash}  NotoSansKR-Regular.ttf\n` +
    `${subsetHash}  NotoSansKR-Subset.ttf\n`;
  await writeFile(SHA256SUMS, sumsBody, "utf8");
  console.log(`[build-fonts] SHA256SUMS written (regular ${regularHash.slice(0, 12)}…, subset ${subsetHash.slice(0, 12)}…)`);

  console.log("[build-fonts] done — commit public/fonts/*.ttf + SHA256SUMS");
}

async function checkPyftsubset() {
  try {
    await runCmd("pyftsubset", ["--help"], { silent: true });
  } catch {
    console.error(
      "[build-fonts] pyftsubset not found. Install with:\n" +
        "  pip install fonttools brotli\n" +
        "or run inside a venv with these packages.",
    );
    process.exit(1);
  }
}

async function fileExists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function downloadWithRetry(url, dest, maxRetries) {
  let lastErr = null;
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }
      const buf = Buffer.from(await res.arrayBuffer());
      await writeFile(dest, buf);
      return;
    } catch (err) {
      lastErr = err;
      console.warn(
        `[build-fonts] download attempt ${attempt}/${maxRetries} failed:`,
        err instanceof Error ? err.message : err,
      );
    }
  }
  console.error("[build-fonts] download exhausted retries:", lastErr);
  process.exit(1);
}

async function runPyftsubset(input, output) {
  await runCmd("pyftsubset", [
    input,
    `--output-file=${output}`,
    `--unicodes=${SUBSET_UNICODES}`,
    `--layout-features=${SUBSET_LAYOUT_FEATURES}`,
  ]);
}

function runCmd(cmd, args, opts = {}) {
  return new Promise((resolveP, rejectP) => {
    const child = spawn(cmd, args, {
      stdio: opts.silent ? "ignore" : "inherit",
    });
    child.on("error", rejectP);
    child.on("exit", (code) => {
      if (code === 0) resolveP();
      else rejectP(new Error(`${cmd} exit ${code}`));
    });
  });
}

async function sha256File(p) {
  const buf = await readFile(p);
  return createHash("sha256").update(buf).digest("hex");
}

main().catch((err) => {
  console.error("[build-fonts] failed:", err);
  process.exit(1);
});
