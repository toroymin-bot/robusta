#!/usr/bin/env node
/**
 * verify-d62.mjs
 *   - C-D62-1 (D-Day 19시 슬롯 §10, 2026-05-08) — Tori spec C-D62-1 (8 read-only 게이트 통합 회귀).
 *
 * Why: D-Day live phase 진입 +18h 시점 §10 꼬미 슬롯 회귀 게이트.
 *   §5∼§8 GAP 회복 후 D-D62 사이클 신규 산출물 5건 + 정책 락 4건 + SoT 미러 sync 검증.
 *
 *   - L-D62-1 변경 0 (live phase +18h) — src/ 1bit 수정 0
 *   - L-D62-2 verify:all 단조 증가 — 41 → 42
 *   - L-D62-3 emergency bypass 미사용 ([BYPASS] prefix commit 0건)
 *   - L-D62-4 i18n MESSAGES 변동 0 (D-55-자-3 정합, ko=300 / en=300)
 *
 * 8 게이트 (read-only / no-write):
 *   G1) 신규 파일 5건 존재 + size > 100 bytes —
 *       verify-d62.mjs / check-slot-gap.mjs / check-show-hn-window.mjs /
 *       D-DAY-SLOT-GAP-RECOVERY.md / D-DAY-19H-CHECKPOINT.md
 *   G2) git diff --stat HEAD release/2026-05-08 -- src/ 빈 출력 (L-D62-1 변경 0)
 *   G3) 5건 산출물 어휘 룰 self-grep 0 hits (D-59-자-2 charCode 빌드 패턴 정합)
 *   G4) [BYPASS] prefix commit 0건 since 2026-05-08T00:00 KST (L-D62-3 / D-59-자-3 정합)
 *   G5) verify:all 인덱스에 verify:d62 1건 등록 (41→42 단조 증가)
 *   G6) release-freeze-cutoff.ts 4 상수 ↔ check-live-phase.mjs ↔ sim-release-freeze.mjs ↔
 *       check-show-hn-window.mjs SUBMIT_DEADLINE_KST 미러 sync (D-58-자-2 락 정합)
 *   G7) git tag release/2026-05-08 annotated 무손상 (commit 9cd5fdd prefix)
 *   G8) Placeholder 토큰 0 hits self-grep (D-56-자-0 재발 방지 charCode 빌드 정합)
 *
 * 자율 정정 권한 (D-59-자-2 / D-59-자-3 패턴 lock 정합):
 *   - G3 / G8 self-grep 패턴 정의 라인 자기 매치 시 charCode 빌드 + 영어 주석으로 정정.
 *
 * 외부 dev-deps +0 (node 표준만).
 */

import { readFileSync, existsSync, statSync } from "node:fs";
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

function runGit(args) {
  const r = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  return {
    code: r.status ?? 1,
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
  };
}

function readOrEmpty(p) {
  try {
    return readFileSync(resolve(root, p), "utf8");
  } catch {
    return "";
  }
}

console.log("verify:d62 — D-D62 사이클 8 read-only 게이트 통합 회귀");
console.log("");

// ── G1: 신규 파일 5건 존재 + size > 100 bytes
const NEW_FILES = [
  "scripts/verify-d62.mjs",
  "scripts/check-slot-gap.mjs",
  "scripts/check-show-hn-window.mjs",
  "docs/D-DAY-SLOT-GAP-RECOVERY.md",
  "docs/D-DAY-19H-CHECKPOINT.md",
];
{
  const issues = [];
  for (const f of NEW_FILES) {
    const abs = resolve(root, f);
    if (!existsSync(abs)) {
      issues.push(`missing ${f}`);
      continue;
    }
    const size = statSync(abs).size;
    if (size <= 100) issues.push(`${f} size=${size}b ≤ 100`);
  }
  if (issues.length === 0) {
    pass(`G1: 신규 파일 5건 존재 + size > 100b (${NEW_FILES.length}/${NEW_FILES.length})`);
  } else {
    fail("G1", issues.join(" / "));
  }
}

// ── G2: git diff --stat HEAD release/2026-05-08 -- src/ 빈 출력 (L-D62-1)
{
  const r = runGit(["diff", "--stat", "HEAD", "release/2026-05-08", "--", "src/"]);
  const out = r.stdout.trim();
  if (r.code === 0 && out === "") {
    pass("G2: src/ 변경 0 (L-D62-1 변경 0 정합)");
  } else {
    fail("G2", `src/ 변경 검출 (L-D62-1 위반): exit=${r.code} stdout='${out.slice(0, 200)}'`);
  }
}

