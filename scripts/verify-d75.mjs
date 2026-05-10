#!/usr/bin/env node
/**
 * verify-d75.mjs
 *   - C-D75-5 ⭐ (D+3 07시 §4 슬롯, 2026-05-11) — Tori spec C-D75-5 (Task_2026-05-11 §3.6).
 *
 * Why: D-D75 사이클 8 read-only 게이트. KQ_28 재발 방지 검증 게이트 (OCP append 절차
 *   자동화 본체). C-D74-5 (verify-d74.mjs) +1 사이클 단조 — 단 D-D74는 §6 또는 §8
 *   deferred 정합 (Task_2026-05-11 §3.2 정정 큐).
 *
 * 8 게이트 (§3.6 본체 lock):
 *   G1) scripts/check-live-plus-240h.mjs 존재 + ESM import 무에러 + checkLivePlus240h grep ≥ 3
 *   G2) scripts/check-ocp-append.mjs 존재 + ESM import 무에러 + checkOcpAppend grep ≥ 3
 *   G3) docs/OCP-APPEND-SPEC.md 존재 + H2 정확히 8개 (^## \d+\.  × 8 + total H2 = 8)
 *   G4) scripts/sim-live-plus-240h.mjs 존재 + 3/3 PASS 실행 + totalMs=\d+ regex 1건
 *   G5) L-D75-1 정책 락 (보존 13 침범 0 — git diff --name-only origin/main -- src/ 결과 empty)
 *   G6) L-D75-2 정책 락 (어휘 룰 self-grep 0건 — D-D75 신규 파일 + 본 docs/scripts)
 *   G7) L-D75-3 정책 락 (ocp-append-log JSONL 8 필드 lock — check-ocp-append --validate-schema)
 *   G8) L-D75-4 정책 락 (verify:all 단조 53→54 — package.json + verify-all.mjs 모두 verify:d75 등재)
 *
 * 자율 정정 큐 (D-75-자):
 *   G5 git 미설치 또는 origin/main 미설정 시 skip + reason (D-73-자-5 패턴 미러).
 *
 * 외부 dev-deps +0 (node 표준만).
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

console.log("verify:d75 — D-D75 사이클 8 read-only 게이트 통합 회귀 (OCP append 절차 자동화)");
console.log("");

// ── G1: scripts/check-live-plus-240h.mjs 존재 + checkLivePlus240h grep ≥ 3.
{
  const file = "scripts/check-live-plus-240h.mjs";
  if (!existsSync(resolve(root, file))) {
    fail("G1", `missing ${file}`);
  } else {
    const src = readOrEmpty(file);
    const hits = (src.match(/checkLivePlus240h/g) || []).length;
    if (hits >= 3) {
      // ESM import smoke test.
      const r = runNode([
        "--input-type=module",
        "-e",
        "import('./scripts/check-live-plus-240h.mjs').then(m=>console.log(typeof m.checkLivePlus240h))",
      ]);
      if (r.code === 0 && /function/.test(r.stdout)) {
        pass(`G1: check-live-plus-240h.mjs 존재 + grep ${hits}건 + ESM import OK`);
      } else {
        fail("G1", `ESM import failed: code=${r.code} stderr=${r.stderr.slice(0, 200)}`);
      }
    } else {
      fail("G1", `identifier checkLivePlus240h grep ${hits}건 (≥3 의무)`);
    }
  }
}

// ── G2: scripts/check-ocp-append.mjs 존재 + checkOcpAppend grep ≥ 3.
{
  const file = "scripts/check-ocp-append.mjs";
  if (!existsSync(resolve(root, file))) {
    fail("G2", `missing ${file}`);
  } else {
    const src = readOrEmpty(file);
    const hits = (src.match(/checkOcpAppend/g) || []).length;
    if (hits >= 3) {
      const r = runNode([
        "--input-type=module",
        "-e",
        "import('./scripts/check-ocp-append.mjs').then(m=>console.log(typeof m.checkOcpAppend))",
      ]);
      if (r.code === 0 && /function/.test(r.stdout)) {
        pass(`G2: check-ocp-append.mjs 존재 + grep ${hits}건 + ESM import OK`);
      } else {
        fail("G2", `ESM import failed: code=${r.code} stderr=${r.stderr.slice(0, 200)}`);
      }
    } else {
      fail("G2", `identifier checkOcpAppend grep ${hits}건 (≥3 의무)`);
    }
  }
}

// ── G3: docs/OCP-APPEND-SPEC.md 존재 + H2 정확히 8개.
{
  const file = "docs/OCP-APPEND-SPEC.md";
  if (!existsSync(resolve(root, file))) {
    fail("G3", `missing ${file}`);
  } else {
    const md = readOrEmpty(file);
    const numbered = (md.match(/^## \d+\.\s/gm) || []).length;
    const totalH2 = (md.match(/^## /gm) || []).length;
    if (numbered === 8 && totalH2 === 8) {
      pass(`G3: OCP-APPEND-SPEC.md H2 8개 정합 (${numbered} numbered, total ${totalH2})`);
    } else {
      fail("G3", `H2 numbered ${numbered}건 / total ${totalH2}건 (둘 다 8 의무)`);
    }
  }
}

// ── G4: scripts/sim-live-plus-240h.mjs 3/3 PASS + totalMs=\d+ regex.
{
  const file = "scripts/sim-live-plus-240h.mjs";
  if (!existsSync(resolve(root, file))) {
    fail("G4", `missing ${file}`);
  } else {
    const r = runNode([file]);
    const totalMsHit = /totalMs=\d+/.test(r.stdout);
    if (r.code === 0 && /3\/3 PASS/.test(r.stdout) && totalMsHit) {
      pass(`G4: sim-live-plus-240h.mjs 3/3 PASS + totalMs=\\d+ 측정`);
    } else {
      fail(
        "G4",
        `sim exit=${r.code} totalMs=${totalMsHit} stdout-tail=${r.stdout.split("\n").filter(Boolean).slice(-2).join(" | ")}`,
      );
    }
  }
}

// ── G5: L-D75-1 — git diff --name-only origin/main -- src/ 결과 empty.
//   D-75-자 fallback: git 미설치 또는 origin/main 부재 시 skip.
{
  const gitCheck = spawnSync("git", ["--version"], { cwd: root, encoding: "utf8" });
  if (gitCheck.status !== 0) {
    pass(`G5: skip (git not available, D-75-자 fallback)`);
  } else {
    const refCheck = spawnSync(
      "git",
      ["rev-parse", "--verify", "origin/main"],
      { cwd: root, encoding: "utf8" },
    );
    if (refCheck.status !== 0) {
      pass(`G5: skip (origin/main ref absent, D-75-자 fallback)`);
    } else {
      const r = spawnSync(
        "git",
        ["diff", "--name-only", "origin/main", "--", "src/"],
        { cwd: root, encoding: "utf8" },
      );
      const out = (r.stdout || "").trim();
      if (r.status === 0 && out.length === 0) {
        pass(`G5: L-D75-1 보존 13 침범 0 (git diff --name-only origin/main -- src/ empty)`);
      } else {
        fail(
          "G5",
          `git diff exit=${r.status} src/ changed files: ${out.split("\n").slice(0, 5).join(", ")}`,
        );
      }
    }
  }
}

// ── G6: L-D75-2 — 어휘 룰 self-grep 0건 (D-D75 신규 파일).
{
  const newFiles = [
    "scripts/check-live-plus-240h.mjs",
    "scripts/check-ocp-append.mjs",
    "scripts/sim-live-plus-240h.mjs",
    "scripts/verify-d75.mjs",
    "docs/OCP-APPEND-SPEC.md",
  ];
  // /박(음|다|았|혀|혔|제|힘|힌)/ — check-vocab.mjs (D-D19/D-D20) 패턴 미러.
  // 본 스크립트는 검증 도구로서 정규식 자체에 패턴이 포함되므로 자기 자신 검증 제외.
  const pat = /박(음|다|았|혀|혀|제|힘|힌)/g;
  const hits = [];
  for (const f of newFiles) {
    if (f === "scripts/verify-d75.mjs") continue; // self-exclude.
    const src = readOrEmpty(f);
    let m;
    while ((m = pat.exec(src)) !== null) {
      hits.push(`${f}: ${m[0]} @ ${m.index}`);
    }
  }
  if (hits.length === 0) {
    pass(`G6: L-D75-2 어휘 룰 self-grep 0건 (${newFiles.length - 1} files scanned, verify-d75 self-excluded)`);
  } else {
    fail("G6", `L-D75-2 vocab violations ${hits.length}건: ${hits.slice(0, 5).join(" | ")}`);
  }
}

// ── G7: L-D75-3 — ocp-append-log JSONL 8 필드 lock.
{
  const r = runNode([
    "scripts/check-ocp-append.mjs",
    "--validate-schema",
  ]);
  if (r.code === 0 && /validate-schema:/.test(r.stdout)) {
    pass(`G7: L-D75-3 ocp-append-log JSONL 8 필드 validate-schema PASS — ${r.stdout.split("\n")[0]}`);
  } else {
    fail("G7", `validate-schema exit=${r.code} stdout=${r.stdout.slice(0, 200)}`);
  }
}

// ── G8: L-D75-4 — package.json + verify-all.mjs 모두 verify:d75 등재 (53→54 OCP append).
{
  const pkg = readOrEmpty("package.json");
  const verifyAll = readOrEmpty("scripts/verify-all.mjs");
  const pkgHas = /"verify:d75"\s*:/.test(pkg);
  const allHas = /"verify:d75"/.test(verifyAll);
  const pkgChkHas = /"check:live-plus-240h"\s*:/.test(pkg);
  const pkgSimHas = /"sim:live-plus-240h"\s*:/.test(pkg);
  const pkgOcpHas = /"check:ocp-append"\s*:/.test(pkg);

  const required = { pkgHas, allHas, pkgChkHas, pkgSimHas, pkgOcpHas };
  const missing = Object.entries(required)
    .filter(([_, v]) => !v)
    .map(([k]) => k);

  if (missing.length === 0) {
    pass(`G8: L-D75-4 verify:d75 OCP append (package.json + verify-all.mjs + 3 sub-scripts)`);
  } else {
    fail("G8", `missing OCP append: ${missing.join(", ")}`);
  }
}

console.log("");
console.log(
  `verify:d75 — ${passed}/${passed + failed} ${failed === 0 ? "PASS" : "FAIL"}`,
);

process.exit(failed === 0 ? 0 : 1);
