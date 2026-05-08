#!/usr/bin/env node
/**
 * tests/check-d-plus-1-handoff.test.mjs
 *   - C-D64-1 테스트 (≥6 케이스, 명세 5.1 정합).
 *
 * 6 케이스:
 *   1) 정각 (09:00:00 KST) + report 3줄 + KQ_24/25 응답 + show-hn 4-row → ok=true / offsetMinutes=0
 *   2) +14분 → ok=true
 *   3) +16분 → ok=false / withinWindow=false
 *   4) report 2줄 → reportOk=false / ok=false
 *   5) KQ_24 응답 누락 → kqAllResolved=false / ok=false
 *   6) show-hn-data 헤더 부재 → showHnOk=false / ok=false
 *
 * 외부 dev-deps +0 (node 표준만). 임시 파일은 os.tmpdir() 에서만.
 */

import { writeFileSync, mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkDPlus1Handoff } from "../scripts/check-d-plus-1-handoff.mjs";

const SLOT_KST = "2026-05-09T09:00:00+09:00";
const slotMs = new Date(SLOT_KST).getTime();

const REPORT_3LINES = [
  "Line 1 — D+1 09:00 KST handoff verify:all PASS",
  "Line 2 — Roy shownhScore + KQ_24/25 응답 docs lock",
  "Line 3 — Show HN T+35h 4-row 정합 PASS",
];
const REPORT_2LINES = [
  "Line 1 — handoff 보고",
  "Line 2 — handoff 보고",
];

const SHOW_HN_GOOD = [
  "| score | comments | position | capture_ts |",
  "| --- | --- | --- | --- |",
  "| 142 | 28 | 11 | 2026-05-09T09:00:00+09:00 |",
];
const SHOW_HN_HEADER_MISSING = [
  "| value1 | value2 | value3 | value4 |",
  "| 142 | 28 | 11 | 2026-05-09T09:00:00+09:00 |",
];

let passed = 0;
let failed = 0;

