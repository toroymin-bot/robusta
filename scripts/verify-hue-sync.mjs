#!/usr/bin/env node
/**
 * verify-hue-sync.mjs
 *   - C-D24-2 (D6 03시 슬롯, 2026-05-02) — F-53 5베이스 hue TS↔CSS single source 동기 검증.
 *
 * 검증 항목:
 *   1) src/modules/ui/theme.ts 의 PARTICIPANT_HUE_SEEDS = [20, 50, 150, 200, 280]
 *   2) src/app/globals.css :root 의
 *        --participant-hue-base-1: 20;
 *        --participant-hue-base-2: 50;
 *        --participant-hue-base-3: 150;
 *        --participant-hue-base-4: 200;
 *        --participant-hue-base-5: 280;
 *   3) PARTICIPANT_HUE_SEED_CSS_VARS 5건 export 정의 + 변수명 일치
 *
 * 의존성 0 — node 표준만.
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(process.cwd());
let pass = 0;
let fail = 0;

function assert(name, cond, detail) {
  if (cond) {
    console.log(`✓ ${name}`);
    pass++;
  } else {
    console.error(`✗ ${name} — ${detail ?? ""}`);
    fail++;
  }
}

async function readSrc(p) {
  return readFile(resolve(root, p), "utf8");
}

const theme = await readSrc("src/modules/ui/theme.ts");
const css = await readSrc("src/app/globals.css");

// 1) TS 상수
const seedsMatch = theme.match(
  /PARTICIPANT_HUE_SEEDS\s*=\s*\[\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\]/,
);
assert("TS: PARTICIPANT_HUE_SEEDS 5건 추출", !!seedsMatch);
const tsSeeds = seedsMatch ? seedsMatch.slice(1, 6).map(Number) : [];
assert(
  "TS: seeds = [20, 50, 150, 200, 280]",
  JSON.stringify(tsSeeds) === JSON.stringify([20, 50, 150, 200, 280]),
  `actual: ${JSON.stringify(tsSeeds)}`,
);

// 2) PARTICIPANT_HUE_SEED_CSS_VARS export
assert(
  "TS: PARTICIPANT_HUE_SEED_CSS_VARS export 정의됨",
  theme.includes("export const PARTICIPANT_HUE_SEED_CSS_VARS"),
);
for (let i = 1; i <= 5; i += 1) {
  assert(
    `TS: CSS_VARS 항목 "--participant-hue-base-${i}" 포함`,
    theme.includes(`"--participant-hue-base-${i}"`),
  );
}

// 3) globals.css :root 변수
const cssSeeds = [];
for (let i = 1; i <= 5; i += 1) {
  const re = new RegExp(`--participant-hue-base-${i}\\s*:\\s*(\\d+)\\s*;`);
  const m = css.match(re);
  assert(
    `CSS: --participant-hue-base-${i} 정의됨`,
    !!m,
    re.toString(),
  );
  if (m) cssSeeds.push(Number(m[1]));
}

// 4) TS↔CSS 동기
assert(
  "Sync: TS seeds === CSS vars (인덱스 5건 정확 일치)",
  JSON.stringify(tsSeeds) === JSON.stringify(cssSeeds),
  `TS=${JSON.stringify(tsSeeds)} CSS=${JSON.stringify(cssSeeds)}`,
);

console.log(`\n${pass} pass · ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
