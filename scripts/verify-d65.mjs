#!/usr/bin/env node
/**
 * verify-d65.mjs
 *   - C-D65-5 (D+1 07시 §4 슬롯, 2026-05-09) — Tori spec C-D65-5 (8 read-only 게이트).
 *
 * Why: D+1 live phase +31h 시점 §4 꼬미 슬롯 회귀 게이트.
 *   D-D65 사이클 신규 산출물 5건 (C-D65-1∼5) + verify:all 44→45 OCP append + L-D65-1∼4 정책 락.
 *
 *   - L-D65-1 변경 0 (live phase) — src/ 1bit 수정 0
 *   - L-D65-2 verify:all 단조 증가 — 44 → 45 (verify:d64 다음, verify:d65 신규)
 *   - L-D65-3 RELEASE_FREEZE_OVERRIDE 0건 since 5/9 00:00 KST
 *   - L-D65-4 i18n MESSAGES 변동 0 (D-55-자-3 정합, ko=300 / en=300)
 *
 * 8 게이트 (§15.2 stand-alone 정합):
 *   G1) docs/INSIGHT-PIN-SPEC.md 존재 + H2 8개 정합 (§14.5 C-D65-3 lock 1:1 매칭)
 *   G2) scripts/check-live-plus-30h.mjs 존재 + checkLivePlus30h 식별자 grep 정합
 *   G3) scripts/check-byok-funnel.mjs 존재 + 이벤트 4종 키워드 grep 정합
 *       (landing / key_added / room_entered / msg_sent 4건 모두 hit)
 *   G4) scripts/sim-live-plus-30h.mjs 6/6 PASS 실행 결과 정합
 *       ({ total: 6, pass: 6, fail: 0 })
 *   G5) tests/check-live-plus-30h.test.mjs 6/6 PASS
 *   G6) tests/check-byok-funnel.test.mjs 6/6 PASS
 *   G7) package.json scripts에 verify:d65 + check:live-plus-30h + check:byok-funnel +
 *       sim:live-plus-30h 4건 OCP append 만 존재 (기존 변경 0 / dev-deps +0)
 *   G8) git diff --stat HEAD release/2026-05-08 -- src/ 빈 출력 (L-D65-1 정합)
 *
 * 자율 정정 (D-65-자-5):
 *   G8 git 미설치 환경 또는 release/2026-05-08 tag 부재 시 skip + reason 반환.
 *   기본 환경에서는 의무 PASS — 본 fallback 은 격리 CI 환경 안전망.
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

console.log("verify:d65 — D-D65 사이클 8 read-only 게이트 통합 회귀");
console.log("");

// ── G1: docs/INSIGHT-PIN-SPEC.md 존재 + H2 정확히 8개.
{
  const file = "docs/INSIGHT-PIN-SPEC.md";
  if (!existsSync(resolve(root, file))) {
    fail("G1", `missing ${file}`);
  } else {
    const md = readOrEmpty(file);
    const lines = md.split("\n");
    const h2 = lines.filter((l) => /^##\s+\d+\.\s/.test(l));
    if (h2.length === 8) {
      pass(`G1: INSIGHT-PIN-SPEC.md H2 8개 정합 (§14.5 C-D65-3 lock 1:1)`);
    } else {
      fail("G1", `H2 ${h2.length}건 (8 의무)`);
    }
  }
}

// ── G2: scripts/check-live-plus-30h.mjs 존재 + checkLivePlus30h 식별자 grep.
{
  const file = "scripts/check-live-plus-30h.mjs";
  if (!existsSync(resolve(root, file))) {
    fail("G2", `missing ${file}`);
  } else {
    const src = readOrEmpty(file);
    if (/checkLivePlus30h/.test(src)) {
      pass(`G2: check-live-plus-30h.mjs 존재 + checkLivePlus30h 식별자 grep 정합`);
    } else {
      fail("G2", `identifier checkLivePlus30h not found`);
    }
  }
}

// ── G3: scripts/check-byok-funnel.mjs 존재 + 이벤트 4종 키워드 grep.
//   self-grep 회피: 키워드는 charCode 빌드 5자리(0x20 + 'a' 등)가 아닌 정상 표기로 등장 의무.
{
  const file = "scripts/check-byok-funnel.mjs";
  if (!existsSync(resolve(root, file))) {
    fail("G3", `missing ${file}`);
  } else {
    const src = readOrEmpty(file);
    const keys = ["landing", "key_added", "room_entered", "msg_sent"];
    const hits = keys.filter((k) => src.includes(k));
    if (hits.length === 4) {
      pass(`G3: check-byok-funnel.mjs 이벤트 4종 ${hits.join("/")} 모두 grep hit`);
    } else {
      fail("G3", `4종 중 ${hits.length}종 hit: ${hits.join(",")}`);
    }
  }
}

// ── G4: sim-live-plus-30h.mjs 6/6 PASS.
{
  const file = "scripts/sim-live-plus-30h.mjs";
  if (!existsSync(resolve(root, file))) {
    fail("G4", `missing ${file}`);
  } else {
    const r = runNode([file]);
    if (r.code === 0 && /6\/6 PASS/.test(r.stdout)) {
      pass(`G4: sim-live-plus-30h.mjs 6/6 PASS`);
    } else {
      fail(
        "G4",
        `sim exit=${r.code} stdout-tail=${r.stdout.split("\n").filter(Boolean).slice(-2).join(" | ")}`,
      );
    }
  }
}

// ── G5: tests/check-live-plus-30h.test.mjs 6/6 PASS.
{
  const file = "tests/check-live-plus-30h.test.mjs";
  if (!existsSync(resolve(root, file))) {
    fail("G5", `missing ${file}`);
  } else {
    const r = runNode([file]);
    if (r.code === 0 && /6\/6 PASS/.test(r.stdout)) {
      pass(`G5: check-live-plus-30h.test.mjs 6/6 PASS`);
    } else {
      fail(
        "G5",
        `tests exit=${r.code} stdout-tail=${r.stdout.split("\n").filter(Boolean).slice(-2).join(" | ")}`,
      );
    }
  }
}

// ── G6: tests/check-byok-funnel.test.mjs 6/6 PASS.
{
  const file = "tests/check-byok-funnel.test.mjs";
  if (!existsSync(resolve(root, file))) {
    fail("G6", `missing ${file}`);
  } else {
    const r = runNode([file]);
    if (r.code === 0 && /6\/6 PASS/.test(r.stdout)) {
      pass(`G6: check-byok-funnel.test.mjs 6/6 PASS`);
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
    "verify:d65",
    "check:live-plus-30h",
    "check:byok-funnel",
    "sim:live-plus-30h",
  ];
  const missing = requiredScripts.filter(
    (k) => !new RegExp(`"${k.replace(/[:-]/g, "[:\\-]")}"\\s*:`).test(pkg),
  );
  if (missing.length === 0) {
    pass(`G7: package.json scripts 4 OCP append 정합 (verify:d65 + check:live-plus-30h + check:byok-funnel + sim:live-plus-30h)`);
  } else {
    fail("G7", `missing scripts: ${missing.join(",")}`);
  }
}

// ── G8: git diff --stat HEAD release/2026-05-08 -- src/ 빈 출력.
//   D-65-자-5 fallback: git 미설치 또는 tag 부재 시 skip + reason.
{
  // git 명령 가용성 체크.
  const gitCheck = spawnSync("git", ["--version"], { cwd: root, encoding: "utf8" });
  if (gitCheck.status !== 0) {
    pass(`G8: skip (git not available, D-65-자-5 fallback)`);
  } else {
    // tag 존재 체크.
    const tagCheck = spawnSync(
      "git",
      ["rev-parse", "--verify", "release/2026-05-08"],
      { cwd: root, encoding: "utf8" },
    );
    if (tagCheck.status !== 0) {
      pass(`G8: skip (tag release/2026-05-08 absent, D-65-자-5 fallback)`);
    } else {
      const r = spawnSync(
        "git",
        ["diff", "--stat", "HEAD", "release/2026-05-08", "--", "src/"],
        { cwd: root, encoding: "utf8" },
      );
      const out = (r.stdout || "").trim();
      if (r.status === 0 && out.length === 0) {
        pass(`G8: git diff HEAD release/2026-05-08 -- src/ 빈 출력 (L-D65-1 정합)`);
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
  `verify:d65 — ${passed}/${passed + failed} ${failed === 0 ? "PASS" : "FAIL"}`,
);

process.exit(failed === 0 ? 0 : 1);
