#!/usr/bin/env node
/**
 * tests/check-show-hn-t48.test.mjs
 *   - C-D64-2 테스트 (≥5 케이스, 명세 5.2 정합).
 *
 * 5 케이스:
 *   1) 정각 (5/9 22:00 KST) + 4-row → ok=true
 *   2) +14분 → ok=true
 *   3) +16분 → ok=false
 *   4) data 0-row → dataOk=false
 *   5) submit 비-KST → ok=false
 *
 * 외부 dev-deps +0 (node 표준만). 임시 파일은 os.tmpdir() 에서만.
 */

import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkShowHnT48 } from "../scripts/check-show-hn-t48.mjs";

const SUBMIT_KST = "2026-05-07T22:00:00+09:00";
const TARGET_KST = "2026-05-09T22:00:00+09:00"; // submit + 48h
const targetMs = new Date(TARGET_KST).getTime();

const SHOW_HN_4ROW = [
  "# Show HN T+48h",
  "",
  "| score | comments | position | capture_ts |",
  "| --- | --- | --- | --- |",
  "| 200 | 50 | 7 | 2026-05-09T22:00:00+09:00 |",
  "",
];
const SHOW_HN_NO_ROW = [
  "# Show HN T+48h",
  "",
  "| score | comments | position | capture_ts |",
  "| --- | --- | --- | --- |",
  "",
];

let passed = 0;
let failed = 0;

function setup(showHnLines) {
  const dir = mkdtempSync(join(tmpdir(), "check-show-hn-t48-test-"));
  const dataPath = join(dir, "show-hn.md");
  writeFileSync(dataPath, showHnLines.join("\n"), "utf8");
  return { dir, dataPath };
}

function assertCase(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.error(`  ✗ ${name} — ${e.message}`);
  }
}

function eq(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

console.log("check-show-hn-t48 — 5 케이스 테스트");

// case 1: 정각 (5/9 22:00 KST) + 4-row → ok=true
assertCase("case1: 정각 + 4-row ok=true", () => {
  const ctx = setup(SHOW_HN_4ROW);
  try {
    const r = checkShowHnT48({
      submitKst: SUBMIT_KST,
      now: new Date(targetMs).toISOString(),
      dataPath: ctx.dataPath,
    });
    eq(r.ok, true, "ok");
    eq(r.withinWindow, true, "withinWindow");
    eq(r.targetKst, TARGET_KST, "targetKst");
    eq(r.dataOk, true, "dataOk");
    eq(r.dataRows, 1, "dataRows");
  } finally {
    rmSync(ctx.dir, { recursive: true, force: true });
  }
});

// case 2: +14분 → ok=true
assertCase("case2: +14분 ok=true", () => {
  const ctx = setup(SHOW_HN_4ROW);
  try {
    const r = checkShowHnT48({
      submitKst: SUBMIT_KST,
      now: new Date(targetMs + 14 * 60 * 1000).toISOString(),
      dataPath: ctx.dataPath,
    });
    eq(r.ok, true, "ok");
    eq(r.withinWindow, true, "withinWindow");
  } finally {
    rmSync(ctx.dir, { recursive: true, force: true });
  }
});

// case 3: +16분 → ok=false
assertCase("case3: +16분 ok=false withinWindow=false", () => {
  const ctx = setup(SHOW_HN_4ROW);
  try {
    const r = checkShowHnT48({
      submitKst: SUBMIT_KST,
      now: new Date(targetMs + 16 * 60 * 1000).toISOString(),
      dataPath: ctx.dataPath,
    });
    eq(r.ok, false, "ok");
    eq(r.withinWindow, false, "withinWindow");
  } finally {
    rmSync(ctx.dir, { recursive: true, force: true });
  }
});

// case 4: data 0-row → dataOk=false
assertCase("case4: data 0-row dataOk=false", () => {
  const ctx = setup(SHOW_HN_NO_ROW);
  try {
    const r = checkShowHnT48({
      submitKst: SUBMIT_KST,
      now: new Date(targetMs).toISOString(),
      dataPath: ctx.dataPath,
    });
    eq(r.ok, false, "ok");
    eq(r.dataOk, false, "dataOk");
    eq(r.dataRows, 0, "dataRows");
  } finally {
    rmSync(ctx.dir, { recursive: true, force: true });
  }
});

// case 5: submit 비-KST → ok=false
assertCase("case5: submit 비-KST ok=false", () => {
  const ctx = setup(SHOW_HN_4ROW);
  try {
    const r = checkShowHnT48({
      submitKst: "2026-05-07T13:00:00Z", // UTC, no +09:00
      now: new Date(targetMs).toISOString(),
      dataPath: ctx.dataPath,
    });
    eq(r.ok, false, "ok");
    if (!r.issues.includes("submitKst must be KST")) {
      throw new Error(`expected issues to include 'submitKst must be KST', got ${JSON.stringify(r.issues)}`);
    }
  } finally {
    rmSync(ctx.dir, { recursive: true, force: true });
  }
});

console.log("");
console.log(
  `check-show-hn-t48 tests — ${passed}/${passed + failed} ${failed === 0 ? "PASS" : "FAIL"}`,
);
process.exit(failed === 0 ? 0 : 1);
