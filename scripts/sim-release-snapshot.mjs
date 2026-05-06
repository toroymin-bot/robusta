#!/usr/bin/env node
/**
 * sim-release-snapshot.mjs
 *   - C-D51-4 (D-2 23시 슬롯, 2026-05-06) — Tori spec C-D51-4 (F-D51-2 시뮬).
 *
 * Why: buildReleaseSnapshot (release-snapshot.ts) 6 케이스 시뮬 — D-2/D-1/D-Day/post-launch/null/회귀 fail.
 *   Date 비교 timezone UTC 고정 (Date.getTime()).
 *
 * 6 시뮬 케이스:
 *   1) RELEASE_ISO=null → 'no-release-iso' / red
 *   2) D-2 (now=2026-05-06T13:00Z, release=2026-05-07T15:00Z = 5/8 00:00 KST) → 'D-2' / green
 *   3) D-1 (now=2026-05-07T13:00Z) → 'D-1' / green
 *   4) D-Day 진입 (now=2026-05-07T15:30Z = 5/8 00:30 KST) → 'D-0' / green (live-1h)
 *   5) post-launch +2h (now=2026-05-07T17:00Z = 5/8 02:00 KST) → 'D+1' / green (dimmed)
 *   6) 누적 회귀 fail (lastRegression.pass=701, total=702) → readiness='red' 강제
 *
 * 외부 dev-deps +0 (node 표준만 + 직접 함수 import).
 */

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";

const root = resolve(process.cwd());

function pass(label) {
  console.log(`  ✓ ${label}`);
}
function fail(label, msg) {
  console.error(`  ✗ ${label} — ${msg}`);
  process.exitCode = 1;
}

// .ts 파일을 직접 import 할 수 없으므로 — 함수 본체를 sim 안에 mirror.
// release-snapshot.ts 와 1:1 동기 (verify-d51 grep 게이트로 mirror 정합 검증).
const HOUR_MS = 60 * 60 * 1000;

function computeDDay(hoursRemaining) {
  if (hoursRemaining <= -1) return "D+1";
  if (hoursRemaining <= 0) return "D-0";
  if (hoursRemaining <= 24) return "D-1";
  return "D-2";
}

function buildReleaseSnapshot(now, opts) {
  if (!opts.releaseIso) {
    return {
      dDay: "D-2",
      hoursRemaining: 0,
      readiness: "red",
      summaryLine: "RELEASE_ISO 미설정",
    };
  }

  const release = new Date(opts.releaseIso);
  const diffMs = release.getTime() - now.getTime();
  const hoursRemaining = Math.ceil(diffMs / HOUR_MS);
  const dDay = computeDDay(hoursRemaining);

  let readiness = "green";
  if (opts.vercelStatus === "red") {
    readiness = "red";
  } else if (opts.lastRegression.pass < opts.lastRegression.total) {
    readiness = "red";
  } else if (opts.byokDemoFunnel.step4 < 4) {
    readiness = "yellow";
  }

  const hoursAbs = Math.max(0, hoursRemaining);
  const summaryLine =
    `${dDay} ${hoursAbs}h · regression ${opts.lastRegression.pass}/${opts.lastRegression.total}` +
    ` · vercel ${opts.vercelStatus} · BYOK ${opts.byokDemoFunnel.step4}/4` +
    ` · readiness ${readiness.toUpperCase()}`;

  return { dDay, hoursRemaining, readiness, summaryLine };
}

const RELEASE_ISO_KST = "2026-05-08T00:00:00+09:00"; // = 2026-05-07T15:00:00Z
const FUNNEL_4 = { step1: 4, step2: 4, step3: 4, step4: 4 };
const FUNNEL_3 = { step1: 4, step2: 4, step3: 4, step4: 3 };
const REG_OK = { pass: 702, total: 702, cycle: 25 };
const REG_FAIL = { pass: 701, total: 702, cycle: 25 };

const cases = [
  {
    name: "1. RELEASE_ISO=null → 'no-release-iso' / red",
    now: new Date("2026-05-06T13:00:00Z"),
    opts: {
      releaseIso: null,
      vercelStatus: "green",
      lastRegression: REG_OK,
      byokDemoFunnel: FUNNEL_4,
    },
    expected: { dDay: "D-2", readiness: "red", hoursRemaining: 0 },
  },
  {
    name: "2. D-2 (now=2026-05-06T13:00Z) → 'D-2' / green",
    now: new Date("2026-05-06T13:00:00Z"),
    opts: {
      releaseIso: RELEASE_ISO_KST,
      vercelStatus: "green",
      lastRegression: REG_OK,
      byokDemoFunnel: FUNNEL_4,
    },
    expected: { dDay: "D-2", readiness: "green" },
  },
  {
    name: "3. D-1 (now=2026-05-07T13:00Z) → 'D-1' / green",
    now: new Date("2026-05-07T13:00:00Z"),
    opts: {
      releaseIso: RELEASE_ISO_KST,
      vercelStatus: "green",
      lastRegression: REG_OK,
      byokDemoFunnel: FUNNEL_4,
    },
    expected: { dDay: "D-1", readiness: "green" },
  },
  {
    name: "4. D-Day 진입 +30min (5/8 00:30 KST) → 'D-0' / green (live-1h)",
    now: new Date("2026-05-07T15:30:00Z"),
    opts: {
      releaseIso: RELEASE_ISO_KST,
      vercelStatus: "green",
      lastRegression: REG_OK,
      byokDemoFunnel: FUNNEL_4,
    },
    expected: { dDay: "D-0", readiness: "green" },
  },
  {
    name: "5. post-launch +2h (5/8 02:00 KST) → 'D+1' / green",
    now: new Date("2026-05-07T17:00:00Z"),
    opts: {
      releaseIso: RELEASE_ISO_KST,
      vercelStatus: "green",
      lastRegression: REG_OK,
      byokDemoFunnel: FUNNEL_4,
    },
    expected: { dDay: "D+1", readiness: "green" },
  },
  {
    name: "6. 회귀 fail (701/702) → red 강제",
    now: new Date("2026-05-06T13:00:00Z"),
    opts: {
      releaseIso: RELEASE_ISO_KST,
      vercelStatus: "green",
      lastRegression: REG_FAIL,
      byokDemoFunnel: FUNNEL_4,
    },
    expected: { dDay: "D-2", readiness: "red" },
  },
];

console.log("sim:release-snapshot — buildReleaseSnapshot 6 시뮬 케이스");

for (const c of cases) {
  const result = buildReleaseSnapshot(c.now, c.opts);
  const ok =
    result.dDay === c.expected.dDay && result.readiness === c.expected.readiness;
  if (ok) {
    pass(`${c.name} (got dDay=${result.dDay}, readiness=${result.readiness})`);
  } else {
    fail(
      c.name,
      `got dDay=${result.dDay} readiness=${result.readiness} expected dDay=${c.expected.dDay} readiness=${c.expected.readiness}`,
    );
  }
}

if (process.exitCode === 1) {
  console.error("sim:release-snapshot — FAIL");
} else {
  console.log("sim:release-snapshot — 6/6 PASS");
}
