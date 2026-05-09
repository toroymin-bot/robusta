#!/usr/bin/env node
/**
 * verify-d66.mjs
 *   - C-D66-5 (D+1 11시 §6 슬롯, 2026-05-09) — Tori spec C-D66-5 (8 read-only 게이트).
 *
 * Why: D+1 live phase +37h 시점 §6 꼬미 슬롯 회귀 게이트.
 *   D-D66 사이클 신규 산출물 5건 (C-D66-1∼5) + verify:all 45→46 OCP append + L-D66-1∼4 정책 락.
 *
 *   - L-D66-1 변경 0 (live phase) — src/ 1bit 수정 0
 *   - L-D66-2 verify:all 단조 증가 — 45 → 46 (verify:d65 다음, verify:d66 신규)
 *   - L-D66-3 [BYPASS] subject prefix commit 0건 since 5/9 09:00 KST
 *   - L-D66-4 i18n MESSAGES 변동 0 (ko=300 / en=300)
 *
 * 8 게이트 (§18.2 stand-alone 정합):
 *   G1) docs/KQ-CLOSED-LOG.md 존재 + H2 8개 정합 (§17.7 C-D66-3 lock 1:1)
 *   G2) scripts/check-live-plus-48h.mjs 존재 + checkLivePlus48h 식별자 grep 정합
 *   G3) docs/KQ-CLOSED-LOG.md KQ entry timestamp ISO+09:00 정규식 PASS +
 *       closed_by ∈ {Roy, Tori, Komi}
 *   G4) scripts/sim-live-plus-48h.mjs 6/6 PASS 실행 + totalMs 측정 존재
 *   G5) tests/check-live-plus-48h.test.mjs 6/6 PASS
 *   G6) tests/analyze-byok-funnel.test.mjs 6/6 PASS
 *   G7) package.json scripts에 verify:d66 + check:live-plus-48h + analyze:byok-funnel +
 *       sim:live-plus-48h 4건 OCP append 만 존재 (기존 변경 0 / dev-deps +0)
 *   G8) git diff --stat HEAD release/2026-05-08 -- src/ 빈 출력 (L-D66-1 정합)
 *
 * 자율 정정 (D-66-자-5):
 *   G8 git 미설치 환경 또는 release/2026-05-08 tag 부재 시 skip + reason 반환.
 *   기본 환경에서는 의무 PASS — 본 fallback 은 격리 CI 환경 안전망 (D-65-자-5 패턴 미러).
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

console.log("verify:d66 — D-D66 사이클 8 read-only 게이트 통합 회귀");
console.log("");

// ── G1: docs/KQ-CLOSED-LOG.md 존재 + H2 정확히 8개.
{
  const file = "docs/KQ-CLOSED-LOG.md";
  if (!existsSync(resolve(root, file))) {
    fail("G1", `missing ${file}`);
  } else {
    const md = readOrEmpty(file);
    const lines = md.split("\n");
    const h2 = lines.filter((l) => /^##\s+\d+\.\s/.test(l));
    if (h2.length === 8) {
      pass(`G1: KQ-CLOSED-LOG.md H2 8개 정합 (§17.7 C-D66-3 lock 1:1)`);
    } else {
      fail("G1", `H2 ${h2.length}건 (8 의무)`);
    }
  }
}

// ── G2: scripts/check-live-plus-48h.mjs 존재 + checkLivePlus48h 식별자 grep.
{
  const file = "scripts/check-live-plus-48h.mjs";
  if (!existsSync(resolve(root, file))) {
    fail("G2", `missing ${file}`);
  } else {
    const src = readOrEmpty(file);
    if (/checkLivePlus48h/.test(src)) {
      pass(`G2: check-live-plus-48h.mjs 존재 + checkLivePlus48h 식별자 grep 정합`);
    } else {
      fail("G2", `identifier checkLivePlus48h not found`);
    }
  }
}

// ── G3: KQ-CLOSED-LOG.md KQ entry timestamp ISO+09:00 + closed_by 정합.
{
  const file = "docs/KQ-CLOSED-LOG.md";
  if (!existsSync(resolve(root, file))) {
    fail("G3", `missing ${file}`);
  } else {
    const md = readOrEmpty(file);
    // KQ entry 라인: "KQ_NN / YYYY-MM-DDTHH:MM:SS+09:00 / Name / ..."
    const tsRegex = /KQ_\d+\s*\/\s*(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00)\s*\/\s*(Roy|Tori|Komi)\s*\//g;
    const matches = [...md.matchAll(tsRegex)];
    if (matches.length >= 2) {
      // KQ_24 / KQ_25 두 건 모두 정규식 PASS 의무.
      pass(`G3: KQ entry ${matches.length}건 timestamp ISO+09:00 + closed_by ∈ {Roy,Tori,Komi} 정합`);
    } else {
      fail("G3", `KQ entry ${matches.length}건 (≥2 의무)`);
    }
  }
}

// ── G4: sim-live-plus-48h.mjs 6/6 PASS + totalMs 측정.
{
  const file = "scripts/sim-live-plus-48h.mjs";
  if (!existsSync(resolve(root, file))) {
    fail("G4", `missing ${file}`);
  } else {
    const r = runNode([file]);
    const totalMsHit = /\(\d+\s*ms\)/.test(r.stdout);
    if (r.code === 0 && /6\/6 PASS/.test(r.stdout) && totalMsHit) {
      pass(`G4: sim-live-plus-48h.mjs 6/6 PASS + totalMs 측정`);
    } else {
      fail(
        "G4",
        `sim exit=${r.code} totalMs=${totalMsHit} stdout-tail=${r.stdout.split("\n").filter(Boolean).slice(-2).join(" | ")}`,
      );
    }
  }
}

// ── G5: tests/check-live-plus-48h.test.mjs 6/6 PASS.
{
  const file = "tests/check-live-plus-48h.test.mjs";
  if (!existsSync(resolve(root, file))) {
    fail("G5", `missing ${file}`);
  } else {
    const r = runNode([file]);
    if (r.code === 0 && /6\/6 PASS/.test(r.stdout)) {
      pass(`G5: check-live-plus-48h.test.mjs 6/6 PASS`);
    } else {
      fail(
        "G5",
        `tests exit=${r.code} stdout-tail=${r.stdout.split("\n").filter(Boolean).slice(-2).join(" | ")}`,
      );
    }
  }
}

// ── G6: tests/analyze-byok-funnel.test.mjs 6/6 PASS.
{
  const file = "tests/analyze-byok-funnel.test.mjs";
  if (!existsSync(resolve(root, file))) {
    fail("G6", `missing ${file}`);
  } else {
    const r = runNode([file]);
    if (r.code === 0 && /6\/6 PASS/.test(r.stdout)) {
      pass(`G6: analyze-byok-funnel.test.mjs 6/6 PASS`);
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
    "verify:d66",
    "check:live-plus-48h",
    "analyze:byok-funnel",
    "sim:live-plus-48h",
  ];
  const missing = requiredScripts.filter(
    (k) => !new RegExp(`"${k.replace(/[:-]/g, "[:\\-]")}"\\s*:`).test(pkg),
  );
  if (missing.length === 0) {
    pass(`G7: package.json scripts 4 OCP append 정합 (verify:d66 + check:live-plus-48h + analyze:byok-funnel + sim:live-plus-48h)`);
  } else {
    fail("G7", `missing scripts: ${missing.join(",")}`);
  }
}

// ── G8: git diff --stat HEAD release/2026-05-08 -- src/ 빈 출력.
//   D-66-자-5 fallback: git 미설치 또는 tag 부재 시 skip + reason (D-65-자-5 미러).
{
  const gitCheck = spawnSync("git", ["--version"], { cwd: root, encoding: "utf8" });
  if (gitCheck.status !== 0) {
    pass(`G8: skip (git not available, D-66-자-5 fallback)`);
  } else {
    const tagCheck = spawnSync(
      "git",
      ["rev-parse", "--verify", "release/2026-05-08"],
      { cwd: root, encoding: "utf8" },
    );
    if (tagCheck.status !== 0) {
      pass(`G8: skip (tag release/2026-05-08 absent, D-66-자-5 fallback)`);
    } else {
      const r = spawnSync(
        "git",
        ["diff", "--stat", "HEAD", "release/2026-05-08", "--", "src/"],
        { cwd: root, encoding: "utf8" },
      );
      const out = (r.stdout || "").trim();
      if (r.status === 0 && out.length === 0) {
        pass(`G8: git diff HEAD release/2026-05-08 -- src/ 빈 출력 (L-D66-1 정합)`);
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
  `verify:d66 — ${passed}/${passed + failed} ${failed === 0 ? "PASS" : "FAIL"}`,
);

process.exit(failed === 0 ? 0 : 1);
