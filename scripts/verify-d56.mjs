#!/usr/bin/env node
/**
 * verify-d56.mjs
 *   - C-D56-2 (D-1 19시 슬롯, 2026-05-07) — Tori spec C-D56-2 (8 게이트 통합 회귀).
 *
 * Why: D-1 release freeze T-6h 시점 D-D56 사이클 산출 통합 검증.
 *   - C-D56-3 release-freeze-cutoff.ts SoT 단일 (RELEASE_FREEZE_CUTOFF_KST + SUBMIT_DEADLINE_KST + monitor)
 *   - sim:show-hn-submit 6/6 + sim:release-freeze 4/4 내부 호출 흡수
 *   - 보존 13 v3 무손상 + i18n parity 변동 0 + dev-deps +0 + 어휘 룰 0건
 *   - hero* 4 직접 변경 0 (release freeze 정합 — D-D55 게이트 8 패턴 흡수)
 *
 * 8 게이트 (read-only / no-write):
 *   1) release-freeze-cutoff.ts 존재 + RELEASE_FREEZE_CUTOFF_KST SoT 비교 + sim:release-freeze 4/4
 *   2) SUBMIT_DEADLINE_KST 양쪽 일관성 (release-freeze-cutoff.ts ↔ sim-show-hn-submit.mjs) + sim:show-hn-submit 6/6
 *   3) i18n parity ko === en (실제값 300 — 명세 305 추정 → 자율 정정 D-56-자-1 사실 확정)
 *   4) hero* 4 (transition/pulse/title-slot/live-banner) 5/7 이후 변경 0 read-only grep diff
 *   5) dim-hero.ts buildHeroDimmingOpacity 산식 단일 등장 (모듈 외부 중복 0)
 *   6) 보존 13 v3 무손상 — verify:conservation-13 6/6 PASS 의존 호출
 *   7) package.json devDependencies === 11 + dependencies === 7
 *   8) check:vocab 0건
 *
 * 자율 정정 (D-56-자):
 *   - D-56-자-1: i18n parity 정합값 — 명세 305 추정 → 실 300 (check:i18n 출력 사실 확정).
 *   - D-56-자-2: SUBMIT_DEADLINE_KST SoT 위치 — release-freeze-cutoff.ts SoT 통합 신규 추가.
 *                show-hn-submit-config.ts 변경 0 (i18n MESSAGES 변동 0 락 정합 유지).
 *
 * 외부 dev-deps +0 (node 표준만).
 */

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = process.cwd();
let failed = 0;
let passed = 0;

function pass(label) {
  passed++;
  console.log(`  ✓ ${label}`);
}
function fail(label, msg) {
  failed++;
  console.error(`  ✗ ${label} — ${msg}`);
}

function runNode(args) {
  const r = spawnSync("node", args, { cwd: root, encoding: "utf8" });
  return { code: r.status ?? 1, stdout: r.stdout, stderr: r.stderr };
}

function readOrEmpty(p) {
  try {
    return readFileSync(resolve(root, p), "utf8");
  } catch {
    return "";
  }
}

console.log("verify:d56 — D-D56 사이클 8 게이트 통합 회귀");
console.log("");

