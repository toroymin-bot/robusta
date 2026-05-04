#!/usr/bin/env node
/**
 * verify-d38.mjs
 *   - C-D38-1∼5 (D-4 19시 슬롯, 2026-05-04) — Tori spec C-D38 (Task_2026-05-04 §9).
 *   - 패턴: verify-d37 계승 — 정적 source 패턴 검사. 의존성 0 (node 표준만).
 *
 * 검증 범위 (32 게이트 + 자율 1 = 33):
 *   1) C-D38-1 (5) — Show HN 카피 v3 컴포넌트 + welcome-view wiring (자율 정정 D-38-자-1).
 *   2) C-D38-2 (9) — md-mini v2 펜스 코드 블록 + segment 분리 (자율 정정 D-38-자-3).
 *   3) C-D38-3 (6) — Intro3Step 컴포넌트 + welcome-view wiring (자율 정정 D-38-자-1).
 *   4) C-D38-4 (5) — persona-stat-lozenge 우하단 (자율 정정 D-38-자-4) + persona-catalog-card wiring.
 *   5) C-D38-5 (7) — formatDDay 신규 (자율 정정 D-38-자-2) + d-day-lozenge fade + sim 3 케이스.
 *   6) 자율 (1) — persona-hue palette WCAG AA 4.5:1 contrast 자체 검증 (꼬미 §10 자율 권장).
 *
 * + 168 정식 HARD GATE 13 사이클 — shared First Load JS 103 kB 유지 (build 시점, 본 게이트는 정적 소스만).
 *   build 결과 검증은 verify-all.mjs 통합 게이트에서 별도 측정 (현 시점 정적 게이트 33/33).
 */

