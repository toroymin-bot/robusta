#!/usr/bin/env node
/**
 * verify-d53-cron.mjs
 *   - C-D53-1 (D-1 07시 슬롯, 2026-05-07) — Tori spec C-D53-1 (B-D53-2 / D-52-자-3 본체).
 *
 * Why: GH Actions hourly cron yaml + run-release-snapshot-cron.mjs CLI 진입점 정적 검증.
 *
 * 게이트 (5/5 PASS 의무):
 *   1) .github/workflows/release-snapshot-cron.yml 파일 존재
 *   2) cron: '0 * * * *' 정확 매칭 (hourly UTC)
 *   3) workflow_dispatch: 존재 (수동 트리거 가능)
 *   4) steps 1+ 정의 (jobs.snapshot.steps)
 *   5) secrets 0 leak (${{ secrets. }} 패턴 0건)
 *
 * 외부 dev-deps +0 (node 표준만).
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { existsSync } from "node:fs";

const root = resolve(process.cwd());
const yamlPath = resolve(root, ".github/workflows/release-snapshot-cron.yml");

function pass(label) {
  console.log(`  ✓ ${label}`);
}
function fail(label, msg) {
  console.error(`  ✗ ${label} — ${msg}`);
  process.exitCode = 1;
}

async function main() {
  console.log("verify:d53-cron — GH Actions hourly cron yaml 정적 검증");

  // 1) 파일 존재.
  if (!existsSync(yamlPath)) {
    fail("1. yaml 파일 존재", "release-snapshot-cron.yml 미발견");
    return;
  }
  pass("1. .github/workflows/release-snapshot-cron.yml 파일 존재");

  const src = await readFile(yamlPath, "utf8");

  // 2) cron: '0 * * * *' 정확 매칭.
  if (/cron:\s*["']?0\s+\*\s+\*\s+\*\s+\*["']?/.test(src)) {
    pass("2. cron: '0 * * * *' hourly UTC 정확 매칭");
  } else {
    fail("2. cron schedule", "'0 * * * *' 패턴 미발견");
  }

  // 3) workflow_dispatch 존재.
  if (/workflow_dispatch\s*:/.test(src)) {
    pass("3. workflow_dispatch 수동 트리거 정의");
  } else {
    fail("3. workflow_dispatch", "수동 트리거 미정의");
  }

  // 4) steps 1+ 정의.
  const stepsMatch = src.match(/steps:\s*\n((?:\s{6,}.*\n?)+)/);
  if (stepsMatch && /-\s+(name|uses|run):/.test(stepsMatch[1])) {
    const stepCount = (stepsMatch[1].match(/^\s+-\s+(name|uses|run):/gm) || [])
      .length;
    pass(`4. jobs.snapshot.steps ${stepCount}+ 정의`);
  } else {
    fail("4. steps", "steps 정의 미발견");
  }

  // 5) secrets 0 leak.
  const secretsMatches = src.match(/\$\{\{\s*secrets\./g);
  if (!secretsMatches || secretsMatches.length === 0) {
    pass("5. secrets 0 leak (${{ secrets. }} 패턴 0건)");
  } else {
    fail(
      "5. secrets leak",
      `${secretsMatches.length} 건 발견 — RELEASE_ISO 는 plain env, 비밀 아님`,
    );
  }

  if (process.exitCode === 1) {
    console.error("verify:d53-cron — FAIL");
  } else {
    console.log("verify:d53-cron — 5/5 PASS");
  }
}

main().catch((err) => {
  console.error("verify:d53-cron — ERROR", err);
  process.exit(1);
});
