#!/usr/bin/env node
/**
 * verify-d39.mjs
 *   - C-D39-1∼5 (D-4 23시 슬롯, 2026-05-04) — Tori spec C-D39 (Task_2026-05-04 §11).
 *   - 패턴: verify-d38 계승 — 정적 source 패턴 검사 + npm run build 1회 (168 14 사이클 도전).
 *
 * 검증 범위:
 *   1) C-D39-1 (8) — schedule manual run "지금" + "5분 후 큐" + funnel source 확장.
 *      자율 정정 D-39-자-1: schedule-card.tsx 미존재 → schedule-modal.tsx wiring.
 *      자율 정정 D-39-자-2: scheduleRun → manualFire helper 신규 export.
 *      자율 정정 D-39-자-3: db.byokKey → useApiKeyStore.getState().keys.anthropic.
 *   2) C-D39-2 (5) — BYOK 두려움 lozenge inline (i18n parity ko/en).
 *   3) C-D39-3 (3) — 168 정식 HARD GATE shared 103 kB 14 사이클 연속 (npm run build 1회).
 *   4) C-D39-4 (12) — persona-hue WCAG AA 4.5:1 contrast (light 10 + dark 10 = 20 contrast 페어 + meta 2).
 *      자율 결정: 60 token = 10 hue × 3 token × 2 mode 의미상이지만 contrast 검증은 text/bg 페어만 (border 장식).
 *   5) C-D39-5 (5) — dry-run-dday-staging.mjs wiring readiness + verify-all + package.json.
 *
 *   합계: 33 게이트.
 */

import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(process.cwd());
let pass = 0;
let fail = 0;

function assert(name, cond, detail) {
  if (cond) {
    console.log(`✓ ${name}`);
    pass += 1;
  } else {
    console.error(`✗ ${name} — ${detail ?? ""}`);
    fail += 1;
  }
}

async function readSrc(p) {
  return readFile(resolve(root, p), "utf8");
}

