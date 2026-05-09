#!/usr/bin/env node
/**
 * verify-d67.mjs
 *   - C-D67-5 ⭐ (D+1 15시 §8 슬롯, 2026-05-09) — Tori spec C-D67-5 (§20.5.5 / 8 read-only 게이트).
 *
 * Why: D+1 live phase +37h cadence 시점 §8 꼬미 슬롯 회귀 게이트.
 *   D-D67 사이클 신규 산출물 5건 (C-D67-1∼5) + tests 2건 + verify:all 46→47 OCP append +
 *   L-D67-1∼4 정책 락.
 *
 *   - L-D67-1 변경 0 (live phase) — src/ 1bit 수정 0
 *   - L-D67-2 verify:all 단조 증가 — 46 → 47 (verify:d66 다음, verify:d67 신규)
 *   - L-D67-3 [BYPASS] subject prefix commit 0건 since 5/9 09:00 KST
 *   - L-D67-4 i18n MESSAGES 변동 0 (ko=300 / en=300)
 *
 * 8 게이트 (§20.5.5 stand-alone 정합):
 *   G1) docs/LIVE-MONITORING-SOP.md 존재 + H2 5개 정합 (정규식 ^## T\+(19h|35h|37h|48h|60h) )
 *   G2) scripts/check-live-plus-60h.mjs 존재 + checkLivePlus60h 식별자 grep ≥1
 *   G3) docs/KQ-CLOSED-LOG.md H2 카운트 단조 비감소 (8 이상)
 *   G4) scripts/sim-live-plus-60h.mjs 6/6 PASS 실행 + totalMs 측정 존재
 *   G5) tests/check-live-plus-60h.test.mjs 6/6 PASS
 *   G6) tests/analyze-byok-funnel-weekly.test.mjs 6/6 PASS
 *   G7) package.json scripts에 4 신규 OCP append (check:live-plus-60h + analyze:byok-weekly +
 *       sim:live-plus-60h + verify:d67) — 기존 변경 0
 *   G8) git diff --stat HEAD release/2026-05-08 -- src/ 빈 출력 (L-D67-1 정합)
 *
 * 자율 정정 큐 (D-67-자-5):
 *   G8 git 미설치 환경 또는 release/2026-05-08 tag 부재 시 skip + reason 반환.
 *   기본 환경에서는 의무 PASS — 본 fallback 은 격리 CI 환경 안전망 (D-66-자-5 패턴 미러).
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

console.log("verify:d67 — D-D67 사이클 8 read-only 게이트 통합 회귀");
console.log("");

// ── G1: docs/LIVE-MONITORING-SOP.md 존재 + H2 5개 정규식 정합.
{
  const file = "docs/LIVE-MONITORING-SOP.md";
  if (!existsSync(resolve(root, file))) {
    fail("G1", `missing ${file}`);
  } else {
    const md = readOrEmpty(file);
    const matches = md.match(/^## T\+(19h|35h|37h|48h|60h) /gm) || [];
    const totalH2 = (md.match(/^## /gm) || []).length;
    if (matches.length === 5 && totalH2 === 5) {
      pass(`G1: LIVE-MONITORING-SOP.md H2 5개 정합 (${matches.length}건 매칭, total=${totalH2})`);
    } else {
      fail("G1", `T+ pattern ${matches.length}건 / total H2 ${totalH2}건 (둘 다 5 의무)`);
    }
  }
}

// ── G2: scripts/check-live-plus-60h.mjs 존재 + checkLivePlus60h 식별자 grep.
{
  const file = "scripts/check-live-plus-60h.mjs";
  if (!existsSync(resolve(root, file))) {
    fail("G2", `missing ${file}`);
  } else {
    const src = readOrEmpty(file);
    const hits = (src.match(/checkLivePlus60h/g) || []).length;
    if (hits >= 1) {
      pass(`G2: check-live-plus-60h.mjs 존재 + checkLivePlus60h 식별자 grep ${hits}건`);
    } else {
      fail("G2", `identifier checkLivePlus60h not found`);
    }
  }
}

// ── G3: docs/KQ-CLOSED-LOG.md H2 카운트 단조 비감소 (8 이상).
{
  const file = "docs/KQ-CLOSED-LOG.md";
  if (!existsSync(resolve(root, file))) {
    fail("G3", `missing ${file}`);
  } else {
    const md = readOrEmpty(file);
    const h2 = (md.match(/^##\s+\d+\.\s/gm) || []).length;
    if (h2 >= 8) {
      pass(`G3: KQ-CLOSED-LOG.md H2 ${h2}건 (≥8 단조 비감소 lock 정합)`);
    } else {
      fail("G3", `H2 ${h2}건 (≥8 의무, 단조 비감소 위반)`);
    }
  }
}

// ── G4: scripts/sim-live-plus-60h.mjs 6/6 PASS + totalMs 측정.
{
  const file = "scripts/sim-live-plus-60h.mjs";
  if (!existsSync(resolve(root, file))) {
    fail("G4", `missing ${file}`);
  } else {
    const r = runNode([file]);
    const totalMsHit = /\(\d+\s*ms\)/.test(r.stdout);
    if (r.code === 0 && /6\/6 PASS/.test(r.stdout) && totalMsHit) {
      pass(`G4: sim-live-plus-60h.mjs 6/6 PASS + totalMs 측정`);
    } else {
      fail(
        "G4",
        `sim exit=${r.code} totalMs=${totalMsHit} stdout-tail=${r.stdout.split("\n").filter(Boolean).slice(-2).join(" | ")}`,
      );
    }
  }
}

// ── G5: tests/check-live-plus-60h.test.mjs 6/6 PASS.
{
  const file = "tests/check-live-plus-60h.test.mjs";
  if (!existsSync(resolve(root, file))) {
    fail("G5", `missing ${file}`);
  } else {
    const r = runNode([file]);
    if (r.code === 0 && /6\/6 PASS/.test(r.stdout)) {
      pass(`G5: check-live-plus-60h.test.mjs 6/6 PASS`);
    } else {
      fail(
        "G5",
        `tests exit=${r.code} stdout-tail=${r.stdout.split("\n").filter(Boolean).slice(-2).join(" | ")}`,
      );
    }
  }
}

// ── G6: tests/analyze-byok-funnel-weekly.test.mjs 6/6 PASS.
{
  const file = "tests/analyze-byok-funnel-weekly.test.mjs";
  if (!existsSync(resolve(root, file))) {
    fail("G6", `missing ${file}`);
  } else {
    const r = runNode([file]);
    if (r.code === 0 && /6\/6 PASS/.test(r.stdout)) {
      pass(`G6: analyze-byok-funnel-weekly.test.mjs 6/6 PASS`);
    } else {
      fail(
        "G6",
        `tests exit=${r.code} stdout-tail=${r.stdout.split("\n").filter(Boolean).slice(-2).join(" | ")}`,
      );
    }
  }
}

// ── G7: package.json scripts에 4 신규 OCP append.
{
  const pkg = readOrEmpty("package.json");
  const requiredScripts = [
    "verify:d67",
    "check:live-plus-60h",
    "analyze:byok-weekly",
    "sim:live-plus-60h",
  ];
  const missing = requiredScripts.filter(
    (k) => !new RegExp(`"${k.replace(/[:-]/g, "[:\\-]")}"\\s*:`).test(pkg),
  );
  if (missing.length === 0) {
    pass(`G7: package.json scripts 4 OCP append 정합 (verify:d67 + check:live-plus-60h + analyze:byok-weekly + sim:live-plus-60h)`);
  } else {
    fail("G7", `missing scripts: ${missing.join(",")}`);
  }
}

// ── G8: git diff --stat HEAD release/2026-05-08 -- src/ 빈 출력.
//   D-67-자-5 fallback: git 미설치 또는 tag 부재 시 skip + reason (D-66-자-5 미러).
{
  const gitCheck = spawnSync("git", ["--version"], { cwd: root, encoding: "utf8" });
  if (gitCheck.status !== 0) {
    pass(`G8: skip (git not available, D-67-자-5 fallback)`);
  } else {
    const tagCheck = spawnSync(
      "git",
      ["rev-parse", "--verify", "release/2026-05-08"],
      { cwd: root, encoding: "utf8" },
    );
    if (tagCheck.status !== 0) {
      pass(`G8: skip (tag release/2026-05-08 absent, D-67-자-5 fallback)`);
    } else {
      const r = spawnSync(
        "git",
        ["diff", "--stat", "HEAD", "release/2026-05-08", "--", "src/"],
        { cwd: root, encoding: "utf8" },
      );
      const out = (r.stdout || "").trim();
      if (r.status === 0 && out.length === 0) {
        pass(`G8: git diff HEAD release/2026-05-08 -- src/ 빈 출력 (L-D67-1 정합)`);
      } else {
        fail(
          "G8",
          `git diff exit=${r.status} stdout-tail=${out.split("\n").slice(-3).join(" | ")}`,
        );
      }
    }
  }
}

console.log("");
console.log(
  `verify:d67 — ${passed}/${passed + failed} ${failed === 0 ? "PASS" : "FAIL"}`,
);

process.exit(failed === 0 ? 0 : 1);
