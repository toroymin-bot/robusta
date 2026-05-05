#!/usr/bin/env node
/**
 * verify-shownh-copy.mjs
 *   - C-D46-2 (D-2 03시 슬롯, 2026-05-06) — Tori spec C-D46-2 (B-D46-2 / F-D46-2).
 *
 * Why: Show HN 카피 v3 final lock — 5/7 22:00 KST submit (B-D45-1 락) 까지 약 45시간.
 *   변경 차단 게이트 — verify:all 흡수, 6단어/3줄/caption 정합 자동 검증.
 *
 * 게이트 (5/5 PASS 의무):
 *   1) 'launch.shownh.headline.v2' 영문 단어 수 = 6 ± 0
 *   2) 'launch.shownh.body.v2.line1/2/3' 3 키 모두 존재 (ko + en)
 *   3) 'launch.shownh.submitted.caption' ko + en parity (각 1회 정확 grep)
 *   4) ko/en parity — 위 5 키 ko/en 양쪽 존재
 *   5) messages.ts read-only — db.put/add/delete grep 0
 *
 * 외부 dev-deps +0 (node 표준만).
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const messagesPath = resolve(root, "src/modules/i18n/messages.ts");

function pass(label) {
  console.log(`  ✓ ${label}`);
}
function fail(label, msg) {
  console.error(`  ✗ ${label} — ${msg}`);
  process.exitCode = 1;
}

function extractValue(src, key, blockHint) {
  // multiline value 지원 (key + ":" + 그 다음 string literal까지).
  // 단일 문자열 리터럴만 지원: "...".
  const re = new RegExp(
    `"${key.replace(/\./g, "\\.")}"\\s*:\\s*\\n?\\s*"([^"]*)"`,
    "g",
  );
  const matches = [];
  let m;
  while ((m = re.exec(src)) !== null) {
    matches.push(m[1]);
  }
  return matches;
}

async function main() {
  console.log("verify:shownh-copy — Show HN 카피 v3 final lock");
  const src = await readFile(messagesPath, "utf8");

  // 1) 영문 헤드라인 6단어 정합.
  const headlineEn = extractValue(src, "launch.shownh.headline.v2");
  // ko + en 둘 다 매칭됨 (ko 첫번째, en 두번째).
  if (headlineEn.length < 2) {
    fail(
      "1. headline.v2 ko/en parity",
      `expected 2 occurrences, got ${headlineEn.length}`,
    );
  } else {
    const enHeadline = headlineEn[1];
    const wordCount = enHeadline.trim().split(/\s+/).length;
    if (wordCount === 6) {
      pass(`1. headline.v2 EN word count = 6 (${enHeadline})`);
    } else {
      fail(
        "1. headline.v2 EN word count",
        `expected 6, got ${wordCount} — "${enHeadline}"`,
      );
    }
  }

  // 2) 본문 3줄 (line1/2/3) ko + en 모두 존재.
  for (const line of ["line1", "line2", "line3"]) {
    const matches = extractValue(src, `launch.shownh.body.v2.${line}`);
    if (matches.length >= 2) {
      pass(`2.${line} ko/en parity (${matches.length} occurrences)`);
    } else {
      fail(
        `2.${line} ko/en parity`,
        `expected 2 occurrences, got ${matches.length}`,
      );
    }
  }

  // 3) submit caption ko + en parity.
  const captionMatches = extractValue(
    src,
    "launch.shownh.submitted.caption",
  );
  if (captionMatches.length >= 2) {
    pass(`3. submitted.caption ko/en parity (${captionMatches.length})`);
  } else {
    fail(
      "3. submitted.caption ko/en parity",
      `expected 2 occurrences, got ${captionMatches.length}`,
    );
  }

  // 4) ko/en parity — ko 블록 / en 블록 양쪽 헤드라인 존재 확인 (별도 카운트 검증).
  const koBlockMatch = src.match(/ko:\s*\{([\s\S]*?)\n\s{2}\},\s*\n\s{2}en:/);
  const enBlockMatch = src.match(/en:\s*\{([\s\S]*?)\n\s{2}\},\s*\n\}\s*as/);
  if (koBlockMatch && enBlockMatch) {
    const koBlock = koBlockMatch[1];
    const enBlock = enBlockMatch[1];
    const required = [
      "launch.shownh.headline.v2",
      "launch.shownh.body.v2.line1",
      "launch.shownh.body.v2.line2",
      "launch.shownh.body.v2.line3",
      "launch.shownh.submitted.caption",
    ];
    let allOk = true;
    for (const k of required) {
      if (!koBlock.includes(`"${k}"`)) {
        fail("4. parity", `ko block missing "${k}"`);
        allOk = false;
      }
      if (!enBlock.includes(`"${k}"`)) {
        fail("4. parity", `en block missing "${k}"`);
        allOk = false;
      }
    }
    if (allOk) {
      pass("4. ko/en parity — 5 keys both blocks");
    }
  } else {
    fail("4. parity", "ko/en block boundary not found");
  }

  // 5) messages.ts read-only — db.put/add/delete 0건.
  const writeOps = src.match(/\bdb\.(put|add|delete|update)\b/g);
  if (!writeOps || writeOps.length === 0) {
    pass("5. messages.ts read-only (db.put/add/delete 0)");
  } else {
    fail("5. read-only", `found ${writeOps.length} write ops in messages.ts`);
  }

  if (process.exitCode === 1) {
    console.error("verify:shownh-copy — FAIL");
  } else {
    console.log("verify:shownh-copy — 5/5 PASS");
  }
}

main().catch((err) => {
  console.error("verify:shownh-copy — ERROR", err);
  process.exit(1);
});