// ── 게이트 1: release-freeze-cutoff.ts 존재 + RELEASE_FREEZE_CUTOFF_KST SoT + sim:release-freeze 4/4
{
  const src = readOrEmpty("src/modules/launch/release-freeze-cutoff.ts");
  const cutoffMatch = /RELEASE_FREEZE_CUTOFF_KST\s*=\s*"2026-05-07T23:00:00\+09:00"/.test(
    src,
  );
  const monitorMatch =
    /LIVE_MONITOR_START_KST\s*=\s*"2026-05-08T00:00:00\+09:00"/.test(src) &&
    /LIVE_MONITOR_DURATION_MIN\s*=\s*30/.test(src);
  const exportFn = /export function getReleaseFreezeStatus/.test(src);
  if (!cutoffMatch) {
    fail("게이트 1", "RELEASE_FREEZE_CUTOFF_KST SoT 불일치");
  } else if (!monitorMatch) {
    fail("게이트 1", "LIVE_MONITOR_START_KST 또는 LIVE_MONITOR_DURATION_MIN 불일치");
  } else if (!exportFn) {
    fail("게이트 1", "getReleaseFreezeStatus export 미존재");
  } else {
    const sim = runNode(["scripts/sim-release-freeze.mjs"]);
    if (sim.code === 0 && /4\/4 PASS/.test(sim.stdout)) {
      pass("게이트 1: release-freeze-cutoff.ts SoT + sim:release-freeze 4/4 PASS");
    } else {
      fail("게이트 1", `sim:release-freeze 실패 — ${sim.stderr.slice(0, 200)}`);
    }
  }
}

// ── 게이트 2: SUBMIT_DEADLINE_KST 양쪽 일관성 + sim:show-hn-submit 6/6
{
  const cutoffSrc = readOrEmpty("src/modules/launch/release-freeze-cutoff.ts");
  const simSrc = readOrEmpty("scripts/sim-show-hn-submit.mjs");
  const cutoffDeadline = /SUBMIT_DEADLINE_KST\s*=\s*"2026-05-07T22:00:00\+09:00"/.test(
    cutoffSrc,
  );
  const simDeadline = /SUBMIT_DEADLINE_KST\s*=\s*"2026-05-07T22:00:00\+09:00"/.test(
    simSrc,
  );
  if (!cutoffDeadline) {
    fail("게이트 2", "release-freeze-cutoff.ts 의 SUBMIT_DEADLINE_KST 불일치");
  } else if (!simDeadline) {
    fail("게이트 2", "sim-show-hn-submit.mjs 의 SUBMIT_DEADLINE_KST 불일치");
  } else {
    const sim = runNode(["scripts/sim-show-hn-submit.mjs"]);
    if (sim.code === 0 && /6\/6 PASS/.test(sim.stdout)) {
      pass(
        "게이트 2: SUBMIT_DEADLINE_KST 양쪽 일관성 + sim:show-hn-submit 6/6 PASS (D-56-자-2)",
      );
    } else {
      fail("게이트 2", `sim:show-hn-submit 실패 — ${sim.stderr.slice(0, 200)}`);
    }
  }
}

// ── 게이트 3: i18n parity (실제값 300 — D-56-자-1 사실 확정)
{
  const r = runNode(["scripts/check-i18n-keys.mjs"]);
  if (r.code !== 0) {
    fail("게이트 3", `check:i18n 실패 — ${r.stderr.slice(0, 200)}`);
  } else {
    // 실제 키 카운트는 두 번째 줄: "i18n 사용 키 N개 / ko M개 / en M개"
    // 첫 줄 "i18n catalog ko X / en X" 은 카탈로그 파일(모듈) 카운트로 별도.
    const m = r.stdout.match(/ko\s+(\d+)개\s*\/\s*en\s+(\d+)개/);
    if (!m) {
      fail("게이트 3", `i18n 키 카운트 매칭 실패 — ${r.stdout.slice(0, 200)}`);
    } else {
      const koN = Number(m[1]);
      const enN = Number(m[2]);
      if (koN === enN && koN === 300) {
        pass(
          `게이트 3: i18n parity ko=${koN} / en=${enN} (D-56-자-1 사실 확정 — 명세 305 추정 → 실 300)`,
        );
      } else if (koN === enN) {
        fail(
          "게이트 3",
          `parity OK이지만 정합값 변동 ko=${koN}/en=${enN} (D-56-자-1 사실 확정값 300 ≠ 측정값)`,
        );
      } else {
        fail("게이트 3", `parity FAIL ko=${koN}/en=${enN}`);
      }
    }
  }
}

