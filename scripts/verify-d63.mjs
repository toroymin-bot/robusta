#!/usr/bin/env node
/**
 * verify-d63.mjs
 *   - C-D63-1 (D-Day 21시 EOD §11 슬롯, 2026-05-08) — Tori spec C-D63-1 (8 read-only 게이트).
 *
 * Why: D-Day live phase +21h EOD 시점 §12 꼬미 슬롯 회귀 게이트.
 *   D-D63 사이클 신규 산출물 5건 (C-D63-1∼5) + verify:all 42→43 OCP append + L-D63-1∼4 정책 락.
 *
 *   - L-D63-1 변경 0 (live phase +23h) — src/ 1bit 수정 0
 *   - L-D63-2 verify:all 단조 증가 — 42 → 43
 *   - L-D63-3 emergency bypass 미사용 ([BYPASS] prefix commit 0건, ^[BYPASS]\s 매칭)
 *   - L-D63-4 i18n MESSAGES 변동 0 (D-55-자-3 정합, ko=300 / en=300)
 *
 * 8 게이트 (read-only / no-write):
 *   G1) C-D63-1∼5 신규 파일 5건 존재
 *   G2) G1 5건 모두 1바이트 이상 + UTF-8 정합 (BOM 금지)
 *   G3) docs/D-DAY-EOD-CHECKLIST.md H2 9개 정확 매칭 (^##\s+\d+\.\s 패턴)
 *   G4) docs/D-DAY-INTEGRATED-REPORT.md H2 10개 정확 매칭 + 변수 자리 ≥5건 ({{[A-Z_]+}})
 *   G5) scripts/check-eod-summary.mjs 외부 fetch 0건 (charCode 빌드 패턴, D-59-자-2 정합)
 *   G6) scripts/check-show-hn-t24.mjs DEFAULT_SUBMIT_KST 1:1 미러
 *       (release-freeze-cutoff.ts SUBMIT_DEADLINE_KST + 24h 산식 — D-58-자-2 락 정합)
 *   G7) scripts/verify-all.mjs 인덱스에 verify:d63 1건 OCP append (42→43 단조 증가)
 *   G8) package.json scripts 항목 verify:d63 1건 OCP append
 *
 * 자율 정정 권한 (D-59-자-2 패턴 lock 정합):
 *   - G5 self-grep 패턴 정의 라인 자기 매치 시 charCode 빌드 + 영어 주석으로 정정.
 *
 * 외부 dev-deps +0 (node 표준만).
 */

import { readFileSync, existsSync, statSync } from "node:fs";
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

function readOrEmpty(p) {
  try {
    return readFileSync(resolve(root, p), "utf8");
  } catch {
    return "";
  }
}

function readBytesOrNull(p) {
  try {
    return readFileSync(resolve(root, p));
  } catch {
    return null;
  }
}

console.log("verify:d63 — D-D63 사이클 8 read-only 게이트 통합 회귀");
console.log("");

// ── C-D63-1∼5 신규 산출물 5건 (G1∼G2 대상).
const NEW_FILES = [
  "scripts/verify-d63.mjs",
  "scripts/check-eod-summary.mjs",
  "docs/D-DAY-EOD-CHECKLIST.md",
  "scripts/check-show-hn-t24.mjs",
  "docs/D-DAY-INTEGRATED-REPORT.md",
];

// ── G1: 신규 파일 5건 존재.
{
  const issues = [];
  for (const f of NEW_FILES) {
    const abs = resolve(root, f);
    if (!existsSync(abs)) issues.push(`missing ${f}`);
  }
  if (issues.length === 0) {
    pass(`G1: 신규 파일 5건 존재 (${NEW_FILES.length}/${NEW_FILES.length})`);
  } else {
    fail("G1", issues.join(" / "));
  }
}

