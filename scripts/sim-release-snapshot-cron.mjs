#!/usr/bin/env node
/**
 * sim-release-snapshot-cron.mjs
 *   - C-D52-2 (D-1 03시 슬롯, 2026-05-07) — Tori spec C-D52-2 sim 5 케이스.
 *
 * Why: jest/vitest 미설치 (외부 dev-deps +0 의무) → triggerReleaseSnapshot 산식 mirror sim.
 *   release-snapshot-cron.ts 본체는 TS + dynamic import — 본 sim 은 산식 mirror 만 검증.
 *
 * 5 케이스 (명세 § 9 엣지):
 *   1) gitSha undefined → null fallback
 *   2) kpiSnapshot 분모 0 → 0 보호 (total=0)
 *   3) 1h 미만 재호출 → throttle (lastResult 반환)
 *   4) 1h 이상 재호출 → 새 snapshot
 *   5) clock skew ±0.5h → drift 허용 (산식 변화 0)
 *
 * 외부 dev-deps +0 (node 표준만).
 */

const ONE_HOUR_MS = 60 * 60 * 1000;
const RELEASE_ISO = "2026-05-08T00:00:00+09:00";
const HOUR_MS = 60 * 60 * 1000;

// release-snapshot.ts buildReleaseSnapshot mirror.
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
  let dDay;
  if (hoursRemaining <= -1) dDay = "D+1";
  else if (hoursRemaining <= 0) dDay = "D-0";
  else if (hoursRemaining <= 24) dDay = "D-1";
  else dDay = "D-2";
  let readiness = "green";
  if (opts.vercelStatus === "red") readiness = "red";
  else if (opts.lastRegression.pass < opts.lastRegression.total) readiness = "red";
  else if (opts.byokDemoFunnel.step4 < 4) readiness = "yellow";
  return { dDay, hoursRemaining, readiness };
}

// triggerReleaseSnapshot mirror with throttle.
function makeTrigger() {
  let lastTriggerMs = 0;
  let lastResult = null;
  return function trigger(input = {}) {
    const now = input.now ?? new Date();
    const nowMs = now.getTime();
    if (lastResult && nowMs - lastTriggerMs < ONE_HOUR_MS) return lastResult;
    const gitSha = input.gitSha !== undefined ? input.gitSha : null;
    const kpiSnapshot = input.kpiSnapshot ?? { total: 0, byType: {} };
    const snapshot = buildReleaseSnapshot(now, {
      releaseIso: RELEASE_ISO,
      vercelStatus: input.vercelStatus ?? "green",
      lastRegression: input.lastRegression ?? { pass: 1, total: 1, cycle: 1 },
      byokDemoFunnel: input.byokDemoFunnel ?? { step1: 4, step2: 4, step3: 4, step4: 4 },
    });
    const result = {
      iso: now.toISOString(),
      version: input.packageVersion ?? "0.1.0",
      gitSha,
      snapshot,
      kpiSnapshot,
    };
    lastTriggerMs = nowMs;
    lastResult = result;
    return result;
  };
}

console.log("sim:release-snapshot-cron — 5 케이스 (C-D52-2)");
let pass = 0;
let fail = 0;

// (1) gitSha undefined → null fallback.
{
  const trigger = makeTrigger();
  const r = trigger({ now: new Date("2026-05-07T03:00:00+09:00") });
  if (r.gitSha === null) {
    console.log("  ✓ 1. gitSha undefined → null fallback");
    pass++;
  } else {
    console.error(`  ✗ 1. gitSha — expected null, got ${r.gitSha}`);
    fail++;
  }
}

// (2) kpiSnapshot 분모 0 → 0 보호.
{
  const trigger = makeTrigger();
  const r = trigger({ now: new Date("2026-05-07T03:00:00+09:00") });
  if (r.kpiSnapshot.total === 0 && Object.keys(r.kpiSnapshot.byType).length === 0) {
    console.log("  ✓ 2. kpiSnapshot 분모 0 → 0 보호 (total=0, byType={})");
    pass++;
  } else {
    console.error(`  ✗ 2. kpiSnapshot — expected total=0`);
    fail++;
  }
}

// (3) 1h 미만 재호출 → throttle.
{
  const trigger = makeTrigger();
  const r1 = trigger({ now: new Date("2026-05-07T03:00:00+09:00") });
  const r2 = trigger({ now: new Date("2026-05-07T03:30:00+09:00") }); // +30min
  if (r1.iso === r2.iso) {
    console.log("  ✓ 3. 1h 미만 재호출 → throttle (lastResult 반환)");
    pass++;
  } else {
    console.error(`  ✗ 3. throttle — r1.iso=${r1.iso} r2.iso=${r2.iso}`);
    fail++;
  }
}

// (4) 1h 이상 재호출 → 새 snapshot.
{
  const trigger = makeTrigger();
  const r1 = trigger({ now: new Date("2026-05-07T03:00:00+09:00") });
  const r2 = trigger({ now: new Date("2026-05-07T04:30:00+09:00") }); // +1.5h
  if (r1.iso !== r2.iso) {
    console.log("  ✓ 4. 1h 이상 재호출 → 새 snapshot");
    pass++;
  } else {
    console.error(`  ✗ 4. throttle expiry — r1.iso=${r1.iso} r2.iso=${r2.iso}`);
    fail++;
  }
}

// (5) clock skew ±0.5h → drift 허용 (산식 변화 0 — buildReleaseSnapshot Math.ceil hoursRemaining 영향 가능).
{
  const trigger1 = makeTrigger();
  const trigger2 = makeTrigger();
  const t1 = trigger1({ now: new Date("2026-05-07T03:00:00+09:00") });
  const t2 = trigger2({ now: new Date("2026-05-07T03:30:00+09:00") }); // +30min skew
  // 두 시점 모두 D-1 시점 — readiness/dDay 동일.
  if (t1.snapshot.dDay === t2.snapshot.dDay && t1.snapshot.readiness === t2.snapshot.readiness) {
    console.log(`  ✓ 5. clock skew ±0.5h → drift 허용 (dDay=${t1.snapshot.dDay} readiness=${t1.snapshot.readiness})`);
    pass++;
  } else {
    console.error(`  ✗ 5. clock skew — t1=${t1.snapshot.dDay}/${t1.snapshot.readiness} t2=${t2.snapshot.dDay}/${t2.snapshot.readiness}`);
    fail++;
  }
}

if (fail > 0) {
  console.error(`sim:release-snapshot-cron — FAIL ${fail}/5`);
  process.exit(1);
}
console.log(`sim:release-snapshot-cron — ${pass}/5 PASS`);
