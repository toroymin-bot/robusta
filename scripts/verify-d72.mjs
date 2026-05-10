#!/usr/bin/env node
/**
 * verify-d72.mjs
 *   - C-D72-5 ⭐ (D+2 19시 §8 슬롯, 2026-05-10) — Tori spec C-D72-5 (§7.5 / 8 read-only 게이트).
 *
 * Why: D+2 §8 꼬미 슬롯 회귀 게이트 (D+2 라이브 운영 정합).
 *   D-D72 사이클 신규 산출물 5건 (C-D72-1∼5) + tests 2건 + verify:all 51→52 OCP append +
 *   L-D72-1∼4 정책 락.
 *
 *   - L-D72-1 변경 0 (live phase) — src/ 1bit 수정 0
 *   - L-D72-2 verify:all 단조 증가 — 51 → 52 (verify:d71 다음, verify:d72 신규)
 *   - L-D72-3 [BYPASS] subject prefix commit 0건 since 5/10 00:00 KST
 *   - L-D72-4 i18n MESSAGES 변동 0 (messages.ts git diff 빈 출력)
 *
 * 8 게이트 (§7.5 stand-alone 정합):
 *   G1) docs/INSIGHT-AUTO-TRIGGER-SPEC.md 존재 + H2 정확히 8개 정합
 *       (정규식 ^## \d+\.  × 8 + total H2 = 8)
 *   G2) scripts/check-live-plus-168h.mjs 존재 + checkLivePlus168h 식별자 grep ≥ 3건
 *   G3) docs/KQ-CLOSED-LOG.md H2 카운트 단조 비감소 (≥ 8) — D-D67∼D-D71 패턴 미러
 *       D-69-자-A backward-compat 보정 정합 + KQ_27 등재 정합.
 *   G4) scripts/sim-live-plus-168h.mjs 6/6 PASS 실행 + totalMs=\d+ regex 1건
 *   G5) tests/check-live-plus-168h.test.mjs 6/6 PASS
 *   G6) tests/extract-insight-trigger-state.test.mjs 6/6 PASS
 *   G7) package.json scripts에 4 신규 OCP append (verify:d72 + check:live-plus-168h +
 *       extract:insight-trigger-state + sim:live-plus-168h) — 기존 변경 0
 *   G8) git diff --stat HEAD release/2026-05-08 -- src/ 빈 출력 (L-D72-1 정합)
 *
 * 자율 정정 큐 (D-72-자-5):
 *   G8 git 미설치 환경 또는 release/2026-05-08 tag 부재 시 skip + reason 반환.
 *   기본 환경에서는 의무 PASS — 본 fallback 은 격리 CI 환경 안전망 (D-69-자-5 패턴 미러).
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

console.log("verify:d72 — D-D72 사이클 8 read-only 게이트 통합 회귀");
console.log("");

// ── G1: docs/INSIGHT-AUTO-TRIGGER-SPEC.md 존재 + H2 정확히 8개 정합.
{
  const file = "docs/INSIGHT-AUTO-TRIGGER-SPEC.md";
  if (!existsSync(resolve(root, file))) {
    fail("G1", `missing ${file}`);
  } else {
    const md = readOrEmpty(file);
    const matches = md.match(/^## \d+\.\s/gm) || [];
    const totalH2 = (md.match(/^## /gm) || []).length;
    if (matches.length === 8 && totalH2 === 8) {
      pass(`G1: INSIGHT-AUTO-TRIGGER-SPEC.md H2 8개 정합 (${matches.length}건 매칭, total=${totalH2})`);
    } else {
      fail("G1", `^## \\d+\\. pattern ${matches.length}건 / total H2 ${totalH2}건 (둘 다 8 의무)`);
    }
  }
}

// ── G2: scripts/check-live-plus-168h.mjs 존재 + checkLivePlus168h 식별자 grep ≥ 3건.
{
  const file = "scripts/check-live-plus-168h.mjs";
  if (!existsSync(resolve(root, file))) {
    fail("G2", `missing ${file}`);
  } else {
    const src = readOrEmpty(file);
    const hits = (src.match(/checkLivePlus168h/g) || []).length;
    if (hits >= 3) {
      pass(`G2: check-live-plus-168h.mjs 존재 + checkLivePlus168h 식별자 grep ${hits}건 (≥3)`);
    } else {
      fail("G2", `identifier checkLivePlus168h grep ${hits}건 (≥3 의무)`);
    }
  }
}

// ── G3: docs/KQ-CLOSED-LOG.md H2 카운트 단조 비감소 (≥ 8).
//   D-69-자-A backward-compat 보정 정합 + KQ_27 등재 정합.
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

// ── G4: scripts/sim-live-plus-168h.mjs 6/6 PASS + totalMs=\d+ regex 1건.
{
  const file = "scripts/sim-live-plus-168h.mjs";
  if (!existsSync(resolve(root, file))) {
    fail("G4", `missing ${file}`);
  } else {
    const r = runNode([file]);
    const totalMsHit = /totalMs=\d+/.test(r.stdout);
    if (r.code === 0 && /6\/6 PASS/.test(r.stdout) && totalMsHit) {
      pass(`G4: sim-live-plus-168h.mjs 6/6 PASS + totalMs=\\d+ 측정`);
    } else {
      fail(
        "G4",
        `sim exit=${r.code} totalMs=${totalMsHit} stdout-tail=${r.stdout.split("\n").filter(Boolean).slice(-2).join(" | ")}`,
      );
    }
  }
}

// ── G5: tests/check-live-plus-168h.test.mjs 6/6 PASS.
{
  const file = "tests/check-live-plus-168h.test.mjs";
  if (!existsSync(resolve(root, file))) {
    fail("G5", `missing ${file}`);
  } else {
    const r = runNode([file]);
    if (r.code === 0 && /6\/6 PASS/.test(r.stdout)) {
      pass(`G5: check-live-plus-168h.test.mjs 6/6 PASS`);
    } else {
      fail(
        "G5",
        `tests exit=${r.code} stdout-tail=${r.stdout.split("\n").filter(Boolean).slice(-2).join(" | ")}`,
      );
    }
  }
}

// ── G6: tests/extract-insight-trigger-state.test.mjs 6/6 PASS.
{
  const file = "tests/extract-insight-trigger-state.test.mjs";
  if (!existsSync(resolve(root, file))) {
    fail("G6", `missing ${file}`);
  } else {
    const r = runNode([file]);
    if (r.code === 0 && /6\/6 PASS/.test(r.stdout)) {
      pass(`G6: extract-insight-trigger-state.test.mjs 6/6 PASS`);
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
    "verify:d72",
    "check:live-plus-168h",
    "extract:insight-trigger-state",
    "sim:live-plus-168h",
  ];
  const missing = requiredScripts.filter(
    (k) => !new RegExp(`"${k.replace(/[:\-]/g, "[:\\-]")}"\\s*:`).test(pkg),
  );
  if (missing.length === 0) {
    pass(`G7: package.json scripts 4 OCP append 정합 (verify:d72 + check:live-plus-168h + extract:insight-trigger-state + sim:live-plus-168h)`);
  } else {
    fail("G7", `missing scripts: ${missing.join(",")}`);
  }
}

// ── G8: git diff --stat HEAD release/2026-05-08 -- src/ 빈 출력.
//   D-72-자-5 fallback: git 미설치 또는 tag 부재 시 skip + reason (D-69-자-5 미러).
{
  const gitCheck = spawnSync("git", ["--version"], { cwd: root, encoding: "utf8" });
  if (gitCheck.status !== 0) {
    pass(`G8: skip (git not available, D-72-자-5 fallback)`);
  } else {
    const tagCheck = spawnSync(
      "git",
      ["rev-parse", "--verify", "release/2026-05-08"],
      { cwd: root, encoding: "utf8" },
    );
    if (tagCheck.status !== 0) {
      pass(`G8: skip (tag release/2026-05-08 absent, D-72-자-5 fallback)`);
    } else {
      const r = spawnSync(
        "git",
        ["diff", "--stat", "HEAD", "release/2026-05-08", "--", "src/"],
        { cwd: root, encoding: "utf8" },
      );
      const out = (r.stdout || "").trim();
      if (r.status === 0 && out.length === 0) {
        pass(`G8: git diff HEAD release/2026-05-08 -- src/ 빈 출력 (L-D72-1 정합)`);
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
  `verify:d72 — ${passed}/${passed + failed} ${failed === 0 ? "PASS" : "FAIL"}`,
);

process.exit(failed === 0 ? 0 : 1);
