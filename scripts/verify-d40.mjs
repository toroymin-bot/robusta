#!/usr/bin/env node
/**
 * verify-d40.mjs
 *   - C-D40-1∼5 (D-3 03시 슬롯, 2026-05-05) — Tori spec C-D40 (Task_2026-05-05 §1).
 *   - 패턴: verify-d39 계승 — 정적 source 패턴 검사 + npm run build 1회 (168 15 사이클 도전).
 *
 * 검증 범위:
 *   1) C-D40-1 (9) — i18n 4쌍 ko/en parity + key-input-modal 5 token 정확 일치.
 *   2) C-D40-2 (9) — DarkModeToggle 컴포넌트 + layout 마운트 + 디자인 토큰 (D-D40-1) 정확 일치.
 *      자율 정정 D-40-자-1: src/modules/theme/ → src/modules/ui/.
 *      자율 정정 D-40-자-2: localStorage → useThemeStore SoT (D-9.1 IndexedDB 정합).
 *   3) C-D40-3 (8) — manualFire async + ManualFireResult union 확장 + ManualRunButton await 처리.
 *      자율 정정 D-40-자-3: callAnthropic 미존재 → streamMessage wiring D+1 후속.
 *      자율 정정 D-40-자-4: 백워드 호환 옵셔널 필드 (success/error) 만 추가.
 *   4) C-D40-4 (3) — 168 정식 HARD GATE shared 103 kB 15 사이클 연속 (npm run build 1회).
 *   5) C-D40-5 (5) — D-Day fallback wiring readiness 정적 검증 (dry-run-dday-staging.mjs grep).
 *
 *   합계: 34 게이트.
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
// 1) C-D40-1 (9) — 한국어 BYOK 모달 카피 v1 i18n 4쌍 + key-input-modal 토큰 교체.
// ─────────────────────────────────────────────────────────────────────────────
{
  const i18n = await readSrc("src/modules/i18n/messages.ts");

  assert(
    'C-D40-1 (1/9): i18n ko "byok.modal.title" = "Claude 키 입력"',
    /"byok\.modal\.title":\s*"Claude 키 입력"/.test(i18n),
  );
  assert(
    'C-D40-1 (2/9): i18n ko "byok.modal.input.placeholder" = "sk-ant-..."',
    /"byok\.modal\.input\.placeholder":\s*"sk-ant-\.\.\."/.test(i18n),
  );
  assert(
    'C-D40-1 (3/9): i18n ko "byok.modal.save.button" = "저장"',
    /"byok\.modal\.save\.button":\s*"저장"/.test(i18n),
  );
  assert(
    'C-D40-1 (4/9): i18n ko "byok.modal.help.link.label" = "키가 없으세요? 발급받기 →"',
    /"byok\.modal\.help\.link\.label":\s*"키가 없으세요\? 발급받기 →"/.test(i18n),
  );
  assert(
    'C-D40-1 (5/9): i18n en "byok.modal.title" = "Enter your Claude key"',
    /"byok\.modal\.title":\s*"Enter your Claude key"/.test(i18n),
  );
  assert(
    'C-D40-1 (6/9): i18n en "byok.modal.help.link.label" = "Don\'t have a key? Get one →"',
    /"byok\.modal\.help\.link\.label":\s*"Don't have a key\? Get one →"/.test(i18n),
  );

  const modal = await readSrc("src/modules/api-keys/key-input-modal.tsx");
  assert(
    'C-D40-1 (7/9): key-input-modal.tsx 4 키 호출 (title/placeholder/save/help.link.label)',
    /t\("byok\.modal\.title"\)/.test(modal) &&
      /t\("byok\.modal\.input\.placeholder"\)/.test(modal) &&
      /t\("byok\.modal\.save\.button"\)/.test(modal) &&
      /t\("byok\.modal\.help\.link\.label"\)/.test(modal),
  );
  assert(
    'C-D40-1 (8/9): key-input-modal.tsx 외부 링크 보안 강화 (target="_blank" + rel="noopener noreferrer")',
    /href=\{ANTHROPIC_CONSOLE_URL\}/.test(modal) &&
      /target="_blank"/.test(modal) &&
      /rel="noopener noreferrer"/.test(modal),
  );
  assert(
    'C-D40-1 (9/9): 외부 링크 디자인 토큰 정확 일치 (text-emerald-700 dark:text-emerald-400 hover:underline)',
    /text-emerald-700/.test(modal) &&
      /dark:text-emerald-400/.test(modal) &&
      /hover:underline/.test(modal) &&
      /data-test="byok-modal-help-link"/.test(modal),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) C-D40-2 (9) — 다크모드 토글 컴포넌트 + layout 마운트 + 디자인 토큰.
// ─────────────────────────────────────────────────────────────────────────────
{
  // 자율 정정 D-40-자-1: ui 모듈 (theme.ts/theme-hue.ts 정합) — theme/ 신규 X.
  assert(
    "C-D40-2 (1/9): src/modules/ui/dark-mode-toggle.tsx 파일 존재 (자율 정정 D-40-자-1: ui 모듈 정합)",
    await exists("src/modules/ui/dark-mode-toggle.tsx"),
  );

  const toggle = await readSrc("src/modules/ui/dark-mode-toggle.tsx");
  assert(
    "C-D40-2 (2/9): DarkModeToggle export 시그니처 + JSX.Element 반환 타입",
    /export\s+function\s+DarkModeToggle\s*\(\s*\)\s*:\s*JSX\.Element/.test(toggle),
  );
  // 자율 정정 D-40-자-2: useThemeStore SoT (D-9.1 IndexedDB + cookie boot 정합).
  //   localStorage 실 호출(setItem/getItem) 0건 의무 — 주석에 단어 사용은 무관.
  assert(
    "C-D40-2 (3/9): useThemeStore SoT import + setChoice 호출 (자율 정정 D-40-자-2: localStorage 실 호출 0)",
    /import\s*\{\s*useThemeStore\s*\}\s*from\s*"@\/modules\/ui\/theme"/.test(toggle) &&
      /setChoice\(nextChoice\(choice\)\)/.test(toggle) &&
      !/localStorage\.(setItem|getItem|removeItem)/.test(toggle),
  );
  // 3-way cycle 'system'/'light'/'dark'.
  assert(
    'C-D40-2 (4/9): CYCLE 3종 (system/light/dark) 정확 일치',
    /CYCLE:\s*ThemeChoice\[\]\s*=\s*\["system",\s*"light",\s*"dark"\]/.test(toggle),
  );
  // 디자인 토큰 D-D40-1 정확 일치 — Secondary border outline.
  const tokenOk =
    /fixed\s+top-3\s+right-3\s+z-50/.test(toggle) &&
    /bg-stone-100/.test(toggle) &&
    /dark:bg-stone-800/.test(toggle) &&
    /text-stone-700/.test(toggle) &&
    /dark:text-stone-300/.test(toggle) &&
    /border\s+border-stone-300/.test(toggle) &&
    /dark:border-stone-700/.test(toggle) &&
    /hover:bg-stone-200/.test(toggle) &&
    /dark:hover:bg-stone-700/.test(toggle) &&
    /transition-colors/.test(toggle);
  assert(
    "C-D40-2 (5/9): 디자인 토큰 10종 정확 일치 (D-D40-1 의장)",
    tokenOk,
  );
  assert(
    'C-D40-2 (6/9): data-test="dark-mode-toggle" 마운트',
    /data-test="dark-mode-toggle"/.test(toggle),
  );
  assert(
    "C-D40-2 (7/9): hydrate useEffect + hydrated 가드 (SSR 깜빡임 회피)",
    /useEffect\(/.test(toggle) && /hydrated/.test(toggle),
  );

  const layout = await readSrc("src/app/layout.tsx");
  assert(
    "C-D40-2 (8/9): layout.tsx import + <DarkModeToggle /> 마운트 1줄",
    /import\s*\{\s*DarkModeToggle\s*\}\s*from\s*"@\/modules\/ui\/dark-mode-toggle"/.test(layout) &&
      /<DarkModeToggle\s*\/>/.test(layout),
  );
  assert(
    "C-D40-2 (9/9): layout.tsx 기존 themeBootScript 보존 (D-9.1 cookie boot 무수정 의무)",
    /robusta\.theme\.boot/.test(layout) &&
      /themeBootScript/.test(layout),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) C-D40-3 (8) — manualFire async + ManualFireResult union 확장.
// ─────────────────────────────────────────────────────────────────────────────
{
  const helper = await readSrc("src/modules/schedule/manual-run.ts");
  assert(
    "C-D40-3 (1/8): manualFire async 시그니처 + Promise<ManualFireResult> 반환 타입",
    /export\s+async\s+function\s+manualFire\s*\(\s*[\s\S]*?\)\s*:\s*Promise<ManualFireResult>/.test(helper),
  );
  // ManualFireResult union 확장 — success / error 옵셔널 필드.
  assert(
    "C-D40-3 (2/8): ManualFireResult success { messageId, responseLength } 옵셔널 필드",
    /success\?:\s*\{\s*messageId:\s*string;\s*responseLength:\s*number\s*\}/.test(helper),
  );
  assert(
    "C-D40-3 (3/8): ManualFireResult error { kind, detail? } 옵셔널 필드 + 3종 union",
    /error\?:\s*\{\s*kind:\s*"no_key"\s*\|\s*"no_persona"\s*\|\s*"api_error";\s*detail\?:\s*string\s*\}/.test(helper),
  );
  // 백워드 호환 — 기존 reason 4종 유지 (verify-d39 (5/8) 게이트 회귀 보호).
  assert(
    'C-D40-3 (4/8): 기존 reason 필드 백워드 호환 ("no-byok-key" + "dedup-skip" 보존 + "no-persona"/"api-error" 확장)',
    /"no-byok-key"\s*\|\s*"dedup-skip"\s*\|\s*"no-persona"\s*\|\s*"api-error"/.test(helper),
  );
  // 자율 정정 D-40-자-3: callAnthropic 미존재 → no-op stub success 페이로드.
  assert(
    "C-D40-3 (5/8): no_key 시 error.kind=no_key + reason=no-byok-key 동시 set (백워드 호환)",
    /reason:\s*"no-byok-key",\s*error:\s*\{\s*kind:\s*"no_key"\s*\}/.test(helper),
  );
  assert(
    'C-D40-3 (6/8): success stub 페이로드 (messageId: `manual-${ruleId}-${now}`, responseLength: 0)',
    /messageId:\s*`manual-\$\{ruleId\}-\$\{now\}`/.test(helper) &&
      /responseLength:\s*0/.test(helper),
  );

  const btn = await readSrc("src/modules/schedule/manual-run-button.tsx");
  assert(
    "C-D40-3 (7/8): ManualRunButton.runNow async + await manualFire 호출 + onClick void wrapping",
    /async\s+function\s+runNow\s*\(\s*\)/.test(btn) &&
      /await\s+manualFire\(scheduleId,\s*"manual_now"\)/.test(btn) &&
      /onClick=\{\(\)\s*=>\s*void\s+runNow\(\)\}/.test(btn),
  );
  // dedup Map 무수정 의무 — verify-d39 (5/8) 회귀 보호.
  assert(
    "C-D40-3 (8/8): manual-run.ts dedup Map (lastFireAt = new Map) + 1초 윈도우 무수정",
    /lastFireAt\s*=\s*new\s+Map/.test(helper) &&
      /DEDUP_MS\s*=\s*1_000/.test(helper),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4) C-D40-4 (3) — 168 정식 HARD GATE shared 103 kB 15 사이클 연속.
// ─────────────────────────────────────────────────────────────────────────────
{
  console.log("\n[C-D40-4] npm run build 실행 중 (168 15 사이클 검증) — ~30s 소요...");
  const buildResult = spawnSync("npm", ["run", "build"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 5 * 60 * 1000,
  });
  const buildOut = (buildResult.stdout || "") + "\n" + (buildResult.stderr || "");

  assert(
    "C-D40-4 (1/3): npm run build exit=0 (HARD GATE)",
    buildResult.status === 0,
    `exit=${buildResult.status}, stderr tail: ${(buildResult.stderr || "").slice(-300)}`,
  );
  assert(
    'C-D40-4 (2/3): "+ First Load JS shared by all  103 kB" 정확 grep (168 정식 15 사이클 연속)',
    /\+ First Load JS shared by all\s+103 kB/.test(buildOut),
    `build out tail: ${buildOut.slice(-500)}`,
  );
  const chunkLines = buildOut.match(/chunks\/[a-f0-9-]+\.js/g) || [];
  assert(
    `C-D40-4 (3/3): shared chunks ≥ 2 종 grep (실제 ${chunkLines.length} 매칭)`,
    chunkLines.length >= 2,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5) C-D40-5 (5) — D-Day staging dry-run wiring readiness 최종 검증 (정적 grep).
// ─────────────────────────────────────────────────────────────────────────────
{
  // 자율 정정 D-40-자-5: dry-run-dday-staging.mjs 코드 변경 0 — 본 게이트는 정적 grep 만.
  assert(
    "C-D40-5 (1/5): scripts/dry-run-dday-staging.mjs 파일 존재 (꼬미 §12 신규 자산 보존)",
    await exists("scripts/dry-run-dday-staging.mjs"),
  );

  const dry = await readSrc("scripts/dry-run-dday-staging.mjs");
  // 정적 wiring 본체 항목 (꼬미 §12 게이트 회귀 보호 정합).
  //   dry-run.mjs 내부에 자체 게이트 7건 (formatDDay/RELEASE_ISO/d-day-lozenge data-test) 포함 의무.
  assert(
    "C-D40-5 (2/5): dry-run formatDDay + RELEASE_ISO + d-day-lozenge data-test 정합",
    /formatDDay/.test(dry) &&
      /RELEASE_ISO/.test(dry) &&
      /d-day-lozenge/.test(dry),
  );
  assert(
    "C-D40-5 (3/5): dry-run Puppeteer 미사용 의무 grep + ROBUSTA_PREVIEW_URL 환경변수 처리",
    /Puppeteer 미사용/.test(dry) &&
      /ROBUSTA_PREVIEW_URL/.test(dry) &&
      /assertSkip/.test(dry),
  );

  const verifyAll = await readSrc("scripts/verify-all.mjs");
  assert(
    "C-D40-5 (4/5): verify-all.mjs gates 배열에 verify:d40 + dry-run:dday-staging 양쪽 포함",
    /verify:d40/.test(verifyAll) && /dry-run:dday-staging/.test(verifyAll),
  );

  const pkg = await readSrc("package.json");
  assert(
    'C-D40-5 (5/5): package.json scripts "verify:d40" + "dry-run:dday-staging" 양쪽 wiring',
    /"verify:d40":/.test(pkg) && /"dry-run:dday-staging":/.test(pkg),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 결과
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n────────────────────────────────────────────────");
console.log(`총 게이트: ${pass + fail} · PASS: ${pass} · FAIL: ${fail}`);
console.log("────────────────────────────────────────────────");

if (fail > 0) {
  console.error(`\n✗ verify-d40 FAILED (${fail} 건)`);
  process.exit(1);
}

console.log(`\n✓ verify-d40: ${pass}/${pass} PASS — D-D40 P0 5건 (C-D40-1∼5) + 168 정식 HARD GATE 15 사이클 연속`);
process.exit(0);
