#!/usr/bin/env node
// D-D17 (Day 5 11시 슬롯, 2026-04-30) C-D17-11: D-9 다크 모드 콘트라스트 측정 스크립트.
// 입력: src/app/globals.css 의 :root + [data-theme="dark"] 변수.
// 처리: 정의된 페어별 WCAG relative-luminance 콘트라스트 비율 계산.
// 출력: console.table — 라이트/다크 각 페어 ratio + AA(normal) + AA(large) pass/fail.
// 종료: 모든 필수 페어 AA PASS 시 exit 0, 미달 시 exit 1.
// 추정 #88 클로즈: 다크 배경 hex 실측 = #221C03 (yellow-100 다크).

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const cssPath = resolve(projectRoot, "src/app/globals.css");

if (!existsSync(cssPath)) {
  process.stderr.write(`[measure-contrast] globals.css not found: ${cssPath}\n`);
  process.exit(1);
}

const cssText = readFileSync(cssPath, "utf-8");

// :root { ... } 블록과 [data-theme="dark"] { ... } 블록 추출.
// 단일 패스 정규식 — 중첩 셀렉터는 globals.css에 없는 것으로 가정.
function extractBlock(css, selectorRegex) {
  const m = css.match(selectorRegex);
  if (!m) return null;
  const start = m.index + m[0].length;
  // 첫 { 후부터 매칭되는 } 까지 (단순 카운팅).
  let depth = 1;
  let i = start;
  while (i < css.length && depth > 0) {
    if (css[i] === "{") depth += 1;
    else if (css[i] === "}") depth -= 1;
    i += 1;
  }
  return css.slice(start, i - 1);
}

