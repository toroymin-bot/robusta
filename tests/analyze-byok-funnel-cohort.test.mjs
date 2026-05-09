#!/usr/bin/env node
/**
 * tests/analyze-byok-funnel-cohort.test.mjs
 *   - C-D68-2 테스트 (6 케이스, §22.5.2 명세 정합).
 *
 * 6 케이스:
 *   1) 빈 배열 → cohorts=[], summary={keys:0, retained_avg:0}
 *   2) 단일 cohort 정상 → size + retained 카운트 정합
 *   3) 다중 cohort 정렬 → cohort_key 오름차순
 *   4) env ANALYTICS_PINGS_PATH NDJSON 로드
 *   5) visitorId 누락 무시
 *   6) retained_avg 소수점 2자리
 *
 * 외부 dev-deps +0 (node 표준만).
 */

import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { analyzeByokFunnelCohort } from "../scripts/analyze-byok-funnel-cohort.mjs";

const tmpRoot = mkdtempSync(join(tmpdir(), "byok-cohort-"));

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

console.log("analyze-byok-funnel-cohort — 6 케이스 테스트");

// case 1: 빈 배열 → cohorts=[], summary={keys:0, retained_avg:0}
assertCase("case1: 빈 배열 → cohorts=[] + summary keys=0 retained_avg=0", () => {
  const r = analyzeByokFunnelCohort([]);
  eq(r.cohorts.length, 0, "cohorts length");
  eq(r.summary.keys, 0, "summary.keys");
  eq(r.summary.retained_avg, 0, "summary.retained_avg");
});

// case 2: 단일 cohort 정상
assertCase("case2: 단일 cohort 정상 size=2 retained day0 attempt 1건 + day1 success 1건", () => {
  const pings = [
    { ts: tsKstAt("2026-05-09", 10), kind: "visit", visitorId: "v1" },
    { ts: tsKstAt("2026-05-09", 10), kind: "visit", visitorId: "v2" },
    { ts: tsKstAt("2026-05-09", 11), kind: "attempt", visitorId: "v1" },
    { ts: tsKstAt("2026-05-10", 10), kind: "success", visitorId: "v2" },
  ];
  const r = analyzeByokFunnelCohort(pings, { cohortDays: 7 });
  eq(r.cohorts.length, 1, "cohorts length");
  const c = r.cohorts[0];
  eq(c.cohort_key, "2026-05-09", "cohort_key");
  eq(c.size, 2, "size");
  eq(c.retained.length, 7, "retained length");
  eq(c.retained[0], 1, "day0 retained (v1 attempt)");
  eq(c.retained[1], 1, "day1 retained (v2 success)");
  eq(c.retained[2], 0, "day2 retained");
});

// case 3: 다중 cohort 정렬
assertCase("case3: 다중 cohort cohort_key 오름차순 정렬", () => {
  const pings = [
    // cohort 2026-05-10 (v3 visit later)
    { ts: tsKstAt("2026-05-10", 10), kind: "visit", visitorId: "v3" },
    // cohort 2026-05-08 (v1 visit earlier)
    { ts: tsKstAt("2026-05-08", 10), kind: "visit", visitorId: "v1" },
    // cohort 2026-05-09 (v2)
    { ts: tsKstAt("2026-05-09", 10), kind: "visit", visitorId: "v2" },
  ];
  const r = analyzeByokFunnelCohort(pings, { cohortDays: 3 });
  eq(r.cohorts.length, 3, "cohorts length");
  eq(r.cohorts[0].cohort_key, "2026-05-08", "first cohort_key");
  eq(r.cohorts[1].cohort_key, "2026-05-09", "second cohort_key");
  eq(r.cohorts[2].cohort_key, "2026-05-10", "third cohort_key");
});

// case 4: env ANALYTICS_PINGS_PATH NDJSON 로드
assertCase("case4: env ANALYTICS_PINGS_PATH NDJSON 로드 → cohort 정합", () => {
  const ndjsonPath = join(tmpRoot, "case4.jsonl");
  writeFileSync(
    ndjsonPath,
    [
      JSON.stringify({ ts: tsKstAt("2026-05-09", 10), kind: "visit", visitorId: "vA" }),
      JSON.stringify({ ts: tsKstAt("2026-05-09", 11), kind: "attempt", visitorId: "vA" }),
    ].join("\n"),
  );
  const prev = process.env.ANALYTICS_PINGS_PATH;
  process.env.ANALYTICS_PINGS_PATH = ndjsonPath;
  try {
    const r = analyzeByokFunnelCohort(undefined, { cohortDays: 7 });
    eq(r.cohorts.length, 1, "cohorts length");
    eq(r.cohorts[0].size, 1, "size");
    eq(r.cohorts[0].retained[0], 1, "day0 retained");
  } finally {
    if (prev === undefined) delete process.env.ANALYTICS_PINGS_PATH;
    else process.env.ANALYTICS_PINGS_PATH = prev;
  }
});

// case 5: visitorId 누락 무시
assertCase("case5: visitorId 누락 ping 무시", () => {
  const pings = [
    { ts: tsKstAt("2026-05-09", 10), kind: "visit", visitorId: "v1" },
    { ts: tsKstAt("2026-05-09", 10), kind: "visit" }, // 누락 → 무시
    { ts: tsKstAt("2026-05-09", 10), kind: "visit", visitorId: "" }, // 빈 문자열 → 무시
  ];
  const r = analyzeByokFunnelCohort(pings, { cohortDays: 7 });
  eq(r.cohorts.length, 1, "cohorts length");
  eq(r.cohorts[0].size, 1, "size (v1 only)");
});

// case 6: retained_avg 소수점 2자리
assertCase("case6: retained_avg 소수점 2자리 round", () => {
  // 1 visitor, cohortDays=7, retained day0+day1+day2 = 3
  // retained_avg = 3 / (1 * 7) * 100 = 42.857142... → 42.86
  const pings = [
    { ts: tsKstAt("2026-05-09", 10), kind: "visit", visitorId: "v1" },
    { ts: tsKstAt("2026-05-09", 11), kind: "attempt", visitorId: "v1" },
    { ts: tsKstAt("2026-05-10", 10), kind: "attempt", visitorId: "v1" },
    { ts: tsKstAt("2026-05-11", 10), kind: "success", visitorId: "v1" },
  ];
  const r = analyzeByokFunnelCohort(pings, { cohortDays: 7 });
  eq(r.cohorts.length, 1, "cohorts length");
  eq(r.cohorts[0].size, 1, "size");
  eq(r.summary.retained_avg, 42.86, "retained_avg");
});

console.log("");
console.log(
  `analyze-byok-funnel-cohort tests — ${passed}/${passed + failed} ${failed === 0 ? "PASS" : "FAIL"}`,
);
process.exit(failed === 0 ? 0 : 1);
