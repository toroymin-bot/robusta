#!/usr/bin/env node
/**
 * check-catalog-isolation.mjs
 *   - C-D28-자-1 (D6 19시 자율 슬롯, 2026-05-02) — 꼬미 자체 결정.
 *   - verify-d27 §1 의 catalog 정적 import 가드(workspace + header-cluster 2개)를
 *     모든 메인 번들 모듈로 자동 확장. Spec 005~011 신규 모듈 추가 시 회귀 0 보장.
 *
 * 검증 규칙:
 *   1) `@/modules/i18n/catalog-i18n` 정적 import → lazy 화이트리스트 외 0
 *   2) `@/modules/i18n/messages-catalog-(ko|en)` 정적 import → catalog 본체 외 0
 *   3) catalog 키 5 prefix 정적 사용 ("persona.catalog.", "scenario.<id>",
 *      "pdfExport.", "devMode.", "persona.picker.tab.") → lazy + catalog 본체 외 0
 *   4) catalog 메타 모듈 (`@/modules/personas/persona-catalog`,
 *      `@/modules/scenarios/scenario-catalog`) 정적 import → lazy + 메타 본체 외 0
 *      (메인 번들 모듈이 catalog 메타를 직접 참조하면 lazy chunk 분리 의도가 깨짐)
 *
 * 화이트리스트:
 *   LAZY (11): persona-catalog-card / persona-from-preset / persona-picker-modal /
 *              scenario-pick / scenario-card / welcome-view / pdf-export-dialog /
 *              header-pdf-button / dev-mode-strip / persona-catalog / scenario-catalog
 *   CATALOG_INTERNAL (4): catalog-i18n / i18n / messages-catalog-ko / messages-catalog-en
 *
 * 의존성 0 — node 표준만. 어휘 룰 준수 (저급 어휘 0).
 */

import { readFile, readdir, stat } from "node:fs/promises";
import { resolve, relative, join, sep } from "node:path";

const root = resolve(process.cwd());
const SRC = resolve(root, "src");

// ─────────────────────────────────────────────────────────────────────────────
// 화이트리스트 (POSIX 경로, src 기준)
// ─────────────────────────────────────────────────────────────────────────────

const LAZY = new Set([
  "modules/personas/persona-catalog-card.tsx",
  "modules/personas/persona-from-preset.ts",
  "modules/personas/persona-picker-modal.tsx",
  "modules/scenarios/scenario-pick.ts",
  "modules/scenarios/scenario-card.tsx",
  "modules/scenarios/welcome-view.tsx",
  "modules/export/pdf-export-dialog.tsx",
  "modules/conversation/header-pdf-button.tsx",
  "modules/conversation/dev-mode-strip.tsx",
  // catalog 메타 본체 — lazy chunk 의 일부로 흡수.
  "modules/personas/persona-catalog.ts",
  "modules/scenarios/scenario-catalog.ts",
]);

const CATALOG_INTERNAL = new Set([
  "modules/i18n/catalog-i18n.ts",
  "modules/i18n/i18n.ts",
  "modules/i18n/messages-catalog-ko.ts",
  "modules/i18n/messages-catalog-en.ts",
]);

// ─────────────────────────────────────────────────────────────────────────────
// 패턴
// ─────────────────────────────────────────────────────────────────────────────

const RE_IMPORT_CATALOG_I18N =
  /from\s+["']@\/modules\/i18n\/catalog-i18n["']/;
const RE_IMPORT_CATALOG_BODY =
  /from\s+["']@\/modules\/i18n\/messages-catalog-(?:ko|en)["']/;
const RE_CATALOG_KEYS =
  /["'](persona\.catalog\.|scenario\.[a-zA-Z][a-zA-Z0-9-]*|pdfExport\.|devMode\.|persona\.picker\.tab\.)/;
const RE_IMPORT_CATALOG_META =
  /from\s+["']@\/modules\/(?:personas\/persona-catalog|scenarios\/scenario-catalog)["']/;

// ─────────────────────────────────────────────────────────────────────────────
// 파일 트리 순회 (의존성 0)
// ─────────────────────────────────────────────────────────────────────────────

async function* walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      yield* walk(p);
    } else if (e.isFile() && /\.(ts|tsx)$/.test(e.name)) {
      yield p;
    }
  }
}

function toPosix(p) {
  return p.split(sep).join("/");
}

function findLineNumber(src, regex) {
  const lines = src.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    if (regex.test(lines[i])) return i + 1;
  }
  return -1;
}