// ── G2: 5건 모두 1바이트 이상 + UTF-8 정합 (BOM 금지).
//   Replacement char U+FFFD is referenced by codepoint to avoid this very file
//   self-matching the check (D-59-자-2 charCode build pattern lock).
{
  const REPLACEMENT_CHAR = String.fromCharCode(0xfffd);
  const issues = [];
  for (const f of NEW_FILES) {
    const buf = readBytesOrNull(f);
    if (buf === null) {
      issues.push(`unreadable ${f}`);
      continue;
    }
    if (buf.length < 1) {
      issues.push(`${f} empty`);
      continue;
    }
    // BOM 금지: UTF-8 BOM (EF BB BF)
    if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
      issues.push(`${f} has UTF-8 BOM`);
      continue;
    }
    // UTF-8 정합 — invalid sequence 발견 시 Buffer.toString('utf8') 가 U+FFFD 치환.
    const text = buf.toString("utf8");
    if (text.indexOf(REPLACEMENT_CHAR) >= 0) {
      issues.push(`${f} invalid UTF-8 (replacement char detected)`);
    }
  }
  if (issues.length === 0) {
    pass(`G2: 5건 ≥1byte + UTF-8 정합 (BOM 금지)`);
  } else {
    fail("G2", issues.join(" / "));
  }
}

