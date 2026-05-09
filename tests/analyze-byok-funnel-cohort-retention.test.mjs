#!/usr/bin/env node
/**
 * tests/analyze-byok-funnel-cohort-retention.test.mjs
 *   - C-D69-2 테스트 (6 케이스, §24.6.2 명세 정합).
 *
 * 6 케이스:
 *   1) 단일 cohort 10명 / d1 100% / d7 50% / d14 20% / d30 0%
 *   2) 빈 파일 → { cohorts: [] }
 *   3) cohort n=4 → d_N + ttv_ms_p50 모두 null
 *   4) byok_activated 없는 first_chat 1건 → skip
 *   5) ttv_ms_p50 — 5건 [100, 200, 300, 400, 500] ms → 300
 *   6) 다중 cohort 2개 → 독립 계산 정합
 *
 * 외부 dev-deps +0 (node 표준만).
 */

import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { analyzeByokFunnelCohortRetention } from "../scripts/analyze-byok-funnel-cohort-retention.mjs";

const tmpRoot = mkdtempSync(join(tmpdir(), "byok-cohort-retention-"));

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

async function assertCaseAsync(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.error(`  ✗ ${name} — ${e.message}`);
  }
}

function eq(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function tsKstAtNoon(ymd) {
  return `${ymd}T12:00:00+09:00`;
}

function writePings(name, pings) {
  const p = join(tmpRoot, name);
  writeFileSync(p, pings.map((x) => JSON.stringify(x)).join("\n"));
  return p;
}

console.log("analyze-byok-funnel-cohort-retention — 6 케이스 테스트");

// case 1: 단일 cohort 10명 / d1 100% / d7 50% / d14 20% / d30 0%
await assertCaseAsync("case1: 단일 cohort 10명 d1=1.0 d7=0.5 d14=0.2 d30=0", async () => {
  const pings = [];
  for (let i = 1; i <= 10; i++) {
    pings.push({ ts_iso: tsKstAtNoon("2026-05-08"), user_id: `u${i}`, event: "byok_activated" });
    // d1 100% — all 10 users
    pings.push({ ts_iso: tsKstAtNoon("2026-05-09"), user_id: `u${i}`, event: "first_chat" });
    if (i <= 5) {
      // d7 50%
      pings.push({ ts_iso: tsKstAtNoon("2026-05-15"), user_id: `u${i}`, event: "first_chat" });
    }
    if (i <= 2) {
      // d14 20%
      pings.push({ ts_iso: tsKstAtNoon("2026-05-22"), user_id: `u${i}`, event: "first_chat" });
    }
    // d30 0% — none
  }
  const path = writePings("case1.jsonl", pings);
  const r = await analyzeByokFunnelCohortRetention({ pingsPath: path });
  eq(r.cohorts.length, 1, "cohorts length");
  const c = r.cohorts[0];
  eq(c.day0, "2026-05-08", "day0");
  eq(c.n, 10, "n");
  eq(c.d1, 1.0, "d1");
  eq(c.d7, 0.5, "d7");
  eq(c.d14, 0.2, "d14");
  eq(c.d30, 0, "d30");
});

// case 2: 빈 파일 → cohorts=[]
await assertCaseAsync("case2: 빈 파일 → { cohorts: [] }", async () => {
  const path = writePings("case2.jsonl", []);
  const r = await analyzeByokFunnelCohortRetention({ pingsPath: path });
  eq(r.cohorts.length, 0, "cohorts length");
});

// case 3: n=4 → d_N + ttv_ms_p50 모두 null
await assertCaseAsync("case3: cohort n=4 → d_N + ttv_ms_p50 모두 null", async () => {
  const pings = [];
  for (let i = 1; i <= 4; i++) {
    pings.push({ ts_iso: tsKstAtNoon("2026-05-08"), user_id: `u${i}`, event: "byok_activated" });
    pings.push({ ts_iso: tsKstAtNoon("2026-05-09"), user_id: `u${i}`, event: "first_chat" });
  }
  const path = writePings("case3.jsonl", pings);
  const r = await analyzeByokFunnelCohortRetention({ pingsPath: path });
  eq(r.cohorts.length, 1, "cohorts length");
  const c = r.cohorts[0];
  eq(c.n, 4, "n");
  eq(c.d1, null, "d1");
  eq(c.d7, null, "d7");
  eq(c.d14, null, "d14");
  eq(c.d30, null, "d30");
  eq(c.ttv_ms_p50, null, "ttv_ms_p50");
});

// case 4: byok_activated 없는 first_chat 1건 → skip
await assertCaseAsync("case4: byok_activated 없는 first_chat 1건 → cohort 미할당", async () => {
  const pings = [
    { ts_iso: tsKstAtNoon("2026-05-09"), user_id: "uOrphan", event: "first_chat" },
  ];
  for (let i = 1; i <= 5; i++) {
    pings.push({ ts_iso: tsKstAtNoon("2026-05-08"), user_id: `u${i}`, event: "byok_activated" });
    pings.push({ ts_iso: tsKstAtNoon("2026-05-09"), user_id: `u${i}`, event: "first_chat" });
  }
  const path = writePings("case4.jsonl", pings);
  const r = await analyzeByokFunnelCohortRetention({ pingsPath: path });
  eq(r.cohorts.length, 1, "cohorts length");
  eq(r.cohorts[0].n, 5, "n excludes orphan");
});

// case 5: ttv_ms_p50 — [100, 200, 300, 400, 500] → 300
await assertCaseAsync("case5: ttv_ms_p50 [100,200,300,400,500] → 300", async () => {
  const baseMs = new Date("2026-05-08T12:00:00+09:00").getTime();
  const toIsoOffset = (ms) => new Date(ms).toISOString().replace("Z", "+00:00");
  const pings = [];
  const deltas = [100, 200, 300, 400, 500];
  for (let i = 0; i < 5; i++) {
    pings.push({ ts_iso: toIsoOffset(baseMs), user_id: `u${i + 1}`, event: "byok_activated" });
    pings.push({
      ts_iso: toIsoOffset(baseMs + deltas[i]),
      user_id: `u${i + 1}`,
      event: "first_chat",
    });
  }
  const path = writePings("case5.jsonl", pings);
  const r = await analyzeByokFunnelCohortRetention({ pingsPath: path });
  eq(r.cohorts.length, 1, "cohorts length");
  eq(r.cohorts[0].n, 5, "n");
  eq(r.cohorts[0].ttv_ms_p50, 300, "ttv_ms_p50 odd p50");
});

// case 6: 다중 cohort 2개 → 독립 계산
await assertCaseAsync("case6: 다중 cohort 2개 → 독립 + 정렬", async () => {
  const pings = [];
  // cohort A — day0 = 2026-05-10, n=5, d1 100%
  for (let i = 1; i <= 5; i++) {
    pings.push({ ts_iso: tsKstAtNoon("2026-05-10"), user_id: `A${i}`, event: "byok_activated" });
    pings.push({ ts_iso: tsKstAtNoon("2026-05-11"), user_id: `A${i}`, event: "first_chat" });
  }
  // cohort B — day0 = 2026-05-08, n=5, d7 100%
  for (let i = 1; i <= 5; i++) {
    pings.push({ ts_iso: tsKstAtNoon("2026-05-08"), user_id: `B${i}`, event: "byok_activated" });
    pings.push({ ts_iso: tsKstAtNoon("2026-05-15"), user_id: `B${i}`, event: "first_chat" });
  }
  const path = writePings("case6.jsonl", pings);
  const r = await analyzeByokFunnelCohortRetention({ pingsPath: path });
  eq(r.cohorts.length, 2, "cohorts length");
  // sorted ascending by day0
  eq(r.cohorts[0].day0, "2026-05-08", "first cohort day0");
  eq(r.cohorts[0].d1, 0, "B d1");
  eq(r.cohorts[0].d7, 1.0, "B d7");
  eq(r.cohorts[1].day0, "2026-05-10", "second cohort day0");
  eq(r.cohorts[1].d1, 1.0, "A d1");
  eq(r.cohorts[1].d7, 0, "A d7");
});

console.log("");
console.log(
  `analyze-byok-funnel-cohort-retention tests — ${passed}/${passed + failed} ${failed === 0 ? "PASS" : "FAIL"}`,
);
process.exit(failed === 0 ? 0 : 1);