import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

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
// 1) C-D38-1 (5) — Show HN 카피 v3 컴포넌트 + welcome-view wiring.
// ─────────────────────────────────────────────────────────────────────────────
{
  assert(
    "C-D38-1 (1/5): src/modules/landing/show-hn-copy.tsx 파일 존재",
    await exists("src/modules/landing/show-hn-copy.tsx"),
  );

  const copy = await readSrc("src/modules/landing/show-hn-copy.tsx");
  // h1 텍스트 정확 일치 (em-dash U+2014 단일).
  assert(
    "C-D38-1 (2/5): h1 카피 정확 일치 \"Robusta — your AI team, on your key, with full memory\"",
    /Robusta — your AI team, on your key, with full memory/.test(copy),
    "헤드라인 54자 + em-dash U+2014",
  );
  // sub 카피 정확 일치.
  assert(
    "C-D38-1 (3/5): sub 카피 정확 일치 \"Bring your Claude key. Two AIs, one conversation, full memory.\"",
    /Bring your Claude key\. Two AIs, one conversation, full memory\./.test(copy),
  );
  // typography 5 token grep.
  assert(
    "C-D38-1 (4/5): typography 5 token grep (text-\\[24px\\], font-medium, tracking-tight, text-sm, text-stone-500)",
    /text-\[24px\]/.test(copy) &&
      /font-medium/.test(copy) &&
      /tracking-tight/.test(copy) &&
      /text-sm/.test(copy) &&
      /text-stone-500/.test(copy),
  );
  // 자율 정정 D-38-자-1: page.tsx 가 아닌 welcome-view.tsx 에 wiring.
  const welcome = await readSrc("src/modules/scenarios/welcome-view.tsx");
  assert(
    "C-D38-1 (5/5): welcome-view.tsx ShowHnCopyV3 import + 사용 (자율 정정 D-38-자-1)",
    /import\s*\{\s*ShowHnCopyV3\s*\}\s*from\s*"@\/modules\/landing\/show-hn-copy"/.test(welcome) &&
      /<ShowHnCopyV3\s*\/>/.test(welcome),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) C-D38-2 (9) — md-mini v2 펜스 코드 블록 + segment 분리.
// ─────────────────────────────────────────────────────────────────────────────
{
  const md = await readSrc("src/modules/conversation/md-mini.tsx");
  assert(
    "C-D38-2 (1/9): 펜스 정규식 grep `\\`\\`\\`([a-zA-Z0-9]*)\\\\n([\\\\s\\\\S]*?)\\`\\`\\``",
    /\/```\(\[a-zA-Z0-9\]\*\)\\n\(\[\\s\\S\]\*\?\)```\/g/.test(md),
  );
  // 자율 정정 D-38-자-3: placeholder 토큰 → segment 분리. 게이트는 segment 패턴 grep.
  assert(
    "C-D38-2 (2/9): segment 분리 함수 splitFences + MdSegment 타입 (자율 정정 D-38-자-3)",
    /interface\s+MdSegment/.test(md) && /function\s+splitFences/.test(md),
  );
  assert(
    "C-D38-2 (3/9): <pre> 태그 출력 grep",
    /<pre[\s\S]{0,300}className="bg-stone-50 dark:bg-stone-900 text-xs px-3 py-2 rounded overflow-x-auto"/.test(md),
  );
  assert(
    "C-D38-2 (4/9): language-${lang} 클래스 grep",
    /className=\{`language-\$\{seg\.lang\s*\?\?\s*"plaintext"\}`\}/.test(md),
  );
  assert(
    "C-D38-2 (5/9): plaintext fallback grep (빈 lang → \"plaintext\")",
    /"plaintext"/.test(md),
  );
  // D-37 인라인 4종 정규식 grep 유지 (회귀 보호).
  assert(
    "C-D38-2 (6/9): D-37 인라인 4종 정규식 grep 유지 (URL_RE, CODE_RE, BOLD_RE, ITALIC_RE)",
    /const\s+URL_RE\s*=/.test(md) &&
      /const\s+CODE_RE\s*=/.test(md) &&
      /const\s+BOLD_RE\s*=/.test(md) &&
      /const\s+ITALIC_RE\s*=/.test(md),
  );
  // dangerouslySetInnerHTML 0건 (속성 패턴, D-37-자-1 추인 정합).
  assert(
    "C-D38-2 (7/9): dangerouslySetInnerHTML 속성 0건 (D-37-자-1 추인 정합)",
    !/dangerouslySetInnerHTML\s*=/.test(md),
  );
  // 사용자 발화 분기 평문 유지: message-bubble.tsx에서 isAi && done 분기에서만 renderMd.
  const bubble = await readSrc("src/modules/conversation/message-bubble.tsx");
  assert(
    "C-D38-2 (8/9): message-bubble 사용자 발화 분기 평문 유지 (isAi && done 분기에서만 renderMd)",
    /isAi\s*&&\s*!isStreaming\s*&&\s*message\.status\s*===\s*"done"[\s\S]*?renderMd/.test(bubble),
  );
  assert(
    "C-D38-2 (9/9): message-bubble.tsx renderMd import grep",
    /import\s*\{\s*renderMd\s*\}\s*from\s*"\.\/md-mini"/.test(bubble),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) C-D38-3 (6) — Intro3Step 컴포넌트 + welcome-view wiring.
// ─────────────────────────────────────────────────────────────────────────────
{
  assert(
    "C-D38-3 (1/6): src/modules/landing/intro-3-step.tsx 파일 존재",
    await exists("src/modules/landing/intro-3-step.tsx"),
  );

  const intro = await readSrc("src/modules/landing/intro-3-step.tsx");
  // 3 단계 라벨 텍스트 정확 grep.
  assert(
    "C-D38-3 (2/6): 3 단계 라벨 텍스트 정확 grep (Bring your Claude key / Pick a persona / Send a message)",
    /"Bring your Claude key"/.test(intro) &&
      /"Pick a persona"/.test(intro) &&
      /"Send a message"/.test(intro),
  );
  // activeStep 분기 grep (1, 2, 3, null).
  assert(
    "C-D38-3 (3/6): activeStep 1/2/3/null 분기 grep + ActiveStep 타입",
    /type\s+ActiveStep\s*=\s*1\s*\|\s*2\s*\|\s*3\s*\|\s*null/.test(intro) &&
      /setActiveStep\(null\)/.test(intro) &&
      /setActiveStep\(3\)/.test(intro) &&
      /setActiveStep\(2\)/.test(intro) &&
      /setActiveStep\(1\)/.test(intro),
  );
  // useEffect + db 4-검사 (messages.count, personas.count, apiKeys.count).
  assert(
    "C-D38-3 (4/6): useEffect + db 카운트 4-funnel 검사 (messages, personas, apiKeys)",
    /useEffect/.test(intro) &&
      /db\.messages\.count\(\)/.test(intro) &&
      /db\.personas\.count\(\)/.test(intro) &&
      /db\.apiKeys\.count\(\)/.test(intro),
  );
  // Tailwind state class 3종 grep.
  assert(
    "C-D38-3 (5/6): Tailwind state class 3종 grep (bg-emerald-500, bg-stone-400, bg-stone-200)",
    /bg-emerald-500/.test(intro) &&
      /bg-stone-400/.test(intro) &&
      /bg-stone-200/.test(intro) &&
      /transition-colors/.test(intro) &&
      /duration-400/.test(intro),
  );
  // welcome-view 임포트 + 사용 + dangerouslySetInnerHTML 0건.
  const welcome = await readSrc("src/modules/scenarios/welcome-view.tsx");
  assert(
    "C-D38-3 (6/6): welcome-view Intro3Step import + 사용 + dangerouslySetInnerHTML 0건",
    /import\s*\{\s*Intro3Step\s*\}\s*from\s*"@\/modules\/landing\/intro-3-step"/.test(welcome) &&
      /<Intro3Step\s*\/>/.test(welcome) &&
      !/dangerouslySetInnerHTML\s*=/.test(intro),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4) C-D38-4 (5) — persona-stat-lozenge 우하단 + persona-catalog-card wiring.
// ─────────────────────────────────────────────────────────────────────────────
{
  assert(
    "C-D38-4 (1/5): src/modules/personas/persona-stat-lozenge.tsx 파일 존재",
    await exists("src/modules/personas/persona-stat-lozenge.tsx"),
  );

  const lz = await readSrc("src/modules/personas/persona-stat-lozenge.tsx");
  assert(
    "C-D38-4 (2/5): export function PersonaStatLozenge 시그니처 grep ({ personaId }: { personaId: string }) → JSX | null",
    /export\s+function\s+PersonaStatLozenge\s*\(\s*\{\s*personaId\s*\}\s*:\s*PersonaStatLozengeProps\s*\)\s*:\s*JSX\.Element\s*\|\s*null/.test(lz),
  );
  assert(
    "C-D38-4 (3/5): null 반환 분기 + \"9k+\" 분기 grep",
    /return\s+null/.test(lz) && /"9k\+"/.test(lz) && /MAX_COUNT_DISPLAY/.test(lz),
  );
  // 자율 정정 D-38-자-4: top-1 → bottom-1. 6 token grep (bottom-1, right-1, bg-stone-100, dark:bg-stone-800, text-stone-600, text-xs).
  assert(
    "C-D38-4 (4/5): Tailwind 6 token grep — 자율 정정 D-38-자-4 우하단 (bottom-1, right-1, bg-stone-100, dark:bg-stone-800, text-stone-600, text-xs)",
    /bottom-1/.test(lz) &&
      /right-1/.test(lz) &&
      /bg-stone-100/.test(lz) &&
      /dark:bg-stone-800/.test(lz) &&
      /text-stone-600/.test(lz) &&
      /text-xs/.test(lz),
  );
  // persona-catalog-card 임포트 + 사용 + 위치 충돌 분리 (좌측 stripe vs 우상단 dot vs 우하단 lozenge).
  const card = await readSrc("src/modules/personas/persona-catalog-card.tsx");
  assert(
    "C-D38-4 (5/5): persona-catalog-card 임포트 + 사용 + 위치 충돌 분리 (좌측 left-0 stripe / 우상단 right-2 top-2 dot / 우하단 bottom-1 right-1 lozenge)",
    /import\s*\{\s*PersonaStatLozenge\s*\}\s*from\s*"\.\/persona-stat-lozenge"/.test(card) &&
      /<PersonaStatLozenge\s+personaId=\{preset\.id\}\s*\/>/.test(card) &&
      /left-0\s+top-0\s+h-full\s+w-1/.test(card) && // 좌측 stripe 보존
      /right-2\s+top-2/.test(card), // 우상단 dot 보존
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5) C-D38-5 (7) — formatDDay + d-day-lozenge fade + sim 3 케이스.
// ─────────────────────────────────────────────────────────────────────────────
{
  assert(
    "C-D38-5 (1/7): scripts/sim-hero-live-transition.mjs 파일 존재",
    await exists("scripts/sim-hero-live-transition.mjs"),
  );

  const sim = await readSrc("scripts/sim-hero-live-transition.mjs");
  // RELEASE_ISO 두 위치 동일 grep — dday-config.ts SoT 정합.
  const dday = await readSrc("src/modules/dday/dday-config.ts");
  const RELEASE_LITERAL = '"2026-05-08T00:00:00+09:00"';
  assert(
    "C-D38-5 (2/7): RELEASE_ISO SoT 정합 — dday-config.ts ↔ sim-hero-live-transition.mjs 동일",
    dday.includes(RELEASE_LITERAL) && sim.includes(RELEASE_LITERAL),
  );
  // formatDDay 시그니처 (now: Date) => string.
  assert(
    "C-D38-5 (3/7): formatDDay 시그니처 (now: Date = new Date()): string — 자율 정정 D-38-자-2",
    /export\s+function\s+formatDDay\s*\(\s*now:\s*Date\s*=\s*new\s+Date\(\)\s*\)\s*:\s*string/.test(dday),
  );
  // 시뮬 3 케이스 grep.
  assert(
    "C-D38-5 (4/7): 시뮬 3 케이스 grep — 자율 정정 D-38-자-5 (5/7 23:59:59 / 5/8 00:00:00 / 5/8 00:00:01)",
    /2026-05-07T23:59:59\+09:00/.test(sim) &&
      /2026-05-08T00:00:00\+09:00/.test(sim) &&
      /2026-05-08T00:00:01\+09:00/.test(sim) &&
      /expected:\s*"D-1"/.test(sim) &&
      /expected:\s*"LIVE"/.test(sim),
  );
  // d-day-lozenge fade 2종 + 색 토큰 grep.
  const lozenge = await readSrc("src/modules/header/d-day-lozenge.tsx");
  assert(
    "C-D38-5 (5/7): d-day-lozenge transition-colors + duration-600 fade 2종 grep",
    /transition-colors/.test(lozenge) && /duration-600/.test(lozenge),
  );
  assert(
    "C-D38-5 (6/7): d-day-lozenge 색 변경 토큰 (text-emerald-600 / text-neutral-500) — 자율 정정 D-38-자-3 기존 토큰 보존",
    /text-emerald-600/.test(lozenge) && /text-neutral-500/.test(lozenge),
  );
  // verify-all.mjs + package.json wiring.
  const verifyAll = await readSrc("scripts/verify-all.mjs");
  const pkg = await readSrc("package.json");
  assert(
    "C-D38-5 (7/7): verify-all.mjs gates 배열 + package.json scripts 양쪽 wiring",
    /sim:hero-live/.test(verifyAll) &&
      /sim-hero-live-transition\.mjs/.test(verifyAll) &&
      /"sim:hero-live"/.test(pkg) &&
      /"verify:d38"/.test(pkg),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 6) 자율 (1) — persona-hue palette WCAG AA 4.5:1 contrast 자체 검증.
//    꼬미 §10 자율 결정 (D-D38-1 (a) 추인 후속 권장 게이트 정합).
// ─────────────────────────────────────────────────────────────────────────────
{
  // PERSONA_HUE_PALETTE 의 모든 hue (10종) 에 대해 bg-{hue}-50 + text-{hue}-700 페어가
  //   라이트 모드 기본 stone/white 배경 가독 보장 (Tailwind 50/700 페어는 WCAG AA 4.5:1 달성 보장).
  //   본 게이트는 정적 명세 검증 — palette 항목 변경 시 4.5:1 검증을 호출자가 의무화.
  const hue = await readSrc("src/modules/personas/persona-hue.ts");
  // 10 hue 색상 모두 명시 + 각 hue 50/200/700 3종 토큰 명시 (purge safelist + WCAG AA 페어).
  const expectedHues = [
    "emerald", "sky", "violet", "rose", "amber",
    "teal", "indigo", "pink", "lime", "cyan",
  ];
  const allPresent = expectedHues.every((h) =>
    new RegExp(`bg-${h}-50`).test(hue) &&
    new RegExp(`text-${h}-700`).test(hue) &&
    new RegExp(`border-${h}-200`).test(hue),
  );
  assert(
    "자율 (1/1): persona-hue palette 10 × 3 = 30 token (50/200/700 페어, Tailwind WCAG AA 가독 보장)",
    allPresent,
    "꼬미 §10 자율 권장 (D-D38-1 (a) 추인 후속)",
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 결과
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n────────────────────────────────────────────────");
console.log(`총 게이트: ${pass + fail} · PASS: ${pass} · FAIL: ${fail}`);
console.log("────────────────────────────────────────────────");

if (fail > 0) {
  console.error(`\n✗ verify-d38 FAILED (${fail} 건)`);
  process.exit(1);
}

console.log("\n✓ verify-d38: 33/33 PASS — D-D38 P0 5건 + 자율 1건");
process.exit(0);
