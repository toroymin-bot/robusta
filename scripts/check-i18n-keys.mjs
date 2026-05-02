#!/usr/bin/env node
/**
 * check-i18n-keys.mjs
 *   - C-D21-1 (D6 15시 슬롯, 2026-05-01) — i18n 키 회귀 가드.
 *
 * 동작:
 *   1) src/modules/i18n/messages.ts 를 정적 파싱 → ko / en dict 키 집합 추출.
 *   2) src/ 전체 .ts/.tsx 에서 `t("X.Y")`/`t('X.Y')` 호출 정규식 매칭 → 사용 키 집합 수집.
 *   3) 검증:
 *        a) 사용 키가 ko 에 없음 → ERROR (orphan reference)
 *        b) 사용 키가 ko 에 있으나 en 에 없음 → ERROR (locale parity)
 *        c) ko 에는 있으나 en 에 없음(또는 반대) → WARN (정의 비대칭)
 *        d) 정의된 키 중 어디서도 사용 안 됨 → 정보(unused) — exit 영향 없음.
 *
 * 의존성: node 표준만. Confluence Do 페이지 #11 모바일/PC 일관성 + 한/영 모두 보장.
 *
 * 사용:
 *   node scripts/check-i18n-keys.mjs
 *   node scripts/check-i18n-keys.mjs --verbose
 */

import { readFile, readdir } from "node:fs/promises";
import { resolve, join, relative } from "node:path";

const root = resolve(process.cwd());
const verbose = process.argv.includes("--verbose");