// ─────────────────────────────────────────────────────────────────────────────
// 메인
// ─────────────────────────────────────────────────────────────────────────────

const violations = [];
let scanned = 0;

for await (const abs of walk(SRC)) {
  const relSrc = toPosix(relative(SRC, abs));
  scanned += 1;
  const src = await readFile(abs, "utf8");

  // 룰 1: catalog-i18n 정적 import → LAZY ∪ CATALOG_INTERNAL 외 0
  if (RE_IMPORT_CATALOG_I18N.test(src)) {
    if (!LAZY.has(relSrc) && !CATALOG_INTERNAL.has(relSrc)) {
      violations.push({
        rule: "catalog-i18n-static-import",
        file: relSrc,
        line: findLineNumber(src, RE_IMPORT_CATALOG_I18N),
        detail:
          'from "@/modules/i18n/catalog-i18n" 정적 import — 메인 번들 진입 위험. dynamic import() 사용 권장.',
      });
    }
  }

  // 룰 2: messages-catalog-(ko|en) 정적 import → CATALOG_INTERNAL 외 0
  if (RE_IMPORT_CATALOG_BODY.test(src)) {
    if (!CATALOG_INTERNAL.has(relSrc)) {
      violations.push({
        rule: "catalog-body-static-import",
        file: relSrc,
        line: findLineNumber(src, RE_IMPORT_CATALOG_BODY),
        detail:
          'from "@/modules/i18n/messages-catalog-(ko|en)" 정적 import — catalog 본체 외 차단. catalog-i18n.ts 의 tc() 또는 i18n.ts 의 loadCatalog() 경유.',
      });
    }
  }

  // 룰 3: catalog 키 정적 사용 → LAZY ∪ CATALOG_INTERNAL 외 0
  if (RE_CATALOG_KEYS.test(src)) {
    if (!LAZY.has(relSrc) && !CATALOG_INTERNAL.has(relSrc)) {
      violations.push({
        rule: "catalog-key-static-usage",
        file: relSrc,
        line: findLineNumber(src, RE_CATALOG_KEYS),
        detail:
          'catalog 키 5 prefix (persona.catalog. / scenario.<id> / pdfExport. / devMode. / persona.picker.tab.) 정적 사용 — t() 호출 시 메인 번들에 catalog 의존 흡수. tc() lazy 호출자에서만 사용.',
      });
    }
  }

  // 룰 4: catalog 메타 모듈 (persona-catalog / scenario-catalog) 정적 import → LAZY 외 0
  if (RE_IMPORT_CATALOG_META.test(src)) {
    if (!LAZY.has(relSrc)) {
      violations.push({
        rule: "catalog-meta-static-import",
        file: relSrc,
        line: findLineNumber(src, RE_IMPORT_CATALOG_META),
        detail:
          'catalog 메타 모듈 (persona-catalog / scenario-catalog) 정적 import — lazy chunk 분리 의도 위반. dynamic import() 또는 LAZY 화이트리스트 모듈에서만 사용.',
      });
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 결과
// ─────────────────────────────────────────────────────────────────────────────

console.log(
  `[check-catalog-isolation] scanned ${scanned} files (LAZY ${LAZY.size} / CATALOG_INTERNAL ${CATALOG_INTERNAL.size})`,
);

if (violations.length === 0) {
  console.log("✓ catalog isolation OK — 메인 번들 catalog 의존 0건");
  process.exit(0);
}

console.error(`\n✗ catalog isolation 위반 ${violations.length}건:`);
for (const v of violations) {
  console.error(
    `  [${v.rule}] ${v.file}${v.line > 0 ? `:${v.line}` : ""}\n    ${v.detail}`,
  );
}
process.exit(1);