function setup({ reportLines, kqMode, showHnLines }) {
  const dir = mkdtempSync(join(tmpdir(), "check-d-plus-1-handoff-test-"));
  const reportPath = join(dir, "report.md");
  const showHnPath = join(dir, "show-hn.md");
  writeFileSync(reportPath, reportLines.join("\n"), "utf8");
  writeFileSync(showHnPath, showHnLines.join("\n"), "utf8");
  // KQ resolve dir.
  const kqDir = join(dir, "kq");
  mkdirSync(kqDir, { recursive: true });
  if (kqMode === "both") {
    writeFileSync(
      join(kqDir, "KQ_24-RESPONSE-20260509.md"),
      "## KQ_24\n\nRoy 응답 본문.\n",
      "utf8",
    );
    writeFileSync(
      join(kqDir, "KQ_25-RESPONSE-20260509.md"),
      "## KQ_25\n\nRoy 응답 본문.\n",
      "utf8",
    );
  } else if (kqMode === "only-25") {
    writeFileSync(
      join(kqDir, "KQ_25-RESPONSE-20260509.md"),
      "## KQ_25\n\nRoy 응답 본문.\n",
      "utf8",
    );
  }
  return { dir, reportPath, showHnPath, kqDir };
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

console.log("check-d-plus-1-handoff — 6 케이스 테스트");

// case 1: 정각 + 3줄 + KQ 양쪽 + 4-row → ok=true
assertCase("case1: 정각 ok=true offsetMinutes=0", () => {
  const ctx = setup({
    reportLines: REPORT_3LINES,
    kqMode: "both",
    showHnLines: SHOW_HN_GOOD,
  });
  try {
    const r = checkDPlus1Handoff({
      slotKst: SLOT_KST,
      reportPath: ctx.reportPath,
      kqList: "24,25",
      showHnDataPath: ctx.showHnPath,
      kqResolveDir: ctx.kqDir,
      now: new Date(slotMs).toISOString(),
    });
    eq(r.ok, true, "ok");
    eq(r.withinWindow, true, "withinWindow");
    eq(r.offsetMinutes, 0, "offsetMinutes");
    eq(r.reportOk, true, "reportOk");
    eq(r.kqAllResolved, true, "kqAllResolved");
    eq(r.showHnOk, true, "showHnOk");
  } finally {
    rmSync(ctx.dir, { recursive: true, force: true });
  }
});

// case 2: +14분 → ok=true
assertCase("case2: +14분 ok=true", () => {
  const ctx = setup({
    reportLines: REPORT_3LINES,
    kqMode: "both",
    showHnLines: SHOW_HN_GOOD,
  });
  try {
    const r = checkDPlus1Handoff({
      slotKst: SLOT_KST,
      reportPath: ctx.reportPath,
      kqList: "24,25",
      showHnDataPath: ctx.showHnPath,
      kqResolveDir: ctx.kqDir,
      now: new Date(slotMs + 14 * 60 * 1000).toISOString(),
    });
    eq(r.ok, true, "ok");
    eq(r.withinWindow, true, "withinWindow");
  } finally {
    rmSync(ctx.dir, { recursive: true, force: true });
  }
});

// case 3: +16분 → ok=false
assertCase("case3: +16분 ok=false withinWindow=false", () => {
  const ctx = setup({
    reportLines: REPORT_3LINES,
    kqMode: "both",
    showHnLines: SHOW_HN_GOOD,
  });
  try {
    const r = checkDPlus1Handoff({
      slotKst: SLOT_KST,
      reportPath: ctx.reportPath,
      kqList: "24,25",
      showHnDataPath: ctx.showHnPath,
      kqResolveDir: ctx.kqDir,
      now: new Date(slotMs + 16 * 60 * 1000).toISOString(),
    });
    eq(r.ok, false, "ok");
    eq(r.withinWindow, false, "withinWindow");
  } finally {
    rmSync(ctx.dir, { recursive: true, force: true });
  }
});

// case 4: report 2줄 → reportOk=false / ok=false
assertCase("case4: report 2줄 reportOk=false", () => {
  const ctx = setup({
    reportLines: REPORT_2LINES,
    kqMode: "both",
    showHnLines: SHOW_HN_GOOD,
  });
  try {
    const r = checkDPlus1Handoff({
      slotKst: SLOT_KST,
      reportPath: ctx.reportPath,
      kqList: "24,25",
      showHnDataPath: ctx.showHnPath,
      kqResolveDir: ctx.kqDir,
      now: new Date(slotMs).toISOString(),
    });
    eq(r.ok, false, "ok");
    eq(r.reportOk, false, "reportOk");
  } finally {
    rmSync(ctx.dir, { recursive: true, force: true });
  }
});

// case 5: KQ_24 누락 → kqAllResolved=false / ok=false
assertCase("case5: KQ_24 누락 kqAllResolved=false", () => {
  const ctx = setup({
    reportLines: REPORT_3LINES,
    kqMode: "only-25",
    showHnLines: SHOW_HN_GOOD,
  });
  try {
    const r = checkDPlus1Handoff({
      slotKst: SLOT_KST,
      reportPath: ctx.reportPath,
      kqList: "24,25",
      showHnDataPath: ctx.showHnPath,
      kqResolveDir: ctx.kqDir,
      now: new Date(slotMs).toISOString(),
    });
    eq(r.ok, false, "ok");
    eq(r.kqAllResolved, false, "kqAllResolved");
  } finally {
    rmSync(ctx.dir, { recursive: true, force: true });
  }
});

// case 6: show-hn-data 헤더 부재 → showHnOk=false / ok=false
assertCase("case6: show-hn-data 헤더 부재 showHnOk=false", () => {
  const ctx = setup({
    reportLines: REPORT_3LINES,
    kqMode: "both",
    showHnLines: SHOW_HN_HEADER_MISSING,
  });
  try {
    const r = checkDPlus1Handoff({
      slotKst: SLOT_KST,
      reportPath: ctx.reportPath,
      kqList: "24,25",
      showHnDataPath: ctx.showHnPath,
      kqResolveDir: ctx.kqDir,
      now: new Date(slotMs).toISOString(),
    });
    eq(r.ok, false, "ok");
    eq(r.showHnOk, false, "showHnOk");
  } finally {
    rmSync(ctx.dir, { recursive: true, force: true });
  }
});

console.log("");
console.log(
  `check-d-plus-1-handoff tests — ${passed}/${passed + failed} ${failed === 0 ? "PASS" : "FAIL"}`,
);
process.exit(failed === 0 ? 0 : 1);
