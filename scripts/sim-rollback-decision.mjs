#!/usr/bin/env node
/**
 * sim-rollback-decision.mjs
 *   - C-D47-4 (D-2 07시 슬롯, 2026-05-06) — Tori spec C-D47-4 (B-D47-3 / F-D47-3).
 *
 * Why: Release 롤백 정책 의사 결정 트리 시뮬 — 90s 핫픽스 → revert 자동.
 *   D-Day 5/8 ±1h 비상 슬롯 (B-D46-4) 안 깨짐 발견 시 결정 트리 검증.
 *
 * 정책:
 *   - 실 git revert 미실행 — 의사 결정 트리 시뮬만 (CI 안정성 의무).
 *   - mock failure case 5종 (A∼E) — typecheck/build/runtime/시각/정상.
 *   - 90s = 핫픽스 가능 범위 (typecheck + push + Vercel 자동 배포 평균 60∼90s).
 *   - 외부 dev-deps +0 (Node 내장만).
 *
 * 5 cases:
 *   A) typecheck FAIL → 즉시 revert (90s 핫픽스 불가)
 *   B) build FAIL → 즉시 revert (Vercel 배포 차단)
 *   C) runtime 5xx 응답 50% 이상 → revert (사용자 마찰 즉시 차단)
 *   D) 시각적 깨짐 (Hero LIVE 미전환) → 90s 핫픽스 시도 → 90s 초과 시 revert
 *   E) KPI 정상 + 시각 정상 → 정상 (revert 미발생)
 */

let failed = 0;
function pass(label) { console.log(`  ✓ ${label}`); }
function fail(label, msg) {
  console.error(`  ✗ ${label} — ${msg}`);
  failed += 1;
  process.exitCode = 1;
}

const HOTFIX_WINDOW_MS = 90_000;

/**
 * 의사 결정 트리. failure 입력 → 'revert' / 'hotfix' / 'normal' 출력.
 *   hotfix 분기 시 elapsed 초과면 revert로 자동 전환.
 */
function decide(failure, elapsedMs = 0) {
  switch (failure.kind) {
    case "typecheck":
    case "build":
      return { action: "revert", reason: `${failure.kind} FAIL — 즉시 revert` };
    case "runtime5xx":
      if (failure.errorRate >= 0.5) {
        return { action: "revert", reason: `runtime 5xx ${(failure.errorRate * 100).toFixed(0)}% — revert` };
      }
      return { action: "hotfix", reason: `runtime 5xx ${(failure.errorRate * 100).toFixed(0)}% — 핫픽스 시도` };
    case "visual":
      if (elapsedMs > HOTFIX_WINDOW_MS) {
        return { action: "revert", reason: `시각 깨짐 ${elapsedMs}ms 경과 — 90s 초과 revert` };
      }
      return { action: "hotfix", reason: `시각 깨짐 — 90s 핫픽스 시도 (elapsed ${elapsedMs}ms)` };
    case "normal":
      return { action: "normal", reason: "KPI + 시각 정상" };
    default:
      return { action: "revert", reason: `unknown failure ${failure.kind}` };
  }
}

console.log("sim:rollback-decision — 의사 결정 트리 5 케이스");

// Case A: typecheck FAIL → revert
{
  const d = decide({ kind: "typecheck" });
  if (d.action === "revert") pass(`A. typecheck FAIL → revert (${d.reason})`);
  else fail("A. typecheck", `expected revert, got ${d.action}`);
}

// Case B: build FAIL → revert
{
  const d = decide({ kind: "build" });
  if (d.action === "revert") pass(`B. build FAIL → revert (${d.reason})`);
  else fail("B. build", `expected revert, got ${d.action}`);
}

// Case C: runtime 5xx 50% 이상 → revert
{
  const d = decide({ kind: "runtime5xx", errorRate: 0.6 });
  if (d.action === "revert") pass(`C. runtime 5xx 60% → revert (${d.reason})`);
  else fail("C. runtime5xx", `expected revert, got ${d.action}`);
}

// Case D: 시각 깨짐 — 90s 핫픽스 시도 → 100s 경과 시 revert
{
  const d1 = decide({ kind: "visual" }, 30_000);
  const d2 = decide({ kind: "visual" }, 100_000);
  if (d1.action === "hotfix" && d2.action === "revert") {
    pass(`D. visual 30s=hotfix / 100s=revert (90s 임계 정합)`);
    pass(`   — git revert HEAD 명령 string 발사 의도 (실 미실행)`);
  } else {
    fail("D. visual", `30s=${d1.action} 100s=${d2.action} (expected hotfix/revert)`);
  }
}

// Case E: 정상 → revert 미발생
{
  const d = decide({ kind: "normal" });
  if (d.action === "normal") pass(`E. KPI + 시각 정상 → revert 미발생`);
  else fail("E. normal", `expected normal, got ${d.action}`);
}

if (failed === 0) {
  console.log("sim:rollback-decision — 5/5 PASS");
} else {
  console.error(`sim:rollback-decision — FAIL (${failed} 케이스)`);
}
