#!/usr/bin/env node
/**
 * verify-freeze-hook.mjs
 *   - C-D52-4 (D-1 03시 슬롯, 2026-05-07) — Tori spec C-D52-4 (B-D52-1 게이트).
 *
 * Why: pre-commit-freeze.sh 5 케이스 검증 — 5/7 23:00 KST 차단 강제력 확인.
 *
 * 5 cases:
 *   1) pre-freeze (5/7 22:59:59 KST) → exit 0
 *   2) post-freeze (5/7 23:00:01 KST) → exit 1
 *   3) RELEASE_FREEZE_OVERRIDE=1 → exit 0 (emergency bypass)
 *   4) FREEZE 시각 정확 = 5/7 23:00:00 KST 정각 → exit 0 (경계 inclusive)
 *   5) D-Day (5/8 00:00:01 KST) → exit 1 (post-freeze)
 *
 * 외부 dev-deps +0 (node 표준 spawnSync).
 */

import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { existsSync } from "node:fs";

const root = resolve(process.cwd());
const hookPath = resolve(root, "scripts/hooks/pre-commit-freeze.sh");

function pass(label) {
  console.log(`  ✓ ${label}`);
}
function fail(label, msg) {
  console.error(`  ✗ ${label} — ${msg}`);
  process.exitCode = 1;
}

function runHook(env) {
  return spawnSync(hookPath, [], {
    cwd: root,
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
}

console.log("verify:freeze-hook — C-D52-4 (B-D52-1) 5 케이스");

// 0) hook 파일 존재 검증.
if (!existsSync(hookPath)) {
  fail("0. hook 파일", `${hookPath} 미존재`);
  process.exit(1);
}
pass("0. scripts/hooks/pre-commit-freeze.sh 존재");

// 1) pre-freeze (5/7 22:59:59 KST) → exit 0.
{
  const r = runHook({ NOW_ISO_OVERRIDE: "2026-05-07T22:59:59+09:00" });
  if (r.status === 0) {
    pass("1. pre-freeze (5/7 22:59:59 KST) → exit 0");
  } else {
    fail("1. pre-freeze", `exit ${r.status} stderr=${r.stderr}`);
  }
}

// 2) post-freeze (5/7 23:00:01 KST) → exit 1.
{
  const r = runHook({ NOW_ISO_OVERRIDE: "2026-05-07T23:00:01+09:00" });
  if (r.status === 1 && /RELEASE FREEZE active/.test(r.stderr)) {
    pass("2. post-freeze (5/7 23:00:01 KST) → exit 1 (RELEASE FREEZE active)");
  } else {
    fail("2. post-freeze", `exit ${r.status} stderr=${r.stderr}`);
  }
}

// 3) RELEASE_FREEZE_OVERRIDE=1 → exit 0 (emergency bypass).
{
  const r = runHook({
    NOW_ISO_OVERRIDE: "2026-05-08T00:00:01+09:00",
    RELEASE_FREEZE_OVERRIDE: "1",
  });
  if (r.status === 0 && /emergency bypass/.test(r.stderr)) {
    pass("3. RELEASE_FREEZE_OVERRIDE=1 → exit 0 (emergency bypass)");
  } else {
    fail("3. override", `exit ${r.status} stderr=${r.stderr}`);
  }
}

// 4) FREEZE 시각 정확 = 5/7 23:00:00 KST → exit 0 (경계 inclusive).
{
  const r = runHook({ NOW_ISO_OVERRIDE: "2026-05-07T23:00:00+09:00" });
  if (r.status === 0) {
    pass("4. boundary (5/7 23:00:00 KST 정확) → exit 0 (inclusive)");
  } else {
    fail("4. boundary", `exit ${r.status} stderr=${r.stderr}`);
  }
}

// 5) D-Day (5/8 00:00:01 KST) → exit 1 (post-freeze).
{
  const r = runHook({ NOW_ISO_OVERRIDE: "2026-05-08T00:00:01+09:00" });
  if (r.status === 1 && /RELEASE FREEZE active/.test(r.stderr)) {
    pass("5. D-Day (5/8 00:00:01 KST) → exit 1 (post-freeze)");
  } else {
    fail("5. D-Day", `exit ${r.status} stderr=${r.stderr}`);
  }
}

if (process.exitCode === 1) {
  console.error("verify:freeze-hook — FAIL");
} else {
  console.log("verify:freeze-hook — 6/6 PASS (0 + 5)");
}
