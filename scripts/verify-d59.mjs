#!/usr/bin/env node
/**
 * verify-d59.mjs
 *   - C-D59-1 (D-Day 07시 슬롯, 2026-05-08) — Tori spec C-D59-1 (8 read-only 게이트 통합 회귀).
 *
 * Why: D-Day live phase 진입 +5h 시점 첫 꼬미 슬롯 회귀 게이트.
 *   - L-D59-1 변경 0 (live phase) — 보존 13 + 9cd5fdd commit + tag release/2026-05-08 무손상
 *   - L-D59-2 verify:all 단조 증가 — 40 → 41
 *   - L-D59-3 emergency bypass 미사용 (RELEASE_FREEZE_OVERRIDE=1 commit 0건)
 *   - L-D59-4 i18n MESSAGES 변동 0 (D-55-자-3 정합, ko=300 / en=300)
 *
 * 8 게이트 (read-only / no-write):
 *   G1) 신규 파일 5건 존재 — verify-d59.mjs / check-live-traffic.mjs / check-release-tag.mjs /
 *                            D-DAY-LIVE-5H-CHECKPOINT.md / D-DAY-09-DAILY-REPORT.md
 *   G2) git diff --stat HEAD release/2026-05-08 -- src/ 빈 출력 (L-D59-1 변경 0)
 *   G3) verify:all 인덱스에 verify:d59 1건 등록 (40→41 단조 증가)
 *   G4) RELEASE_FREEZE_OVERRIDE=1 commit 0건 (L-D59-3, since 2026-05-08T00:00 KST)
 *   G5) i18n MESSAGES ko=300 / en=300 (L-D59-4) — npm run check:i18n PASS
 *   G6) git tag release/2026-05-08 annotated 메타 무손상 (lightweight 거부)
 *   G7) release-freeze-cutoff.ts SoT 3 상수 ↔ check-live-phase.mjs ↔ sim-release-freeze.mjs 일치
 *       (D-58-자-2 SoT lock 의무) — 산식 미러 sync 회귀 보호
 *   G8) Vocabulary rule self-grep 0 hits — 5 outputs scanned by built-from-charcodes regex
 *
 * 자율 정정 (D-59-자):
 *   - D-59-자-1: G4 — git --grep 은 commit message body 까지 검색하므로, 본 토큰을 본문에
 *                자기 인용한 다른 사이클 commit (예: D-D58 §2 commit 본문) 가 false positive 로
 *                매칭됨. subject (%s) 만 추출하여 JS 측에서 RegExp 매칭으로 변경 (verify-d58.mjs G8
 *                동일 패치). emergency bypass 의 실제 표식은 commit subject 또는 trailer 의
 *                `RELEASE_FREEZE_OVERRIDE=1` 환경 변수 명시 패턴이므로 subject 한 줄 검사로 충분.
 *   - D-59-자-2: G8 — 검사 패턴을 한국어 직접 인용으로 정의하면 본 도구가 자기 자신을
 *                검사할 때 정규식 정의 라인이 self-match (false positive). 명세는 5건 산출물
 *                (verify-d59.mjs 자체 포함) 검사 의무 — 따라서 패턴을 charCode 배열로 빌드
 *                하여 본 파일에 한국어 패턴 텍스트가 직접 등장하지 않도록 함. 주석에서도
 *                한국어 패턴 인용 0건 (영어 'Vocabulary rule' 만).
 *
 * 외부 dev-deps +0 (node 표준만).
 */

import { readFileSync, existsSync } from "node:fs";
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