// ── G3: Vocabulary rule self-grep 0 hits (5 outputs).
//   Pattern is built from char codes so this very file doesn't self-match the regex
//   literal. Targets 4 disallowed Korean tokens defined per project rule (Roy 2026-04-30).
//   D-59-자-2 charCode build pattern lock.
{
  const fc = (codes) => codes.map((c) => String.fromCharCode(c)).join("");
  // 4 tokens (Hangul syllables), referenced by codepoint to avoid literal embedding:
  //   token1: U+BC15 U+B2E4
  //   token2: U+BC15 U+C558
  //   token3: U+BC15 U+C74C
  //   token4: U+BC15 U+C81C
  const tokens = [
    fc([0xbc15, 0xb2e4]),
    fc([0xbc15, 0xc558]),
    fc([0xbc15, 0xc74c]),
    fc([0xbc15, 0xc81c]),
  ];
  const RX = new RegExp(tokens.join("|"));
  const hits = [];
  for (const f of NEW_FILES) {
    const src = readOrEmpty(f);
    src.split("\n").forEach((line, idx) => {
      if (RX.test(line)) hits.push(`${f}:${idx + 1}: ${line.trim().slice(0, 80)}`);
    });
  }
  if (hits.length === 0) {
    pass("G3: Vocabulary rule self-grep 0 hits (5 outputs)");
  } else {
    fail("G3", `${hits.length} hits: ${hits.slice(0, 3).join(" | ")}`);
  }
}

// ── G4: [BYPASS] prefix commit 0건 since 5/8 00:00 KST (L-D62-3 / D-59-자-3 정합).
{
  const since = "2026-05-08T00:00:00+09:00";
  const r = runGit(["log", "--since", since, "--all", "--format=%s"]);
  const subjects = r.stdout.split("\n").filter(Boolean);
  const hits = subjects.filter((s) => /^\[BYPASS\]\s/.test(s));
  if (hits.length === 0) {
    pass("G4: emergency bypass commit 0건 (L-D62-3 정합 / [BYPASS] prefix 매칭)");
  } else {
    fail(
      "G4",
      `bypass commit ${hits.length}건 검출 (L-D62-3 위반): ${hits.slice(0, 3).join(" / ")}`,
    );
  }
}

// ── G5: verify:all 인덱스에 verify:d62 1건 등록 (41→42 단조 증가).
{
  const verifyAll = readOrEmpty("scripts/verify-all.mjs");
  const has =
    /id:\s*"verify:d62"\s*,\s*cmd:\s*"node"\s*,\s*args:\s*\[\s*"scripts\/verify-d62\.mjs"\s*\]/.test(
      verifyAll,
    );
  const matches = verifyAll.match(/id:\s*"verify:d62"/g) ?? [];
  if (has && matches.length === 1) {
    pass("G5: verify:all 인덱스에 verify:d62 1건 등록 (41→42 단조 증가 정합)");
  } else {
    fail("G5", `verify:d62 등록 ${matches.length}건 (1건 의무) / 패턴 정합=${has}`);
  }
}

// ── G6: SoT 4 상수 미러 sync — release-freeze-cutoff.ts ↔ .mjs 일치 (D-58-자-2 락 정합).
{
  const ts = readOrEmpty("src/modules/launch/release-freeze-cutoff.ts");
  const simMjs = readOrEmpty("scripts/sim-release-freeze.mjs");
  const checkMjs = readOrEmpty("scripts/check-live-phase.mjs");
  const showHnMjs = readOrEmpty("scripts/check-show-hn-window.mjs");

  const RX = {
    cutoff: /RELEASE_FREEZE_CUTOFF_KST\s*=\s*\n?\s*"(2026-05-07T23:00:00\+09:00)"/,
    monStart: /LIVE_MONITOR_START_KST\s*=\s*\n?\s*"(2026-05-08T00:00:00\+09:00)"/,
    monDur: /LIVE_MONITOR_DURATION_MIN\s*=\s*(30)\b/,
    submit: /SUBMIT_DEADLINE_KST\s*=\s*\n?\s*"(2026-05-07T22:00:00\+09:00)"/,
  };

  const tsCutoff = ts.match(RX.cutoff)?.[1];
  const tsMonStart = ts.match(RX.monStart)?.[1];
  const tsMonDur = ts.match(RX.monDur)?.[1];
  const tsSubmit = ts.match(RX.submit)?.[1];

  const simCutoff = simMjs.match(RX.cutoff)?.[1];
  const simMonStart = simMjs.match(RX.monStart)?.[1];
  const simMonDur = simMjs.match(RX.monDur)?.[1];

  const checkCutoff = checkMjs.match(RX.cutoff)?.[1];
  const checkMonStart = checkMjs.match(RX.monStart)?.[1];
  const checkMonDur = checkMjs.match(RX.monDur)?.[1];

  // check-show-hn-window.mjs 는 DEFAULT_SUBMIT_KST 상수명으로 보유.
  const showHnSubmit = showHnMjs.match(
    /DEFAULT_SUBMIT_KST\s*=\s*"(2026-05-07T22:00:00\+09:00)"/,
  )?.[1];

  const tsAll = tsCutoff && tsMonStart && tsMonDur && tsSubmit;
  const simAll = simCutoff && simMonStart && simMonDur;
  const checkAll = checkCutoff && checkMonStart && checkMonDur;
  const showHnAll = !!showHnSubmit;

  if (!tsAll || !simAll || !checkAll || !showHnAll) {
    fail(
      "G6",
      `상수 추출 실패 — ts=${!!tsAll} sim=${!!simAll} check=${!!checkAll} showHn=${!!showHnAll}`,
    );
  } else {
    const allEq =
      tsCutoff === simCutoff &&
      tsCutoff === checkCutoff &&
      tsMonStart === simMonStart &&
      tsMonStart === checkMonStart &&
      tsMonDur === simMonDur &&
      tsMonDur === checkMonDur &&
      tsSubmit === showHnSubmit;
    if (allEq) {
      pass(
        `G6: SoT 4 상수 미러 sync 정합 (D-58-자-2 락 / cutoff=${tsCutoff} submit=${tsSubmit})`,
      );
    } else {
      fail(
        "G6",
        `상수 불일치 — ts.submit=${tsSubmit} showHn.submit=${showHnSubmit} ts.cutoff=${tsCutoff} sim=${simCutoff} check=${checkCutoff}`,
      );
    }
  }
}