const rootBlock = extractBlock(cssText, /:root\s*\{/);
const darkBlock = extractBlock(cssText, /\[data-theme="dark"\]\s*\{/);

if (!rootBlock || !darkBlock) {
  process.stderr.write(`[measure-contrast] :root or [data-theme="dark"] block missing\n`);
  process.exit(1);
}

// CSS 변수 파싱: --name: value;
function parseVars(block) {
  const vars = {};
  const re = /--([a-z0-9-]+)\s*:\s*([^;]+);/gi;
  let m;
  while ((m = re.exec(block)) !== null) {
    vars[m[1].trim()] = m[2].trim();
  }
  return vars;
}

// alias 1단계 resolve: var(--x) → vars["x"].
// 다른 형태(rgb(...), hsl(...))는 그대로 반환 (현재 globals.css는 hex만 사용).
function resolveValue(raw, vars) {
  const m = raw.match(/^var\(--([a-z0-9-]+)\)$/i);
  if (!m) return raw;
  const referenced = vars[m[1]];
  if (!referenced) return raw;
  return resolveValue(referenced, vars);
}

const rootVars = parseVars(rootBlock);
const darkVars = parseVars(darkBlock);

// hex → {r,g,b} (0-255).
function parseHex(hex) {
  const cleaned = hex.replace(/^#/, "").trim();
  if (cleaned.length === 3) {
    const r = parseInt(cleaned[0] + cleaned[0], 16);
    const g = parseInt(cleaned[1] + cleaned[1], 16);
    const b = parseInt(cleaned[2] + cleaned[2], 16);
    return { r, g, b };
  }
  if (cleaned.length === 6) {
    const r = parseInt(cleaned.slice(0, 2), 16);
    const g = parseInt(cleaned.slice(2, 4), 16);
    const b = parseInt(cleaned.slice(4, 6), 16);
    return { r, g, b };
  }
  throw new Error(`invalid hex: ${hex}`);
}

// WCAG relative luminance.
// https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
function relativeLuminance({ r, g, b }) {
  const toLin = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const R = toLin(r);
  const G = toLin(g);
  const B = toLin(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function contrastRatio(fgHex, bgHex) {
  const L1 = relativeLuminance(parseHex(fgHex));
  const L2 = relativeLuminance(parseHex(bgHex));
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

// 검증할 페어. 각 페어는 라이트/다크 두 모드 모두 측정.
// requiresAaNormal: true → AA normal text 기준 (4.5:1)
// requiresAaLarge:  true → AA large text 기준 (3.0:1)
// requiresUI:       true → UI 컴포넌트 기준 (3.0:1, WCAG 2.1 1.4.11)
// optional:         true → 게이트에서 wave-off (장식 요소 — 보조 정보 전달 X)
//                          단, 측정값은 출력해 디자인 토큰 참고용으로 박힘.
//
// 추정 #88 클로즈: 다크 배경 hex = canvas resolved → yellow-100 → #221C03.
// 페어 선정 사유:
//   ink/ink-dim/accent on canvas: 텍스트 가독성 핵심.
//   ink/ink-dim on yellow-500:    헤더 모드 라벨 border-left + 미래 강조 영역 사전 가드.
//   black on accent:              CTA 버튼 5곳(input-bar/participant-form/api-keys-view/persona-edit-modal/persona-picker-modal)에서 hardcode text-black 사용.
//   divider on canvas:            장식 — optional.
const PAIRS = [
  {
    label: "ink on canvas (본문 텍스트)",
    fg: "robusta-ink",
    bg: "robusta-canvas",
    requiresAaNormal: true,
  },
  {
    label: "ink-dim on canvas (보조 텍스트)",
    fg: "robusta-ink-dim",
    bg: "robusta-canvas",
    requiresAaNormal: true,
  },
  {
    label: "accent on canvas (강조 비텍스트)",
    fg: "robusta-accent",
    bg: "robusta-canvas",
    requiresAaLarge: true,
    optional: true, // streaming-caret 정정 후 실사용 0 — 디자인 참고만.
  },
  {
    label: "black on accent (CTA 텍스트)",
    fg: "#000000",
    bg: "robusta-accent",
    requiresAaNormal: true,
  },
  {
    label: "black on yellow-500 (강조 위 텍스트)",
    fg: "#000000",
    bg: "robusta-yellow-500",
    requiresAaNormal: true,
  },
  {
    label: "divider on canvas (UI 보더 - 장식)",
    fg: "robusta-divider",
    bg: "robusta-canvas",
    requiresUI: true,
    optional: true, // WCAG 1.4.11은 "필수 UI 컴포넌트"에 적용 — 디바이더는 시각 구분선이라 비필수.
  },
];

// PAIRS에서 fg/bg 값이 hex로 직접 박힌 경우(#000000 등) 변수 lookup 회피.
function resolveFromVarsOrHex(key, vars) {
  if (key.startsWith("#")) return { hex: key, name: key };
  const raw = vars[key];
  if (!raw) return null;
  return { hex: resolveValue(raw, vars), name: key };
}

function evaluatePair(pair, vars, mode) {
  const fg = resolveFromVarsOrHex(pair.fg, vars);
  const bg = resolveFromVarsOrHex(pair.bg, vars);
  if (!fg || !bg) {
    return {
      mode,
      label: pair.label,
      ratio: null,
      pass: false,
      optional: pair.optional === true,
      reason: `var missing (${!fg ? pair.fg : pair.bg})`,
    };
  }
  const ratio = contrastRatio(fg.hex, bg.hex);

  let threshold = 0;
  let kind = "—";
  if (pair.requiresAaNormal) {
    threshold = 4.5;
    kind = "AA normal";
  } else if (pair.requiresAaLarge) {
    threshold = 3.0;
    kind = "AA large";
  } else if (pair.requiresUI) {
    threshold = 3.0;
    kind = "UI 1.4.11";
  }
  const pass = ratio >= threshold;
  return {
    mode,
    label: pair.label,
    fg: `${fg.name} (${fg.hex})`,
    bg: `${bg.name} (${bg.hex})`,
    ratio: ratio.toFixed(2),
    threshold,
    kind,
    pass,
    optional: pair.optional === true,
  };
}

const results = [];
for (const pair of PAIRS) {
  results.push(evaluatePair(pair, rootVars, "light"));
  results.push(evaluatePair(pair, darkVars, "dark"));
}

// 출력.
process.stdout.write("\n[measure-contrast] D-9 다크 모드 콘트라스트 측정 (WCAG)\n");
process.stdout.write(`  light vars: ${Object.keys(rootVars).length}\n`);
process.stdout.write(`  dark vars : ${Object.keys(darkVars).length}\n\n`);

const printable = results.map((r) => ({
  mode: r.mode,
  label: r.label,
  ratio: r.ratio,
  threshold: r.threshold,
  kind: r.kind,
  result: r.pass ? "PASS" : r.optional ? "SKIP (optional)" : "FAIL",
}));
console.table(printable);

const requiredFailed = results.filter((r) => !r.pass && !r.optional);
const optionalFailed = results.filter((r) => !r.pass && r.optional);

if (optionalFailed.length > 0) {
  process.stdout.write(`\n[measure-contrast] optional 페어 ${optionalFailed.length}건 미달 (게이트 wave-off):\n`);
  for (const f of optionalFailed) {
    process.stdout.write(
      `  - [${f.mode}] ${f.label} → ratio ${f.ratio} < ${f.threshold} (${f.kind ?? "?"}) — 장식 영역, 게이트 무시\n`,
    );
  }
}

if (requiredFailed.length > 0) {
  process.stdout.write(`\n[measure-contrast] 필수 페어 ${requiredFailed.length}건 미달:\n`);
  for (const f of requiredFailed) {
    process.stdout.write(
      `  - [${f.mode}] ${f.label} → ratio ${f.ratio} < ${f.threshold} (${f.kind ?? "?"})\n`,
    );
  }
  process.exit(1);
}

const requiredPassed = results.filter((r) => r.pass && !r.optional).length;
const requiredTotal = results.filter((r) => !r.optional).length;
process.stdout.write(
  `\n[measure-contrast] 필수 ${requiredPassed}/${requiredTotal} 페어 AA PASS (optional ${optionalFailed.length}건 wave-off)\n`,
);
process.exit(0);