// ── G3: D-DAY-EOD-CHECKLIST.md H2 섹션 9개 정확 매칭.
{
  const md = readOrEmpty("docs/D-DAY-EOD-CHECKLIST.md");
  const lines = md.split("\n");
  const hits = lines.filter((l) => /^##\s+\d+\.\s/.test(l));
  if (hits.length === 9) {
    pass(`G3: D-DAY-EOD-CHECKLIST.md H2 9개 정확 매칭`);
  } else {
    fail("G3", `H2 섹션 ${hits.length}건 (9건 의무)`);
  }
}

// ── G4: D-DAY-INTEGRATED-REPORT.md H2 10개 정확 매칭 + 변수 자리 ≥5건.
//   변수 이름 정형: {{[A-Z0-9_]+}} — KQ_23_ECHO_COUNT 같은 숫자 포함 변수 흡수.
{
  const md = readOrEmpty("docs/D-DAY-INTEGRATED-REPORT.md");
  const lines = md.split("\n");
  const h2 = lines.filter((l) => /^##\s+\d+\.\s/.test(l));
  const vars = md.match(/\{\{[A-Z0-9_]+\}\}/g) ?? [];
  const uniqueVars = new Set(vars);
  if (h2.length === 10 && uniqueVars.size >= 5) {
    pass(`G4: H2 10개 + 변수 자리 ${uniqueVars.size}종 (≥5 의무)`);
  } else {
    fail("G4", `H2 ${h2.length}건 (10 의무) / 변수 자리 ${uniqueVars.size}종 (≥5 의무)`);
  }
}

// ── G5: check-eod-summary.mjs 외부 fetch 0건.
//   Patterns built from char codes so this very file doesn't self-match the regex
//   literal. Targets 5 disallowed network-call shapes.
//   D-59-자-2 charCode build pattern lock.
{
  const fc = (codes) => codes.map((c) => String.fromCharCode(c)).join("");
  // Pattern strings by codepoint — built so source comments contain no literal
  // copies of the regex texts.
  //   p1: 'fetch('     — codes 102,101,116,99,104,40
  //   p2: 'https://'   — codes 104,116,116,112,115,58,47,47
  //   p3: 'http://'    — codes 104,116,116,112,58,47,47
  //   p4: 'node:net'   — codes 110,111,100,101,58,110,101,116
  //   p5: 'node:tls'   — codes 110,111,100,101,58,116,108,115
  const p1 = fc([102, 101, 116, 99, 104, 40]);
  const p2 = fc([104, 116, 116, 112, 115, 58, 47, 47]);
  const p3 = fc([104, 116, 116, 112, 58, 47, 47]);
  const p4 = fc([110, 111, 100, 101, 58, 110, 101, 116]);
  const p5 = fc([110, 111, 100, 101, 58, 116, 108, 115]);
  const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const RX = new RegExp(
    [p1, p2, p3, p4, p5].map(escape).join("|"),
  );
  const target = "scripts/check-eod-summary.mjs";
  const src = readOrEmpty(target);
  const hits = [];
  src.split("\n").forEach((line, idx) => {
    if (RX.test(line)) hits.push(`${target}:${idx + 1}: ${line.trim().slice(0, 80)}`);
  });
  if (hits.length === 0) {
    pass(`G5: check-eod-summary.mjs 외부 fetch 0 hits (5 patterns)`);
  } else {
    fail("G5", `${hits.length} hits: ${hits.slice(0, 3).join(" | ")}`);
  }
}

// ── G6: check-show-hn-t24.mjs DEFAULT_SUBMIT_KST 1:1 미러
//   release-freeze-cutoff.ts 의 SUBMIT_DEADLINE_KST 와 동일값 + 24h 산식 검증.
{
  const ts = readOrEmpty("src/modules/launch/release-freeze-cutoff.ts");
  const t24 = readOrEmpty("scripts/check-show-hn-t24.mjs");

  const tsSubmit = ts.match(
    /SUBMIT_DEADLINE_KST\s*=\s*\n?\s*"(2026-05-07T22:00:00\+09:00)"/,
  )?.[1];
  const t24Default = t24.match(
    /DEFAULT_SUBMIT_KST\s*=\s*"(2026-05-07T22:00:00\+09:00)"/,
  )?.[1];
  // 24h 상수 검증 (T+24h hour offset 정의) — 다음 패턴 중 하나 일치 의무:
  //   - T_PLUS_24H_HOURS = 24
  //   - T_PLUS_24H_MS = ... 24 * 60 * 60 * 1000 ...
  //   - 24 * 60 * 60 * 1000 (literal 표현식)
  const has24h =
    /T_PLUS_24H[A-Z_]*\s*=\s*24\b/.test(t24) ||
    /\b24\s*\*\s*60\s*\*\s*60\s*\*\s*1000/.test(t24);

  if (tsSubmit && t24Default && tsSubmit === t24Default && has24h) {
    pass(`G6: DEFAULT_SUBMIT_KST 1:1 미러 정합 (D-58-자-2 락 / submit=${tsSubmit} +24h 산식)`);
  } else {
    fail(
      "G6",
      `미러 불일치 — ts.submit=${tsSubmit} t24.default=${t24Default} 24h-산식=${has24h}`,
    );
  }
}

// ── G7: verify:all 인덱스에 verify:d63 1건 OCP append (42→43 단조 증가).
{
  const verifyAll = readOrEmpty("scripts/verify-all.mjs");
  const has =
    /id:\s*"verify:d63"\s*,\s*cmd:\s*"node"\s*,\s*args:\s*\[\s*"scripts\/verify-d63\.mjs"\s*\]/.test(
      verifyAll,
    );
  const matches = verifyAll.match(/id:\s*"verify:d63"/g) ?? [];
  if (has && matches.length === 1) {
    pass("G7: verify:all 인덱스에 verify:d63 1건 OCP append (42→43 단조 증가)");
  } else {
    fail("G7", `verify:d63 등록 ${matches.length}건 (1건 의무) / 패턴 정합=${has}`);
  }
}

// ── G8: package.json scripts 항목 verify:d63 1건 OCP append.
{
  const pkg = readOrEmpty("package.json");
  let parsed;
  try {
    parsed = JSON.parse(pkg);
  } catch {
    parsed = null;
  }
  const cmd = parsed?.scripts?.["verify:d63"];
  const expected = "node scripts/verify-d63.mjs";
  if (cmd === expected) {
    pass(`G8: package.json scripts.verify:d63 = '${expected}'`);
  } else {
    fail("G8", `package.json scripts.verify:d63 = ${JSON.stringify(cmd)} (expected '${expected}')`);
  }
}

console.log("");
console.log(
  `verify:d63 — ${passed}/${passed + failed} ${failed === 0 ? "PASS" : "FAIL"}`,
);

process.exit(failed === 0 ? 0 : 1);