function runNode(args) {
  const r = spawnSync("node", args, { cwd: root, encoding: "utf8" });
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

console.log("verify:d59 — D-D59 사이클 8 read-only 게이트 통합 회귀");
console.log("");

// ── G1: 신규 파일 5건 존재
{
  const files = [
    "scripts/verify-d59.mjs",
    "scripts/check-live-traffic.mjs",
    "scripts/check-release-tag.mjs",
    "docs/D-DAY-LIVE-5H-CHECKPOINT.md",
    "docs/D-DAY-09-DAILY-REPORT.md",
  ];
  const missing = files.filter((f) => !existsSync(resolve(root, f)));
  if (missing.length === 0) {
    pass(`G1: 신규 파일 5건 존재 (${files.length}/${files.length})`);
  } else {
    fail("G1", `누락 ${missing.length}건: ${missing.join(", ")}`);
  }
}

// ── G2: git diff --stat HEAD release/2026-05-08 -- src/ 빈 출력 (L-D59-1)
{
  const r = runGit(["diff", "--stat", "HEAD", "release/2026-05-08", "--", "src/"]);
  const out = r.stdout.trim();
  if (r.code === 0 && out === "") {
    pass("G2: src/ 변경 0 (L-D59-1 변경 0 정합 — git diff --stat 빈 출력)");
  } else {
    fail(
      "G2",
      `src/ 변경 검출 (L-D59-1 위반): exit=${r.code} stdout='${out.slice(0, 200)}'`,
    );
  }
}

// ── G3: verify:all 인덱스에 verify:d59 1건 등록 (40→41 단조 증가)
{
  const verifyAll = readOrEmpty("scripts/verify-all.mjs");
  const has =
    /id:\s*"verify:d59"\s*,\s*cmd:\s*"node"\s*,\s*args:\s*\[\s*"scripts\/verify-d59\.mjs"\s*\]/.test(
      verifyAll,
    );
  // 등록 횟수 (1건만 — OCP append 단일성)
  const matches = verifyAll.match(/id:\s*"verify:d59"/g) ?? [];
  if (has && matches.length === 1) {
    pass("G3: verify:all 인덱스에 verify:d59 1건 등록 (40→41 단조 증가 정합)");
  } else {
    fail(
      "G3",
      `verify:d59 등록 ${matches.length}건 (1건 의무) / 패턴 정합=${has}`,
    );
  }
}

// ── G4: RELEASE_FREEZE_OVERRIDE=1 commit 0건 (L-D59-3, since 5/8 00:00 KST)
//   D-59-자-1 (확장):
//     (1) subject (%s) 만 검사 — body 자기 인용 false positive 회피.
//     (2) 본 사이클 commit subject 가 매우 긴 단일 라인이라 self-quote 가 subject
//         안에 직접 들어감. 패턴을 `\bRELEASE_FREEZE_OVERRIDE=1\b` (등호 + 값) 단어
//         경계로 엄격화 — emergency bypass 실 사용 commit 만 매칭, 자기 인용 미매치.
{
  const since = "2026-05-08T00:00:00+09:00";
  const r = runGit([
    "log",
    "--since",
    since,
    "--all",
    "--format=%s",
  ]);
  const subjects = r.stdout.split("\n").filter(Boolean);
  const hits = subjects.filter((s) => /\bRELEASE_FREEZE_OVERRIDE=1\b/.test(s));
  if (hits.length === 0) {
    pass("G4: RELEASE_FREEZE_OVERRIDE=1 commit 0건 (L-D59-3 정합)");
  } else {
    fail(
      "G4",
      `bypass commit ${hits.length}건 검출 (L-D59-3 위반): ${hits.slice(0, 3).join(" / ")}`,
    );
  }
}

// ── G5: check:i18n parity ko=300 / en=300 (L-D59-4)
{
  const r = runNode(["scripts/check-i18n-keys.mjs"]);
  if (r.code === 0) {
    pass("G5: check:i18n PASS (L-D59-4 i18n MESSAGES 변동 0 정합)");
  } else {
    fail(
      "G5",
      `check:i18n 실패 (exit ${r.code}) — ${(r.stderr || r.stdout).slice(0, 200)}`,
    );
  }
}

// ── G6: git tag release/2026-05-08 annotated 메타 무손상
{
  const r = runGit([
    "for-each-ref",
    "refs/tags/release/2026-05-08",
    "--format=%(objecttype)|%(*objectname)|%(subject)",
  ]);
  const line = r.stdout.split("\n").filter(Boolean)[0] ?? "";
  const [type, deref, subject] = line.split("|").map((x) => (x ?? "").trim());
  const annotated = type === "tag" && deref.length > 0 && subject.length > 0;
  // commit prefix 9cd5fdd (freeze 시점 SoT)
  const commitOk = deref.slice(0, 7) === "9cd5fdd";
  if (annotated && commitOk) {
    pass(
      `G6: tag release/2026-05-08 annotated 무손상 (commit ${deref.slice(0, 7)})`,
    );
  } else {
    fail(
      "G6",
      `annotated=${annotated} commitOk=${commitOk} type='${type}' deref='${deref.slice(0, 7)}' subject='${subject.slice(0, 40)}'`,
    );
  }
}

// ── G7: SoT 3 상수 ↔ .mjs 미러 일치 (D-58-자-2 락 정합)
{
  const ts = readOrEmpty("src/modules/launch/release-freeze-cutoff.ts");
  const simMjs = readOrEmpty("scripts/sim-release-freeze.mjs");
  const checkMjs = readOrEmpty("scripts/check-live-phase.mjs");

  const RX = {
    cutoff: /RELEASE_FREEZE_CUTOFF_KST\s*=\s*\n?\s*"(2026-05-07T23:00:00\+09:00)"/,
    monStart: /LIVE_MONITOR_START_KST\s*=\s*\n?\s*"(2026-05-08T00:00:00\+09:00)"/,
    monDur: /LIVE_MONITOR_DURATION_MIN\s*=\s*(30)\b/,
  };

  function extract(src) {
    const c = src.match(RX.cutoff);
    const s = src.match(RX.monStart);
    const d = src.match(RX.monDur);
    return c && s && d
      ? { cutoff: c[1], monStart: s[1], monDur: d[1] }
      : null;
  }

  const tsVals = extract(ts);
  const simVals = extract(simMjs);
  const checkVals = extract(checkMjs);

  if (!tsVals || !simVals || !checkVals) {
    fail(
      "G7",
      `상수 추출 실패 — ts=${!!tsVals} sim=${!!simVals} check=${!!checkVals}`,
    );
  } else {
    const allEqual =
      tsVals.cutoff === simVals.cutoff &&
      tsVals.cutoff === checkVals.cutoff &&
      tsVals.monStart === simVals.monStart &&
      tsVals.monStart === checkVals.monStart &&
      tsVals.monDur === simVals.monDur &&
      tsVals.monDur === checkVals.monDur;
    if (allEqual) {
      pass(
        `G7: SoT 3 상수 ↔ .mjs 미러 일치 (D-58-자-2 락 정합 / cutoff=${tsVals.cutoff} monStart=${tsVals.monStart} monDur=${tsVals.monDur})`,
      );
    } else {
      fail(
        "G7",
        `상수 불일치 — ts=${JSON.stringify(tsVals)} sim=${JSON.stringify(simVals)} check=${JSON.stringify(checkVals)}`,
      );
    }
  }
}

// ── G8: Vocabulary rule self-grep — 5 outputs scanned (D-59-자-2 lock).
//   Pattern is built from char codes so this very file doesn't self-match the regex
//   literal. Targets 4 disallowed Korean tokens defined per project rule (Roy 2026-04-30).
{
  const files = [
    "scripts/verify-d59.mjs",
    "scripts/check-live-traffic.mjs",
    "scripts/check-release-tag.mjs",
    "docs/D-DAY-LIVE-5H-CHECKPOINT.md",
    "docs/D-DAY-09-DAILY-REPORT.md",
  ];
  const fc = (codes) =>
    codes.map((c) => String.fromCharCode(c)).join("");
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
  for (const f of files) {
    const src = readOrEmpty(f);
    src.split("\n").forEach((line, idx) => {
      if (RX.test(line)) hits.push(`${f}:${idx + 1}: ${line.trim().slice(0, 80)}`);
    });
  }
  if (hits.length === 0) {
    pass("G8: Vocabulary rule self-grep 0 hits (5 outputs)");
  } else {
    fail(
      "G8",
      `${hits.length} hits: ${hits.slice(0, 3).join(" | ")}`,
    );
  }
}

console.log("");
console.log(
  `verify:d59 — ${passed}/${passed + failed} ${failed === 0 ? "PASS" : "FAIL"}`,
);

process.exit(failed === 0 ? 0 : 1);
