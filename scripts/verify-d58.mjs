#!/usr/bin/env node
/**
 * verify-d58.mjs
 *   - C-D58-1 (D-Day 03시 슬롯, 2026-05-08) — Tori spec C-D58-1 (8 read-only 게이트 통합 회귀).
 *
 * Why: D-Day live phase 진입 사후 첫 꼬미 슬롯 회귀 게이트.
 *   - L-D58-1 변경 0 (live phase) — 보존 13 + 9cd5fdd commit + tag release/2026-05-08 무손상
 *   - L-D58-2 verify:all 단조 증가 — 39 → 40
 *   - L-D58-3 emergency bypass 미사용 (RELEASE_FREEZE_OVERRIDE=1 commit 0건)
 *   - L-D58-4 i18n MESSAGES 변동 0 (D-55-자-3 정합, ko=300 / en=300)
 *
 * 8 게이트 (read-only / no-write):
 *   1) check-live-phase           — phase=live 정합 (C-D58-2 호출 + --expect=live)
 *   2) d-day-live-monitor-sop     — docs/D-DAY-LIVE-MONITOR.md 존재 + ≥8 H2 헤더 (C-D58-3)
 *   3) sim-funnel-events-day1     — sim:funnel-day1 4/4 PASS (C-D58-4)
 *   4) d-plus-1-retro-template    — docs/D-PLUS-1-RETRO-TEMPLATE.md 존재 + ≥10 H2 + ≥5 {{VAR}} (C-D58-5)
 *   5) release-freeze-cutoff-sot  — release-freeze-cutoff.ts 4 상수 정합 + freeze 이후 변경 0
 *   6) release-tag-pushed         — git tag release/2026-05-08 존재
 *   7) preserved-13-untouched     — verify:conservation-13 6/6 PASS
 *   8) no-emergency-bypass-used   — git log freeze 이후 RELEASE_FREEZE_OVERRIDE commit 0건
 *
 * 자율 정정 (D-58-자):
 *   - D-58-자-1: 명세 §C-D58-2 import 경로 'src/modules/release/' 추정 → 실 'src/modules/launch/'
 *                사실 확정 (자율 정정 §4 §C-D58-2 엣지 케이스 ② 명시 권한).
 *   - D-58-자-2: .mjs ↔ .ts import 불가 → SoT 산식 1:1 미러 채택 (D-53-자-1 락 정합).
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

function runGit(args) {
  const r = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  return { code: r.status ?? 1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

function readOrEmpty(p) {
  try {
    return readFileSync(resolve(root, p), "utf8");
  } catch {
    return "";
  }
}

console.log("verify:d58 — D-D58 사이클 8 read-only 게이트 통합 회귀");
console.log("");

// ── 게이트 1: check-live-phase phase=live 정합 (C-D58-2)
{
  const r = runNode(["scripts/check-live-phase.mjs", "--expect=live"]);
  if (r.code === 0) {
    let parsed = null;
    try {
      parsed = JSON.parse(r.stdout.split("\n").filter(Boolean)[0] ?? "");
    } catch {
      parsed = null;
    }
    if (parsed && parsed.phase === "live") {
      pass(
        `게이트 1: check-live-phase phase=live (cutoff=${parsed.cutoff}, monitorStart=${parsed.monitorStart})`,
      );
    } else {
      fail("게이트 1", `JSON 파싱 실패 또는 phase 불일치 — stdout='${r.stdout.slice(0, 200)}'`);
    }
  } else {
    fail("게이트 1", `check:live-phase --expect=live 실패 (exit ${r.code}) — ${r.stderr.slice(0, 200)}`);
  }
}

// ── 게이트 2: docs/D-DAY-LIVE-MONITOR.md 존재 + ≥8 H2 헤더
{
  const md = readOrEmpty("docs/D-DAY-LIVE-MONITOR.md");
  if (!md) {
    fail("게이트 2", "docs/D-DAY-LIVE-MONITOR.md 미존재");
  } else {
    const h2Lines = md.split("\n").filter((l) => /^##\s+\d+\.\s/.test(l));
    if (h2Lines.length >= 8) {
      pass(`게이트 2: D-DAY-LIVE-MONITOR.md 존재 + H2 ${h2Lines.length}건 (≥8)`);
    } else {
      fail("게이트 2", `H2 ${h2Lines.length}건 (8 미달)`);
    }
  }
}

// ── 게이트 3: sim:funnel-day1 4/4 PASS (C-D58-4)
{
  const r = runNode(["scripts/sim-funnel-events-day1.mjs"]);
  if (r.code === 0 && /4\/4 PASS/.test(r.stdout)) {
    pass("게이트 3: sim:funnel-day1 4/4 PASS (C-D58-4)");
  } else {
    fail("게이트 3", `sim:funnel-day1 실패 (exit ${r.code}) — ${r.stderr.slice(0, 200)}`);
  }
}

// ── 게이트 4: docs/D-PLUS-1-RETRO-TEMPLATE.md 존재 + ≥10 H2 + ≥5 {{VAR}}
{
  const md = readOrEmpty("docs/D-PLUS-1-RETRO-TEMPLATE.md");
  if (!md) {
    fail("게이트 4", "docs/D-PLUS-1-RETRO-TEMPLATE.md 미존재");
  } else {
    const h2Lines = md.split("\n").filter((l) => /^##\s+\d+\.\s/.test(l));
    const varMatches = md.match(/\{\{[A-Z][A-Z0-9_]*\}\}/g) ?? [];
    if (h2Lines.length >= 10 && varMatches.length >= 5) {
      pass(
        `게이트 4: D-PLUS-1-RETRO-TEMPLATE.md H2 ${h2Lines.length}건 (≥10) + 변수 ${varMatches.length}건 (≥5)`,
      );
    } else {
      fail(
        "게이트 4",
        `H2 ${h2Lines.length}건 (10 미달) 또는 변수 ${varMatches.length}건 (5 미달)`,
      );
    }
  }
}

// ── 게이트 5: release-freeze-cutoff.ts 4 상수 정합 + freeze 이후 변경 0
{
  const src = readOrEmpty("src/modules/launch/release-freeze-cutoff.ts");
  if (!src) {
    fail("게이트 5", "src/modules/launch/release-freeze-cutoff.ts 미존재");
  } else {
    const cutoff = /RELEASE_FREEZE_CUTOFF_KST\s*=\s*\n?\s*"2026-05-07T23:00:00\+09:00"/.test(src);
    const monStart = /LIVE_MONITOR_START_KST\s*=\s*\n?\s*"2026-05-08T00:00:00\+09:00"/.test(src);
    const monDur = /LIVE_MONITOR_DURATION_MIN\s*=\s*30/.test(src);
    const submit = /SUBMIT_DEADLINE_KST\s*=\s*\n?\s*"2026-05-07T22:00:00\+09:00"/.test(src);
    if (!cutoff || !monStart || !monDur || !submit) {
      fail(
        "게이트 5",
        `4 상수 정합 위반 — cutoff=${cutoff} monStart=${monStart} monDur=${monDur} submit=${submit}`,
      );
    } else {
      // freeze 이후(5/7 23:00 KST 이후) 본 파일 commit 변경 0 의무
      const since = "2026-05-07T23:00:00+09:00";
      const r = runGit([
        "log",
        "--since",
        since,
        "--oneline",
        "--",
        "src/modules/launch/release-freeze-cutoff.ts",
      ]);
      const lines = r.stdout.split("\n").filter(Boolean);
      if (lines.length === 0) {
        pass(
          "게이트 5: release-freeze-cutoff.ts 4 상수 정합 + freeze 이후 변경 0 (L-D58-1 정합)",
        );
      } else {
        fail(
          "게이트 5",
          `freeze 이후 ${lines.length}건 변경 검출 (L-D58-1 위반): ${lines.slice(0, 3).join(" / ")}`,
        );
      }
    }
  }
}

// ── 게이트 6: git tag release/2026-05-08 존재
{
  const r = runGit(["tag", "--list", "release/2026-05-08"]);
  const has = r.stdout.split("\n").map((l) => l.trim()).includes("release/2026-05-08");
  if (has) {
    // tag 가 가리키는 commit 도 확인
    const r2 = runGit(["rev-list", "-n", "1", "release/2026-05-08"]);
    const sha = r2.stdout.trim().slice(0, 7);
    pass(`게이트 6: tag release/2026-05-08 존재 (commit ${sha})`);
  } else {
    fail("게이트 6", "tag release/2026-05-08 미존재");
  }
}

// ── 게이트 7: verify:conservation-13 6/6 PASS — 보존 13 v3 무손상
{
  const r = runNode(["scripts/verify-conservation-13.mjs"]);
  if (r.code === 0) {
    pass("게이트 7: verify:conservation-13 6/6 PASS — 보존 13 v3 무손상");
  } else {
    fail("게이트 7", `verify:conservation-13 실패 — ${r.stderr.slice(0, 200)}`);
  }
}

// ── 게이트 8: emergency bypass 미사용 (RELEASE_FREEZE_OVERRIDE commit 0건)
{
  const since = "2026-05-07T23:00:00+09:00";
  const r = runGit([
    "log",
    "--since",
    since,
    "--all",
    "--oneline",
    "--grep",
    "RELEASE_FREEZE_OVERRIDE",
  ]);
  const lines = r.stdout.split("\n").filter(Boolean);
  if (lines.length === 0) {
    pass("게이트 8: emergency bypass (RELEASE_FREEZE_OVERRIDE) commit 0건 (L-D58-3 정합)");
  } else {
    fail(
      "게이트 8",
      `bypass commit ${lines.length}건 검출 (L-D58-3 위반): ${lines.slice(0, 3).join(" / ")}`,
    );
  }
}

console.log("");
console.log(
  `verify:d58 — ${passed}/${passed + failed} ${failed === 0 ? "PASS" : "FAIL"}`,
);

process.exit(failed === 0 ? 0 : 1);