// ── G7: git tag release/2026-05-08 annotated 메타 무손상.
{
  const r = runGit([
    "for-each-ref",
    "refs/tags/release/2026-05-08",
    "--format=%(objecttype)|%(*objectname)|%(subject)",
  ]);
  const line = r.stdout.split("\n").filter(Boolean)[0] ?? "";
  const [type, deref, subject] = line.split("|").map((x) => (x ?? "").trim());
  const annotated = type === "tag" && deref.length > 0 && subject.length > 0;
  const commitOk = deref.slice(0, 7) === "9cd5fdd";
  if (annotated && commitOk) {
    pass(`G7: tag release/2026-05-08 annotated 무손상 (commit ${deref.slice(0, 7)})`);
  } else {
    fail(
      "G7",
      `annotated=${annotated} commitOk=${commitOk} type='${type}' deref='${deref.slice(0, 7)}' subject='${subject.slice(0, 40)}'`,
    );
  }
}

// ── G8: Placeholder leak self-grep (D-56-자-0 재발 방지).
//   Targets accidental fill-in-blank leaks where one ASCII char repeats N+ times
//   in a row. Three rules:
//     rule A: capital letter (codepoint U+0058) repeats 3 or more
//     rule B: low line       (codepoint U+005F) repeats 4 or more
//     rule C: question mark  (codepoint U+003F) repeats 3 or more
//   Canonical variable slots are brace-pair {{NAME}} only (D-56-자-0 lock).
//   Patterns are built from char codes only — codepoints are the sole source
//   of the literal characters in regex (D-59-자-2 charCode build lock). No
//   literal repetition of these characters appears in source comments.
{
  const fc = (codes) => codes.map((c) => String.fromCharCode(c)).join("");
  // Single chars by codepoint:
  //   capX: U+0058 ('X')
  //   und : U+005F ('_')
  //   qm  : U+003F ('?')
  const capX = fc([0x0058]);
  const und = fc([0x005f]);
  const qm = fc([0x003f]);
  // Build pattern strings using regex repeat operators. Embedding the literal
  // chars only inside char-class brackets avoids self-match on this very line
  // (the chars appear isolated rather than as a placeholder run).
  const pXxx = `[${capX}]{3,}`;
  const pUnd = `[${und}]{4,}`;
  const pQm = `[\\${qm}]{3,}`;
  const RX = new RegExp(`(?:${pXxx})|(?:${pUnd})|(?:${pQm})`);
  const hits = [];
  for (const f of NEW_FILES) {
    const src = readOrEmpty(f);
    src.split("\n").forEach((line, idx) => {
      if (RX.test(line)) hits.push(`${f}:${idx + 1}: ${line.trim().slice(0, 80)}`);
    });
  }
  if (hits.length === 0) {
    pass("G8: Placeholder leak self-grep 0 hits (5 outputs)");
  } else {
    fail("G8", `${hits.length} hits: ${hits.slice(0, 3).join(" | ")}`);
  }
}

console.log("");
console.log(
  `verify:d62 — ${passed}/${passed + failed} ${failed === 0 ? "PASS" : "FAIL"}`,
);

process.exit(failed === 0 ? 0 : 1);
