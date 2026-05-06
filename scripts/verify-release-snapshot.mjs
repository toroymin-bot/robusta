#!/usr/bin/env node
/**
 * verify-release-snapshot.mjs
 *   - C-D51-1 분리 게이트 (D-2 23시 슬롯, 2026-05-06) — Tori spec C-D51-1.
 *
 * Why: src/modules/launch/release-snapshot.ts buildReleaseSnapshot 구조 검증 (6 게이트).
 *   verify-d51 통합에 흡수.
 *
 * 6 gates:
 *   1) buildReleaseSnapshot export grep
 *   2) D-2/D-1/D-0/D+1 4 분기 enum grep
 *   3) readiness 'green'|'yellow'|'red' 3 색 enum grep
 *   4) summaryLine 형식 'D-{N} {N}h · regression {N}/{N}' grep
 *   5) RELEASE_ISO 미설정 fallback grep
 *   6) vercelStatus='red' 우선 분기 grep
 *
 * 외부 dev-deps +0 (node 표준만).
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(process.cwd());

function pass(label) {
  console.log(`  ✓ ${label}`);
}
function fail(label, msg) {
  console.error(`  ✗ ${label} — ${msg}`);
  process.exitCode = 1;
}

async function main() {
  console.log("verify:release-snapshot — C-D51-1 buildReleaseSnapshot (6 gates)");

  const filePath = resolve(root, "src/modules/launch/release-snapshot.ts");
  const src = await readFile(filePath, "utf8");

  // 1) buildReleaseSnapshot export.
  if (/export\s+function\s+buildReleaseSnapshot\s*\(/.test(src)) {
    pass("1. buildReleaseSnapshot export 정의");
  } else {
    fail("1. export", "buildReleaseSnapshot export 미발견");
  }

  // 2) DDay 4 enum.
  const dDayEnum = /export\s+type\s+DDay\s*=\s*"D-2"\s*\|\s*"D-1"\s*\|\s*"D-0"\s*\|\s*"D\+1"/;
  if (dDayEnum.test(src)) {
    pass("2. DDay 4 enum (D-2|D-1|D-0|D+1)");
  } else {
    fail("2. DDay enum", "4 분기 enum 정의 미발견");
  }

  // 3) Readiness 3 enum.
  const readinessEnum = /export\s+type\s+Readiness\s*=\s*"green"\s*\|\s*"yellow"\s*\|\s*"red"/;
  if (readinessEnum.test(src)) {
    pass("3. Readiness 3 enum (green|yellow|red)");
  } else {
    fail("3. Readiness enum", "3 색 enum 정의 미발견");
  }

  // 4) summaryLine 형식 'D-{N} {N}h · regression {N}/{N}'
  // (template literal 구성: ${dDay} ${hoursAbs}h · regression ${pass}/${total})
  const summaryFormat =
    /\$\{dDay\}\s+\$\{hoursAbs\}h\s*·\s*regression\s+\$\{opts\.lastRegression\.pass\}\/\$\{opts\.lastRegression\.total\}/;
  if (summaryFormat.test(src)) {
    pass("4. summaryLine 형식 'D-{N} {N}h · regression {N}/{N}'");
  } else {
    fail("4. summaryLine", "형식 미발견");
  }

  // 5) RELEASE_ISO 미설정 fallback.
  if (/RELEASE_ISO 미설정/.test(src) && /!opts\.releaseIso/.test(src)) {
    pass("5. RELEASE_ISO 미설정 fallback (!opts.releaseIso → red)");
  } else {
    fail("5. fallback", "미설정 분기 미발견");
  }

  // 6) vercelStatus='red' 우선 분기.
  if (/opts\.vercelStatus\s*===\s*"red"/.test(src)) {
    pass("6. vercelStatus='red' 우선 분기");
  } else {
    fail("6. vercel red", "분기 미발견");
  }

  if (process.exitCode === 1) {
    console.error("verify:release-snapshot — FAIL");
  } else {
    console.log("verify:release-snapshot — 6/6 PASS");
  }
}

main().catch((err) => {
  console.error("verify:release-snapshot — ERROR", err);
  process.exit(1);
});