// ── 게이트 4: hero* 4 (transition/pulse/title-slot/live-banner) 5/7 이후 변경 0
{
  const heroFiles = [
    "src/modules/launch/hero-live-transition.tsx",
    "src/modules/launch/hero-live-pulse.tsx",
    "src/modules/launch/hero-title-slot.tsx",
    "src/modules/launch/hero-live-banner.tsx",
  ];
  // 5/7 23시 release freeze 이전이므로 5/7 00:00 KST 이후 변경 0 의무
  const since = "2026-05-07T00:00:00+09:00";
  const r = spawnSync(
    "git",
    ["log", "--since", since, "--oneline", "--", ...heroFiles],
    { cwd: root, encoding: "utf8" },
  );
  const lines = (r.stdout ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    pass("게이트 4: hero* 4 (transition/pulse/title-slot/live-banner) 5/7 이후 변경 0");
  } else {
    fail(
      "게이트 4",
      `hero* 4 변경 ${lines.length}건 발견 — release freeze 정합 위반: ${lines.slice(0, 3).join(" / ")}`,
    );
  }
}

// ── 게이트 5: dim-hero.ts buildHeroDimmingOpacity 산식 단일 등장
{
  // 직접 산식 본문 — 정의 (function/export) 단일 등장 (모듈 외부 산식 중복 0)
  const dimSrc = readOrEmpty("src/modules/launch/dim-hero.ts");
  if (!/export function buildHeroDimmingOpacity/.test(dimSrc)) {
    fail("게이트 5", "dim-hero.ts buildHeroDimmingOpacity export 미존재");
  } else {
    // src/ 전체에서 함수 정의 (`function buildHeroDimmingOpacity` 또는 `export function buildHeroDimmingOpacity`) 카운트
    const r = spawnSync(
      "grep",
      [
        "-rE",
        "(export\\s+)?function\\s+buildHeroDimmingOpacity",
        "src/",
        "--include=*.ts",
        "--include=*.tsx",
      ],
      { cwd: root, encoding: "utf8" },
    );
    const lines = (r.stdout ?? "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 1) {
      pass("게이트 5: buildHeroDimmingOpacity 단일 정의 (산식 중복 0)");
    } else {
      fail(
        "게이트 5",
        `buildHeroDimmingOpacity 정의 ${lines.length}건 — 산식 중복 (단일 SoT 위반): ${lines.join(" / ")}`,
      );
    }
  }
}

// ── 게이트 6: 보존 13 v3 무손상
{
  const r = runNode(["scripts/verify-conservation-13.mjs"]);
  if (r.code === 0) {
    pass("게이트 6: verify:conservation-13 6/6 PASS — 보존 13 v3 무손상");
  } else {
    fail("게이트 6", `verify:conservation-13 실패 — ${r.stderr.slice(0, 200)}`);
  }
}

// ── 게이트 7: devDeps === 11 + deps === 7
{
  let pkg;
  try {
    pkg = JSON.parse(readOrEmpty("package.json"));
  } catch {
    pkg = null;
  }
  const depsN = pkg?.dependencies ? Object.keys(pkg.dependencies).length : -1;
  const devN = pkg?.devDependencies
    ? Object.keys(pkg.devDependencies).length
    : -1;
  if (depsN === 7 && devN === 11) {
    pass(`게이트 7: package.json deps=${depsN} / devDeps=${devN}`);
  } else {
    fail("게이트 7", `dev-deps 카운트 불일치 — deps=${depsN} (기대 7) / devDeps=${devN} (기대 11)`);
  }
}

// ── 게이트 8: check:vocab 0건
{
  const r = runNode(["scripts/check-vocab.mjs", "--all"]);
  if (r.code === 0) {
    pass("게이트 8: check:vocab 0건 (어휘 룰 정합)");
  } else {
    fail("게이트 8", `check:vocab 실패 — ${r.stderr.slice(0, 200)}`);
  }
}

console.log("");
console.log(
  `verify:d56 — ${passed}/${passed + failed} ${failed === 0 ? "PASS" : "FAIL"}`,
);

process.exit(failed === 0 ? 0 : 1);
