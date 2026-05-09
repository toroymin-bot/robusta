#!/usr/bin/env node
/**
 * tests/analyze-byok-funnel-weekly.test.mjs
 *   - C-D67-2 테스트 (6 케이스, §20.5.2 명세 정합).
 *
 * 6 케이스:
 *   1) 빈 배열 → all 0 + dailyBreakdown 7일 0 채움
 *   2) 일별 분포 정상 → 일자별 visit/attempt/success 누적 정합
 *   3) 주차 경계 정합 → ISO 주차 라벨 정확
 *   4) env ANALYTICS_PINGS_PATH NDJSON 로드
 *   5) 잘못된 kind 무시 → kind='garbage' 제외
 *   6) conversion 소수점 2자리 → success/visit*100 라운딩
 *
 * 외부 dev-deps +0 (node 표준만).
 */

import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { analyzeByokFunnelWeekly } from "../scripts/analyze-byok-funnel-weekly.mjs";

const tmpRoot = mkdtempSync(join(tmpdir(), "byok-weekly-"));

let passed = 0;
let failed = 0;

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

function tsKstAt(yearMonthDay, hour) {
  return `${yearMonthDay}T${String(hour).padStart(2, "0")}:00:00+09:00`;
}

const WEEK_END = "2026-05-14T22:00:00+09:00";

console.log("analyze-byok-funnel-weekly — 6 케이스 테스트");

// case 1: 빈 배열 → all 0
assertCase("case1: 빈 배열 → all 0 + dailyBreakdown 7일 0 채움", () => {
  const r = analyzeByokFunnelWeekly([], { weekEndIso: WEEK_END });
  eq(r.visit, 0, "visit");
  eq(r.attempt, 0, "attempt");
  eq(r.success, 0, "success");
  eq(r.conversion, 0, "conversion");
  eq(r.dailyBreakdown.length, 7, "daily 7일");
  for (const d of r.dailyBreakdown) {
    eq(d.visit, 0, `${d.day}.visit`);
    eq(d.attempt, 0, `${d.day}.attempt`);
    eq(d.success, 0, `${d.day}.success`);
  }
});

// case 2: 일별 분포 정상
assertCase("case2: 일별 분포 누적 정합", () => {
  const pings = [
    { ts: tsKstAt("2026-05-08", 10), kind: "visit" },
    { ts: tsKstAt("2026-05-08", 11), kind: "visit" },
    { ts: tsKstAt("2026-05-09", 10), kind: "visit" },
    { ts: tsKstAt("2026-05-10", 10), kind: "attempt" },
    { ts: tsKstAt("2026-05-10", 11), kind: "success" },
  ];
  const r = analyzeByokFunnelWeekly(pings, { weekEndIso: WEEK_END });
  eq(r.visit, 3, "visit");
  eq(r.attempt, 1, "attempt");
  eq(r.success, 1, "success");
  const day8 = r.dailyBreakdown.find((d) => d.day === "2026-05-08");
  eq(day8?.visit, 2, "5/8 visit");
  const day9 = r.dailyBreakdown.find((d) => d.day === "2026-05-09");
  eq(day9?.visit, 1, "5/9 visit");
  const day10 = r.dailyBreakdown.find((d) => d.day === "2026-05-10");
  eq(day10?.attempt, 1, "5/10 attempt");
  eq(day10?.success, 1, "5/10 success");
});

// case 3: 주차 경계 정합 (ISO 주차 라벨)
assertCase("case3: ISO 주차 라벨 'YYYY-Www' 정합", () => {
  const r = analyzeByokFunnelWeekly([], { weekEndIso: WEEK_END });
  // 2026-05-14 KST is in ISO week 20 of 2026 (Thursday).
  eq(r.week, "2026-W20", "week label");
});

// case 4: env ANALYTICS_PINGS_PATH NDJSON 로드
assertCase("case4: env ANALYTICS_PINGS_PATH NDJSON 로드 → 카운트 정합", () => {
  const ndjsonPath = join(tmpRoot, "case4.jsonl");
  writeFileSync(
    ndjsonPath,
    [
      JSON.stringify({ ts: tsKstAt("2026-05-09", 10), kind: "visit" }),
      JSON.stringify({ ts: tsKstAt("2026-05-09", 11), kind: "attempt" }),
      JSON.stringify({ ts: tsKstAt("2026-05-09", 12), kind: "success" }),
    ].join("\n"),
  );
  const prev = process.env.ANALYTICS_PINGS_PATH;
  process.env.ANALYTICS_PINGS_PATH = ndjsonPath;
  try {
    // pings 인자 미지정 → env 폴백.
    const r = analyzeByokFunnelWeekly(undefined, { weekEndIso: WEEK_END });
    eq(r.visit, 1, "visit");
    eq(r.attempt, 1, "attempt");
    eq(r.success, 1, "success");
  } finally {
    if (prev === undefined) delete process.env.ANALYTICS_PINGS_PATH;
    else process.env.ANALYTICS_PINGS_PATH = prev;
  }
});

// case 5: 잘못된 kind 무시
assertCase("case5: 잘못된 kind 'garbage' 무시", () => {
  const pings = [
    { ts: tsKstAt("2026-05-09", 10), kind: "visit" },
    { ts: tsKstAt("2026-05-09", 10), kind: "garbage" },
    { ts: tsKstAt("2026-05-09", 10), kind: "click" },
  ];
  const r = analyzeByokFunnelWeekly(pings, { weekEndIso: WEEK_END });
  eq(r.visit, 1, "visit");
  eq(r.attempt, 0, "attempt");
  eq(r.success, 0, "success");
});

// case 6: conversion 소수점 2자리
assertCase("case6: conversion=success/visit*100 소수점 2자리", () => {
  const pings = [];
  for (let i = 0; i < 7; i++) {
    pings.push({ ts: tsKstAt("2026-05-09", 10), kind: "visit" });
  }
  pings.push({ ts: tsKstAt("2026-05-09", 11), kind: "success" });
  // 1 / 7 * 100 = 14.285714... → round 14.29
  const r = analyzeByokFunnelWeekly(pings, { weekEndIso: WEEK_END });
  eq(r.visit, 7, "visit");
  eq(r.success, 1, "success");
  eq(r.conversion, 14.29, "conversion");
});

console.log("");
console.log(
  `analyze-byok-funnel-weekly tests — ${passed}/${passed + failed} ${failed === 0 ? "PASS" : "FAIL"}`,
);
process.exit(failed === 0 ? 0 : 1);
