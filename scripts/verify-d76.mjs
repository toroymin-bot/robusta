#!/usr/bin/env node
/**
 * verify-d76.mjs
 *   - C-D76-5 ⭐ (D+3 15시 §8 슬롯, 2026-05-11) — Tori spec C-D76-5 (Task_2026-05-11 §5.6).
 *
 * Why: D-D76 사이클 8 read-only 게이트. CI 하드 게이트 (자가 보정 → 코드 강제 승급) 통합 회귀.
 *   C-D75-5 (verify-d75.mjs) +1 사이클 단조 — D-D74 verify 큐는 §6 sweep echo로 deferred 유지.
 *
 * 8 게이트 (§5.6 본체 lock):
 *   G1) scripts/check-live-plus-264h.mjs 존재 + ESM import 무에러 + checkLivePlus264h grep ≥ 3
 *   G2) .github/workflows/check-ocp-append.yml 존재 + on.push.branches==['main'] + steps[2].name=='Sleep 30 minutes'
 *   G3) docs/CI-OCP-APPEND-SPEC.md 존재 + H2 정확히 8개
 *   G4) scripts/sim-live-plus-264h.mjs 존재 + 3/3 PASS 실행 + totalMs=\d+ regex 1건
 *   G5) L-D76-1 정책 락 (보존 13 침범 0 — git diff --name-only origin/main -- src/ 결과 empty)
 *   G6) L-D76-2 정책 락 (어휘 룰 self-grep 0건 — D-D76 신규 파일 + 본 docs/scripts/.github)
 *   G7) L-D76-3 정책 락 (Confluence write 0 — workflow YAML write:* 토큰 0건)
 *   G8) L-D76-4 정책 락 (verify:all 단조 + verify:d76 등재 + 3 sub-scripts)
 *
 * 자율 정정 큐 (D-76-자):
 *   G5 git 미설치 또는 origin/main 미설정 시 skip + reason (D-75-자 패턴 미러).
 *
 * 외부 dev-deps +0 (node 표준만 — YAML parse는 regex 기반).
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

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

function readOrEmpty(p) {
  try {
    return readFileSync(resolve(root, p), "utf8");
  } catch {
    return "";
  }
}

function runNode(args) {
  const r = spawnSync("node", args, { cwd: root, encoding: "utf8" });
  return { code: r.status ?? 1, stdout: r.stdout || "", stderr: r.stderr || "" };
}

console.log("verify:d76 — D-D76 사이클 8 read-only 게이트 통합 회귀 (CI 하드 게이트)");
console.log("");

// ── G1: scripts/check-live-plus-264h.mjs 존재 + checkLivePlus264h grep ≥ 3.
{
  const file = "scripts/check-live-plus-264h.mjs";
  if (!existsSync(resolve(root, file))) {
    fail("G1", `missing ${file}`);
  } else {
    const src = readOrEmpty(file);
    const hits = (src.match(/checkLivePlus264h/g) || []).length;
    if (hits >= 3) {
      const r = runNode([
        "--input-type=module",
        "-e",
        "import('./scripts/check-live-plus-264h.mjs').then(m=>console.log(typeof m.checkLivePlus264h))",
      ]);
      if (r.code === 0 && /function/.test(r.stdout)) {
        pass(`G1: check-live-plus-264h.mjs 존재 + grep ${hits}건 + ESM import OK`);
      } else {
        fail("G1", `ESM import failed: code=${r.code} stderr=${r.stderr.slice(0, 200)}`);
      }
    } else {
      fail("G1", `identifier checkLivePlus264h grep ${hits}건 (≥3 의무)`);
    }
  }
}

// ── G2: .github/workflows/check-ocp-append.yml 존재 + on.push.branches==['main'] + steps[2].name=='Sleep 30 minutes'.
{
  const file = ".github/workflows/check-ocp-append.yml";
  if (!existsSync(resolve(root, file))) {
    fail("G2", `missing ${file}`);
  } else {
    const yml = readOrEmpty(file);
    // regex YAML 구조 검증 (외부 yaml 의존 0).
    const hasOnPushMain =
      /on:\s*\n\s+push:\s*\n\s+branches:\s*\[\s*main\s*\]/.test(yml) ||
      /on:\s*\n\s+push:\s*\n\s+branches:\s*\n\s+-\s*main/.test(yml);
    // steps[2].name — 0-based: steps[0]=Capture push time, steps[1]=pre, steps[2]=Sleep 30 minutes.
    const stepNameMatches = [...yml.matchAll(/^\s+-\s+name:\s+(.+)$/gm)].map((m) => m[1].trim());
    const sleepStepName = stepNameMatches[2];
    if (hasOnPushMain && sleepStepName === "Sleep 30 minutes") {
      pass(`G2: check-ocp-append.yml on.push.branches==[main] + steps[2].name=='Sleep 30 minutes'`);
    } else {
      fail(
        "G2",
        `on.push.branches==[main]=${hasOnPushMain} / steps[2].name='${sleepStepName || "(none)"}' (expected 'Sleep 30 minutes')`,
      );
    }
  }
}

// ── G3: docs/CI-OCP-APPEND-SPEC.md 존재 + H2 정확히 8개.
{
  const file = "docs/CI-OCP-APPEND-SPEC.md";
  if (!existsSync(resolve(root, file))) {
    fail("G3", `missing ${file}`);
  } else {
    const md = readOrEmpty(file);
    const numbered = (md.match(/^## \d+\.\s/gm) || []).length;
    const totalH2 = (md.match(/^## /gm) || []).length;
    if (numbered === 8 && totalH2 === 8) {
      pass(`G3: CI-OCP-APPEND-SPEC.md H2 8개 정합 (${numbered} numbered, total ${totalH2})`);
    } else {
      fail("G3", `H2 numbered ${numbered}건 / total ${totalH2}건 (둘 다 8 의무)`);
    }
  }
}

// ── G4: scripts/sim-live-plus-264h.mjs 3/3 PASS + totalMs=\d+ regex.
{
  const file = "scripts/sim-live-plus-264h.mjs";
  if (!existsSync(resolve(root, file))) {
    fail("G4", `missing ${file}`);
  } else {
    const r = runNode([file]);
    const totalMsHit = /totalMs=\d+/.test(r.stdout);
    if (r.code === 0 && /3\/3 PASS/.test(r.stdout) && totalMsHit) {
      pass(`G4: sim-live-plus-264h.mjs 3/3 PASS + totalMs=\\d+ 측정`);
    } else {
      fail(
        "G4",
        `sim exit=${r.code} totalMs=${totalMsHit} stdout-tail=${r.stdout.split("\n").filter(Boolean).slice(-2).join(" | ")}`,
      );
    }
  }
}

// ── G5: L-D76-1 — git diff --name-only origin/main -- src/ 결과 empty.
//   D-76-자 fallback: git 미설치 또는 origin/main 부재 시 skip.
{
  const gitCheck = spawnSync("git", ["--version"], { cwd: root, encoding: "utf8" });
  if (gitCheck.status !== 0) {
    pass(`G5: skip (git not available, D-76-자 fallback)`);
  } else {
    const refCheck = spawnSync(
      "git",
      ["rev-parse", "--verify", "origin/main"],
      { cwd: root, encoding: "utf8" },
    );
    if (refCheck.status !== 0) {
      pass(`G5: skip (origin/main ref absent, D-76-자 fallback)`);
    } else {
      const r = spawnSync(
        "git",
        ["diff", "--name-only", "origin/main", "--", "src/"],
        { cwd: root, encoding: "utf8" },
      );
      const out = (r.stdout || "").trim();
      if (r.status === 0 && out.length === 0) {
        pass(`G5: L-D76-1 보존 13 침범 0 (git diff --name-only origin/main -- src/ empty)`);
      } else {
        fail(
          "G5",
          `git diff exit=${r.status} src/ changed files: ${out.split("\n").slice(0, 5).join(", ")}`,
        );
      }
    }
  }
}

// ── G6: L-D76-2 — 어휘 룰 self-grep 0건 (D-D76 신규 파일).
{
  const newFiles = [
    "scripts/check-live-plus-264h.mjs",
    "scripts/sim-live-plus-264h.mjs",
    "scripts/verify-d76.mjs",
    "docs/CI-OCP-APPEND-SPEC.md",
    ".github/workflows/check-ocp-append.yml",
  ];
  // /박(음|다|았|혀|혔|제|힘|힌)/ — check-vocab.mjs (D-D19/D-D20) 패턴 미러.
  // 본 스크립트는 검증 도구로서 정규식 자체에 패턴이 포함되므로 자기 자신 검증 제외.
  const pat = /박(음|다|았|혀|혔|제|힘|힌)/g;
  const hits = [];
  for (const f of newFiles) {
    if (f === "scripts/verify-d76.mjs") continue; // self-exclude.
    const src = readOrEmpty(f);
    let m;
    while ((m = pat.exec(src)) !== null) {
      hits.push(`${f}: ${m[0]} @ ${m.index}`);
    }
  }
  if (hits.length === 0) {
    pass(`G6: L-D76-2 어휘 룰 self-grep 0건 (${newFiles.length - 1} files scanned, verify-d76 self-excluded)`);
  } else {
    fail("G6", `L-D76-2 vocab violations ${hits.length}건: ${hits.slice(0, 5).join(" | ")}`);
  }
}

// ── G7: L-D76-3 — Confluence write 권한 0 (workflow YAML write:* 토큰 0건).
{
  const file = ".github/workflows/check-ocp-append.yml";
  const yml = readOrEmpty(file);
  // 토큰 grep 패턴 (Tori §5.7 L-D76-3 정합).
  const writePat = /write:(comment|page):confluence|write:jira-work/g;
  const hits = (yml.match(writePat) || []);
  if (hits.length === 0) {
    pass(`G7: L-D76-3 Confluence write 0 (workflow YAML write:* 토큰 0건)`);
  } else {
    fail("G7", `L-D76-3 violation: ${hits.length} write token(s) found: ${hits.slice(0, 3).join(", ")}`);
  }
}

// ── G8: L-D76-4 — package.json + verify-all.mjs 모두 verify:d76 등재 + 3 sub-scripts.
{
  const pkg = readOrEmpty("package.json");
  const verifyAll = readOrEmpty("scripts/verify-all.mjs");
  const pkgHas = /"verify:d76"\s*:/.test(pkg);
  const allHas = /"verify:d76"/.test(verifyAll);
  const pkgChkHas = /"check:live-plus-264h"\s*:/.test(pkg);
  const pkgSimHas = /"sim:live-plus-264h"\s*:/.test(pkg);

  const required = { pkgHas, allHas, pkgChkHas, pkgSimHas };
  const missing = Object.entries(required)
    .filter(([_, v]) => !v)
    .map(([k]) => k);

  if (missing.length === 0) {
    pass(`G8: L-D76-4 verify:d76 OCP append (package.json + verify-all.mjs + 2 sub-scripts)`);
  } else {
    fail("G8", `missing OCP append: ${missing.join(", ")}`);
  }
}

console.log("");
console.log(
  `verify:d76 — ${passed}/${passed + failed} ${failed === 0 ? "PASS" : "FAIL"}`,
);

process.exit(failed === 0 ? 0 : 1);