async function walkSrc(dir) {
  const out = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...(await walkSrc(p)));
    } else if (/\.(ts|tsx)$/.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

/**
 * messages.ts 를 정규식 파싱해서 { ko: Set<string>, en: Set<string> } 반환.
 *  - JS 평가 없이 안전하게 키만 추출.
 *  - 블록 단위(`ko: { ... }` / `en: { ... }`) 안의 `"key": ...` 만 매칭.
 */
function extractDictKeys(source) {
  const blocks = { ko: new Set(), en: new Set() };
  for (const locale of ["ko", "en"]) {
    const re = new RegExp(`${locale}\\s*:\\s*\\{`, "g");
    const m = re.exec(source);
    if (!m) continue;
    let depth = 1;
    let i = re.lastIndex;
    const start = i;
    while (i < source.length && depth > 0) {
      const ch = source[i];
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
      i++;
    }
    const block = source.slice(start, i - 1);
    // 키만 추출: 줄 시작/공백 후 "key": 패턴.
    const keyRe = /^[\t ]*"([a-zA-Z0-9_.-]+)"\s*:/gm;
    let km;
    while ((km = keyRe.exec(block)) !== null) {
      blocks[locale].add(km[1]);
    }
  }
  return blocks;
}

/** src/ 의 ts/tsx 에서 t("X")/t('X') 사용 키 추출. */
function extractUsedKeys(srcText) {
  const used = new Set();
  // t("…") 또는 t('…'). 1번째 인자가 동적 표현이면 매칭 못함(허용).
  const re = /\bt\(\s*["']([a-zA-Z0-9_.-]+)["']/g;
  let m;
  while ((m = re.exec(srcText)) !== null) used.add(m[1]);
  return used;
}

const messagesPath = "src/modules/i18n/messages.ts";
const messagesSrc = await readFile(resolve(root, messagesPath), "utf8");
const dict = extractDictKeys(messagesSrc);
if (dict.ko.size === 0 || dict.en.size === 0) {
  console.error(
    `✗ messages.ts 파싱 실패 — ko=${dict.ko.size}, en=${dict.en.size}`,
  );
  process.exit(2);
}

// C-D27-1 (D6 15시 슬롯, 2026-05-02) — catalog 5 namespace lazy chunk parity 게이트.
//   messages-catalog-{ko,en}.ts 양면 키 100% 일치 검증. 미달 시 build fail.
function extractCatalogKeys(source) {
  const keys = new Set();
  const re = /^[\t ]*"([a-zA-Z0-9_.-]+)"\s*:/gm;
  let m;
  while ((m = re.exec(source)) !== null) keys.add(m[1]);
  return keys;
}
const catalogKoSrc = await readFile(
  resolve(root, "src/modules/i18n/messages-catalog-ko.ts"),
  "utf8",
);
const catalogEnSrc = await readFile(
  resolve(root, "src/modules/i18n/messages-catalog-en.ts"),
  "utf8",
);
const catalogKo = extractCatalogKeys(catalogKoSrc);
const catalogEn = extractCatalogKeys(catalogEnSrc);
const catalogErrors = [];
for (const k of catalogKo) {
  if (!catalogEn.has(k)) catalogErrors.push(`CATALOG-MISSING-EN: "${k}"`);
}
for (const k of catalogEn) {
  if (!catalogKo.has(k)) catalogErrors.push(`CATALOG-MISSING-KO: "${k}"`);
}
console.log(
  `[i18n catalog] ko ${catalogKo.size} / en ${catalogEn.size} (parity ${catalogErrors.length === 0 ? "PASS" : "FAIL"})`,
);
if (catalogErrors.length > 0) {
  console.error(`\n✗ catalog parity 오류 ${catalogErrors.length}건:`);
  for (const e of catalogErrors) console.error(`  · ${e}`);
  process.exit(1);
}

// catalog 키는 본 검증 단계에서 dict.* 에 합산 (사용 키 검증 호환).
for (const k of catalogKo) dict.ko.add(k);
for (const k of catalogEn) dict.en.add(k);

const files = await walkSrc(resolve(root, "src"));
const allUsed = new Set();
for (const f of files) {
  if (f.endsWith("messages.ts")) continue;
  const text = await readFile(f, "utf8");
  const used = extractUsedKeys(text);
  if (verbose && used.size > 0) {
    console.log(`  · ${relative(root, f)}: ${used.size} keys`);
  }
  for (const k of used) allUsed.add(k);
}

const errors = [];
const warns = [];

// (a) 사용 → ko 미정의
for (const k of allUsed) {
  if (!dict.ko.has(k)) errors.push(`MISSING-KO: t("${k}") 호출되나 ko 사전에 없음`);
}
// (b) 사용 → en 미정의
for (const k of allUsed) {
  if (dict.ko.has(k) && !dict.en.has(k))
    errors.push(`MISSING-EN: t("${k}") 호출되나 en 사전에 없음`);
}
// (c) ko/en 비대칭 (사용 여부 무관) — 정의 비대칭은 WARN
for (const k of dict.ko) {
  if (!dict.en.has(k)) warns.push(`ASYMMETRIC: ko has "${k}", en lacks`);
}
for (const k of dict.en) {
  if (!dict.ko.has(k)) warns.push(`ASYMMETRIC: en has "${k}", ko lacks`);
}

if (verbose) {
  const unused = [...dict.ko].filter((k) => !allUsed.has(k));
  if (unused.length > 0) {
    console.log(`\n[info] 정의되었으나 t() 호출 흔적 없음 — ${unused.length}건`);
    for (const k of unused) console.log(`  · ${k}`);
  }
}

console.log(
  `\n[i18n] 사용 키 ${allUsed.size}개 / ko ${dict.ko.size}개 / en ${dict.en.size}개`,
);
if (warns.length > 0) {
  console.log(`\n⚠ 경고 ${warns.length}건:`);
  for (const w of warns) console.log(`  · ${w}`);
}
if (errors.length > 0) {
  console.error(`\n✗ 오류 ${errors.length}건:`);
  for (const e of errors) console.error(`  · ${e}`);
  process.exit(1);
}

console.log(`\n✓ i18n 키 회귀 가드 PASS — 사용된 모든 키가 ko/en 양쪽에 등록됨.`);
