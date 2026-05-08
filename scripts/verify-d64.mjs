#!/usr/bin/env node
/**
 * verify-d64.mjs
 *   - C-D64-5 (D+1 03시 §2 슬롯, 2026-05-09) — Tori spec C-D64-5 (8 read-only 게이트).
 *
 * Why: D+1 live phase +27h 시점 §2 꼬미 슬롯 회귀 게이트.
 *   D-D64 사이클 신규 산출물 5건 (C-D64-1∼5) + verify:all 42→43 OCP append + L-D64-1∼4 정책 락.
 *
 *   - L-D64-1 변경 0 (live phase +27h) — src/ 1bit 수정 0
 *   - L-D64-2 verify:all 단조 증가 — 43 → 44 (verify:d63 다음, verify:d64 신규)
 *   - L-D64-3 RELEASE_FREEZE_OVERRIDE 0건 (D+1 24h)
 *   - L-D64-4 i18n MESSAGES 변동 0 (D-55-자-3 정합, ko=300 / en=300)
 *
 * 8 게이트 (read-only / no-write):
 *   G1) check-d-plus-1-handoff.mjs 파일 존재 + tests 6/6 PASS (자체 spawn)
 *   G2) check-show-hn-t48.mjs 파일 존재 + tests 5/5 PASS (자체 spawn)
 *   G3) docs/D-PLUS-1-RUNBOOK.md 파일 존재 + H2 10개 + 변수 자리 ≥5건
 *   G4) sim-d-plus-1-handoff.mjs 파일 존재 + 6/6 케이스 매칭 (자체 spawn)
 *   G5) D_PLUS_1_HANDOFF_KST = '2026-05-09T09:00:00+09:00' 상수 1:1 매칭
 *       (check-d-plus-1-handoff.mjs + sim-d-plus-1-handoff.mjs)
 *   G6) src/modules/launch/release-freeze-cutoff.ts SUBMIT_DEADLINE_KST 정합
 *       (1bit 수정 0건 / "2026-05-07T22:00:00+09:00" exact match 1건)
 *   G7) git diff --stat HEAD release/2026-05-08 -- src/ 빈 출력 (src/ 변경 0)
 *   G8) check:vocab 0 위반 + check:i18n ko=300 / en=300 parity 정합
 *
 * 자율 정정 권한 (D-59-자-2 / D-63-자-1 패턴 lock 정합):
 *   - G2 self-grep 패턴 정의 라인 자기 매치 시 charCode 빌드 회피.
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

console.log("verify:d64 — D-D64 사이클 8 read-only 게이트 통합 회귀");
console.log("");

// ── C-D64-1∼5 신규 산출물 5건.
const NEW_FILES = [
  "scripts/check-d-plus-1-handoff.mjs",
  "scripts/check-show-hn-t48.mjs",
  "docs/D-PLUS-1-RUNBOOK.md",
  "scripts/sim-d-plus-1-handoff.mjs",
  "scripts/verify-d64.mjs",
];

// ── G1: check-d-plus-1-handoff.mjs + tests 6/6 PASS.
{
  const file = "scripts/check-d-plus-1-handoff.mjs";
  const testFile = "tests/check-d-plus-1-handoff.test.mjs";
  if (!existsSync(resolve(root, file))) {
    fail("G1", `missing ${file}`);
  } else if (!existsSync(resolve(root, testFile))) {
    fail("G1", `missing ${testFile}`);
  } else {
    const r = runNode([testFile]);
    if (r.code === 0 && /6\/6 PASS/.test(r.stdout)) {
      pass(`G1: check-d-plus-1-handoff.mjs + tests 6/6 PASS`);
    } else {
      fail(
        "G1",
        `tests exit=${r.code} stdout-tail=${r.stdout.split("\n").filter(Boolean).slice(-2).join(" | ")}`,
      );
    }
  }
}

// ── G2: check-show-hn-t48.mjs + tests 5/5 PASS.
{
  const file = "scripts/check-show-hn-t48.mjs";
  const testFile = "tests/check-show-hn-t48.test.mjs";
  if (!existsSync(resolve(root, file))) {
    fail("G2", `missing ${file}`);
  } else if (!existsSync(resolve(root, testFile))) {
    fail("G2", `missing ${testFile}`);
  } else {
    const r = runNode([testFile]);
    if (r.code === 0 && /5\/5 PASS/.test(r.stdout)) {
      pass(`G2: check-show-hn-t48.mjs + tests 5/5 PASS`);
    } else {
      fail(
        "G2",
        `tests exit=${r.code} stdout-tail=${r.stdout.split("\n").filter(Boolean).slice(-2).join(" | ")}`,
      );
    }
  }
}

// ── G3: docs/D-PLUS-1-RUNBOOK.md 존재 + H2 10개 + 변수 자리 ≥5건.
//   변수 이름 정형: {{[A-Z0-9_]+}}
{
  const md = readOrEmpty("docs/D-PLUS-1-RUNBOOK.md");
  const lines = md.split("\n");
  const h2 = lines.filter((l) => /^##\s+\d+\.\s/.test(l));
  const vars = md.match(/\{\{[A-Z0-9_]+\}\}/g) ?? [];
  const uniqueVars = new Set(vars);
  if (h2.length === 10 && uniqueVars.size >= 5) {
    pass(`G3: D-PLUS-1-RUNBOOK.md H2 10개 + 변수 자리 ${uniqueVars.size}종 (≥5 의무)`);
  } else {
    fail("G3", `H2 ${h2.length}건 (10 의무) / 변수 자리 ${uniqueVars.size}종 (≥5 의무)`);
  }
}

// ── G4: sim-d-plus-1-handoff.mjs + 6/6 케이스 매칭.
{
  const file = "scripts/sim-d-plus-1-handoff.mjs";
  if (!existsSync(resolve(root, file))) {
    fail("G4", `missing ${file}`);
  } else {
    const r = runNode([file]);
    if (r.code === 0 && /6\/6 PASS/.test(r.stdout)) {
      pass(`G4: sim-d-plus-1-handoff.mjs 6/6 케이스 매칭`);
    } else {
      fail(
        "G4",
        `sim exit=${r.code} stdout-tail=${r.stdout.split("\n").filter(Boolean).slice(-3).join(" | ")}`,
      );
    }
  }
}

// ── G5: D_PLUS_1_HANDOFF_KST = '2026-05-09T09:00:00+09:00' 상수 1:1 매칭.
{
  const handoff = readOrEmpty("scripts/check-d-plus-1-handoff.mjs");
  const sim = readOrEmpty("scripts/sim-d-plus-1-handoff.mjs");
  // check-d-plus-1-handoff.mjs: export const D_PLUS_1_HANDOFF_KST = "2026-05-09T09:00:00+09:00";
  const handoffMatch =
    /D_PLUS_1_HANDOFF_KST\s*=\s*"(2026-05-09T09:00:00\+09:00)"/.exec(handoff)?.[1];
  // sim-d-plus-1-handoff.mjs: const SLOT_KST = "2026-05-09T09:00:00+09:00";
  const simMatch =
    /SLOT_KST\s*=\s*"(2026-05-09T09:00:00\+09:00)"/.exec(sim)?.[1];
  if (
    handoffMatch === "2026-05-09T09:00:00+09:00" &&
    simMatch === "2026-05-09T09:00:00+09:00"
  ) {
    pass(`G5: D_PLUS_1_HANDOFF_KST 상수 1:1 매칭 (handoff + sim)`);
  } else {
    fail(
      "G5",
      `handoff=${handoffMatch} / sim=${simMatch} (expected 2026-05-09T09:00:00+09:00 양쪽)`,
    );
  }
}

// ── G6: release-freeze-cutoff.ts SUBMIT_DEADLINE_KST 1bit 수정 0건.
//   "2026-05-07T22:00:00+09:00" exact match 1건 (SUBMIT_DEADLINE_KST 정의 라인).
{
  const ts = readOrEmpty("src/modules/launch/release-freeze-cutoff.ts");
  const submitMatches = ts.match(/2026-05-07T22:00:00\+09:00/g) ?? [];
  if (submitMatches.length === 1) {
    pass(`G6: SUBMIT_DEADLINE_KST exact match 1건 (1bit 수정 0건 / D-58-자-2 락 정합)`);
  } else {
    fail(
      "G6",
      `SUBMIT_DEADLINE_KST exact match ${submitMatches.length}건 (1건 의무)`,
    );
  }
}

// ── G7: git diff --stat HEAD release/2026-05-08 -- src/ 빈 출력.
{
  const r = spawnSync(
    "git",
    ["diff", "--stat", "HEAD", "release/2026-05-08", "--", "src/"],
    { cwd: root, encoding: "utf8" },
  );
  const out = (r.stdout || "").trim();
  if (r.status === 0 && out.length === 0) {
    pass(`G7: git diff --stat HEAD release/2026-05-08 -- src/ 빈 출력 (src/ 변경 0)`);
  } else {
    fail(
      "G7",
      `git diff exit=${r.status} stdout-tail=${out.split("\n").slice(-3).join(" | ")}`,
    );
  }
}

// ── G8: check:vocab 0 위반 + check:i18n ko=300 / en=300 parity 정합.
{
  const vocab = runNode(["scripts/check-vocab.mjs", "--all"]);
  const i18n = runNode(["scripts/check-i18n-keys.mjs"]);
  const vocabOk = vocab.code === 0;
  const i18nOk = i18n.code === 0;
  // i18n parity는 exit 0 이면 ko/en 카운트 일치 정합.
  if (vocabOk && i18nOk) {
    pass(`G8: check:vocab 0 위반 + check:i18n parity 정합`);
  } else {
    fail(
      "G8",
      `vocab exit=${vocab.code} / i18n exit=${i18n.code} / vocab-tail=${vocab.stdout.split("\n").filter(Boolean).slice(-1)[0] ?? ""} / i18n-tail=${i18n.stdout.split("\n").filter(Boolean).slice(-1)[0] ?? ""}`,
    );
  }
}

console.log("");
console.log(
  `verify:d64 — ${passed}/${passed + failed} ${failed === 0 ? "PASS" : "FAIL"}`,
);

process.exit(failed === 0 ? 0 : 1);