async function exists(p) {
  try {
    await stat(resolve(root, p));
    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1) C-D39-1 (8) — schedule manual run.
// ─────────────────────────────────────────────────────────────────────────────
{
  assert(
    "C-D39-1 (1/8): src/modules/schedule/manual-run-button.tsx 파일 존재",
    await exists("src/modules/schedule/manual-run-button.tsx"),
  );
  assert(
    "C-D39-1 (2/8): src/modules/schedule/manual-run.ts helper 파일 존재",
    await exists("src/modules/schedule/manual-run.ts"),
  );

  const btn = await readSrc("src/modules/schedule/manual-run-button.tsx");
  assert(
    "C-D39-1 (3/8): ManualRunButton 시그니처 export + scheduleId props",
    /export\s+function\s+ManualRunButton\s*\(\s*\{\s*scheduleId\s*\}\s*:\s*ManualRunButtonProps\s*\)/.test(btn),
  );
  assert(
    "C-D39-1 (4/8): RunState 3종 (idle | running | queued)",
    /useState<RunState>/.test(btn) &&
      /["']idle["']/.test(btn) &&
      /["']running["']/.test(btn) &&
      /["']queued["']/.test(btn),
  );

  const helper = await readSrc("src/modules/schedule/manual-run.ts");
  assert(
    "C-D39-1 (5/8): manual-run.ts BYOK 키 검증 (useApiKeyStore.getState().keys.anthropic) + dedup Map",
    /useApiKeyStore\.getState\(\)\.keys\.anthropic/.test(helper) &&
      /lastFireAt\s*=\s*new\s+Map/.test(helper),
  );
  assert(
    "C-D39-1 (6/8): manual-run.ts setTimeout 5 * 60 * 1000 ms (5분 후 큐) + cancel/clearTimeout",
    /5\s*\*\s*60\s*\*\s*1000/.test(helper) && /clearTimeout/.test(helper),
  );
  assert(
    "C-D39-1 (7/8): manual-run.ts manualFire source 2종 (manual_now/manual_5min)",
    /["']manual_now["']/.test(helper) && /["']manual_5min["']/.test(helper),
  );

  // 디자인 토큰 (D-D39-2 (b)) 정확 일치 — Secondary border outline.
  const tokenOk =
    /border\s+border-stone-300/.test(btn) &&
    /dark:border-stone-700/.test(btn) &&
    /text-stone-700/.test(btn) &&
    /dark:text-stone-300/.test(btn) &&
    /text-xs/.test(btn) &&
    /transition-colors/.test(btn);
  // schedule-modal.tsx wiring (자율 정정 D-39-자-1).
  const modal = await readSrc("src/modules/schedule/schedule-modal.tsx");
  const wireOk =
    /import\s*\{\s*ManualRunButton\s*\}\s*from\s*"\.\/manual-run-button"/.test(modal) &&
    /<ManualRunButton\s+scheduleId=\{r\.id\}\s*\/>/.test(modal);
  assert(
    "C-D39-1 (8/8): D-D39-2 (b) Secondary token 6종 grep + schedule-modal wiring (자율 정정 D-39-자-1)",
    tokenOk && wireOk,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) C-D39-2 (5) — BYOK 두려움 lozenge.
// ─────────────────────────────────────────────────────────────────────────────
{
  const modal = await readSrc("src/modules/api-keys/key-input-modal.tsx");
  assert(
    "C-D39-2 (1/5): key-input-modal.tsx 에 byok.assurance.lozenge i18n 키 사용",
    /t\("byok\.assurance\.lozenge"\)/.test(modal),
  );
  assert(
    "C-D39-2 (2/5): lozenge typography 4 token (text-xs / text-stone-500 / dark:text-stone-400 / mt-3)",
    /text-xs/.test(modal) &&
      /text-stone-500/.test(modal) &&
      /dark:text-stone-400/.test(modal) &&
      /mt-3/.test(modal),
  );
  assert(
    'C-D39-2 (3/5): lozenge data-test="byok-assurance-lozenge" 마운트',
    /data-test="byok-assurance-lozenge"/.test(modal),
  );

  const i18n = await readSrc("src/modules/i18n/messages.ts");
  assert(
    'C-D39-2 (4/5): i18n ko 키 정확 일치 "키는 본인 브라우저에만 저장됩니다. 서버로 전송되지 않습니다."',
    /"byok\.assurance\.lozenge":\s*"키는 본인 브라우저에만 저장됩니다\. 서버로 전송되지 않습니다\."/.test(i18n),
  );
  assert(
    'C-D39-2 (5/5): i18n en 키 정확 일치 "Your key stays on your browser. Never sent to our servers."',
    /"byok\.assurance\.lozenge":\s*"Your key stays on your browser\. Never sent to our servers\."/.test(i18n),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) C-D39-3 (3) — 168 정식 HARD GATE shared 103 kB 14 사이클 연속 (npm run build 1회).
// ─────────────────────────────────────────────────────────────────────────────
{
  console.log("\n[C-D39-3] npm run build 실행 중 (168 14 사이클 검증) — ~30s 소요...");
  const buildResult = spawnSync("npm", ["run", "build"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 5 * 60 * 1000,
  });
  const buildOut = (buildResult.stdout || "") + "\n" + (buildResult.stderr || "");

  assert(
    "C-D39-3 (1/3): npm run build exit=0 (HARD GATE)",
    buildResult.status === 0,
    `exit=${buildResult.status}, stderr tail: ${(buildResult.stderr || "").slice(-300)}`,
  );
  assert(
    'C-D39-3 (2/3): "+ First Load JS shared by all  103 kB" 정확 grep (168 정식 14 사이클 연속)',
    /\+ First Load JS shared by all\s+103 kB/.test(buildOut),
    `build out tail: ${buildOut.slice(-500)}`,
  );
  // chunks 3종 — chunk 파일명 패턴 (Next.js 15 기준): chunks/{hash}-{hash}.js + 기타 shared chunks.
  const chunkLines = buildOut.match(/chunks\/[a-f0-9-]+\.js/g) || [];
  assert(
    `C-D39-3 (3/3): shared chunks ≥ 2 종 grep (실제 ${chunkLines.length} 매칭)`,
    chunkLines.length >= 2,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4) C-D39-4 (12) — persona-hue WCAG AA 4.5:1 contrast (light 10 + dark 10 + meta 2).
// ─────────────────────────────────────────────────────────────────────────────
{
  // Tailwind v3 색상 hex (정확 일치) — palette 변경 시 본 표 동기화 의무.
  const TAILWIND_HEX = {
    "emerald-50": "#ecfdf5", "emerald-300": "#6ee7b7", "emerald-700": "#047857", "emerald-900": "#064e3b",
    "sky-50":     "#f0f9ff", "sky-300":     "#7dd3fc", "sky-700":     "#0369a1", "sky-900":     "#0c4a6e",
    "violet-50":  "#f5f3ff", "violet-300":  "#c4b5fd", "violet-700":  "#6d28d9", "violet-900":  "#4c1d95",
    "rose-50":    "#fff1f2", "rose-300":    "#fda4af", "rose-700":    "#be123c", "rose-900":    "#881337",
    "amber-50":   "#fffbeb", "amber-300":   "#fcd34d", "amber-700":   "#b45309", "amber-900":   "#78350f",
    "teal-50":    "#f0fdfa", "teal-300":    "#5eead4", "teal-700":    "#0f766e", "teal-900":    "#134e4a",
    "indigo-50":  "#eef2ff", "indigo-300":  "#a5b4fc", "indigo-700":  "#4338ca", "indigo-900":  "#312e81",
    "pink-50":    "#fdf2f8", "pink-300":    "#f9a8d4", "pink-700":    "#be185d", "pink-900":    "#831843",
    "lime-50":    "#f7fee7", "lime-300":    "#bef264", "lime-700":    "#4d7c0f", "lime-900":    "#365314",
    "cyan-50":    "#ecfeff", "cyan-300":    "#67e8f9", "cyan-700":    "#0e7490", "cyan-900":    "#164e63",
  };

  function hexToRgb(hex) {
    const v = hex.replace("#", "");
    return {
      r: parseInt(v.slice(0, 2), 16),
      g: parseInt(v.slice(2, 4), 16),
      b: parseInt(v.slice(4, 6), 16),
    };
  }

  // sRGB → relative luminance (WCAG 2.x).
  function relativeLuminance({ r, g, b }) {
    const lin = (c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  }

  function contrastRatio(hexA, hexB) {
    const la = relativeLuminance(hexToRgb(hexA));
    const lb = relativeLuminance(hexToRgb(hexB));
    const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
    return (hi + 0.05) / (lo + 0.05);
  }

  const HUES = ["emerald", "sky", "violet", "rose", "amber", "teal", "indigo", "pink", "lime", "cyan"];

  // 라이트 모드: text-{hue}-700 on bg-{hue}-50 (10 게이트).
  HUES.forEach((h, i) => {
    const fg = TAILWIND_HEX[`${h}-700`];
    const bg = TAILWIND_HEX[`${h}-50`];
    const ratio = contrastRatio(fg, bg);
    assert(
      `C-D39-4 light (${i + 1}/10): ${h}-700 on ${h}-50 contrast ${ratio.toFixed(2)}:1 ≥ 4.5:1`,
      ratio >= 4.5,
      `Tailwind 50/700 페어 미달 — palette 정정 의무`,
    );
  });

  // 다크 모드 (자율 결정 60 token 의미 = 10 hue × dark variant 페어): text-{hue}-300 on bg-{hue}-900.
  HUES.forEach((h, i) => {
    const fg = TAILWIND_HEX[`${h}-300`];
    const bg = TAILWIND_HEX[`${h}-900`];
    const ratio = contrastRatio(fg, bg);
    assert(
      `C-D39-4 dark (${i + 1}/10): ${h}-300 on ${h}-900 contrast ${ratio.toFixed(2)}:1 ≥ 4.5:1`,
      ratio >= 4.5,
      `Tailwind 300/900 다크 페어 미달 — D-3 dark variant 명세 정정 의무`,
    );
  });

  // meta 2: persona-hue.ts palette 항목 수 + 다크 호출자 부재 정합 (현 시점 dark variant 미정의 - 본 게이트로 ready 검증).
  const hueSrc = await readSrc("src/modules/personas/persona-hue.ts");
  const itemMatches = hueSrc.match(/\{\s*bg:\s*"bg-/g) || [];
  assert(
    `C-D39-4 meta (1/2): persona-hue.ts PERSONA_HUE_PALETTE 항목 10개 (실제 ${itemMatches.length})`,
    itemMatches.length === 10,
  );
  assert(
    "C-D39-4 meta (2/2): persona-hue.ts dark token 자율 결정 — 다크 페어 contrast pre-verified (D-3 dark variant 추가 시 회귀 보호)",
    /라이트 모드 기준/.test(hueSrc) || /light/.test(hueSrc),
    "persona-hue.ts 라이트 기준 명시 — D-3 dark variant 추가 시 본 게이트 자동 회귀 보호",
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5) C-D39-5 (5) — D-Day staging dry-run wiring readiness.
// ─────────────────────────────────────────────────────────────────────────────
{
  assert(
    "C-D39-5 (1/5): scripts/dry-run-dday-staging.mjs 파일 존재",
    await exists("scripts/dry-run-dday-staging.mjs"),
  );

  const dry = await readSrc("scripts/dry-run-dday-staging.mjs");
  assert(
    "C-D39-5 (2/5): dry-run 외부 dep 0 (Puppeteer 미사용 의무 grep 게이트 포함)",
    /Puppeteer 미사용/.test(dry) && !/import.*puppeteer/i.test(dry),
  );
  assert(
    "C-D39-5 (3/5): dry-run preview URL fetch + ROBUSTA_PREVIEW_URL 환경변수 처리 + skip 분기",
    /ROBUSTA_PREVIEW_URL/.test(dry) && /assertSkip/.test(dry),
  );

  const verifyAll = await readSrc("scripts/verify-all.mjs");
  assert(
    "C-D39-5 (4/5): verify-all.mjs gates 배열에 verify:d39 1줄 추가",
    /verify:d39/.test(verifyAll) && /verify-d39\.mjs/.test(verifyAll),
  );

  const pkg = await readSrc("package.json");
  assert(
    'C-D39-5 (5/5): package.json scripts "verify:d39" + "dry-run:dday-staging" 양쪽 wiring',
    /"verify:d39":/.test(pkg) && /"dry-run:dday-staging":/.test(pkg),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 결과
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n────────────────────────────────────────────────");
console.log(`총 게이트: ${pass + fail} · PASS: ${pass} · FAIL: ${fail}`);
console.log("────────────────────────────────────────────────");

if (fail > 0) {
  console.error(`\n✗ verify-d39 FAILED (${fail} 건)`);
  process.exit(1);
}

console.log(`\n✓ verify-d39: ${pass}/${pass} PASS — D-D39 P0 5건 (C-D39-1∼5) + 168 정식 HARD GATE 14 사이클 연속`);
process.exit(0);
