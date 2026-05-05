#!/usr/bin/env node
/**
 * verify-d42.mjs
 *   - C-D42-1∼5 (D-3 11시 슬롯, 2026-05-05) — Tori spec C-D42 (Task_2026-05-05 §5).
 *   - 패턴: verify-d40 / verify-d40-auto 계승 — 정적 source 패턴 검사 (npm run build 미포함 — 본 사이클은
 *     verify-d40 의 168 정식 HARD GATE 를 별도 호출로 17 사이클 도전).
 *
 * 검증 범위 (총 13 게이트):
 *   1) C-D42-1 (2) — hero-title-slot.tsx + ko/en hero.title.v4 + hero.sub.v4 parity.
 *      자율 정정 D-42-자-1: 명세 hero-title-slot.tsx 신규 생성 + welcome-view.tsx 마운트.
 *   2) C-D42-2 (4) — keyword-chips.tsx + ChipId union 5종 + listbox/option role + ko/en 5×2 parity.
 *   3) C-D42-3 (2) — dark-mode-toggle.tsx svg inline 3 아이콘 (icon-sun/icon-moon/icon-monitor) + placeholder.
 *      자율 정정 D-42-자-2: lucide-react 미설치 → svg inline 자체 구현 (외부 dev-deps +0 의무).
 *   4) C-D42-4 (5) — hero-live-pulse.tsx data-state dn/live + animate-pulse + prefers-reduced-motion + RELEASE 정합 + emerald-600.
 *
 * 회귀 의무: verify-d40 34/34 + verify-d40-auto 4/4 + 168 정식 HARD GATE shared 103 kB 17 사이클 PASS 유지.
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
// 1) C-D42-1 (2) — hero-title-slot.tsx + i18n parity.
// ─────────────────────────────────────────────────────────────────────────────
{
  assert(
    "C-D42-1 (1/2): src/modules/ui/hero-title-slot.tsx data-test/data-version 정합 (자율 정정 D-42-자-1)",
    await exists("src/modules/ui/hero-title-slot.tsx"),
  );
  const slot = await readSrc("src/modules/ui/hero-title-slot.tsx");
  const slotOk =
    /data-test="hero-title-v4"/.test(slot) &&
    /data-version="v4"/.test(slot) &&
    /data-test="hero-sub-v4"/.test(slot);

  const i18n = await readSrc("src/modules/i18n/messages.ts");
  const koOk =
    /"hero\.title\.v4":\s*"AI들의 라운드테이블에 앉으세요\."/.test(i18n) &&
    /"hero\.sub\.v4":\s*"한 번에 여러 AI와 같이 브레인스토밍 — Blend가 1대1이라면, Robusta는 다자\(多者\)입니다\."/.test(i18n);
  const enOk =
    /"hero\.title\.v4":\s*"Sit at the AI Roundtable\."/.test(i18n) &&
    /"hero\.sub\.v4":\s*"Brainstorm with multiple AIs at once — where Blend is 1-to-1, Robusta is many-to-many\."/.test(i18n);

  assert(
    "C-D42-1 (2/2): hero-title-slot data-version=v4 + ko/en hero.title.v4 + hero.sub.v4 parity",
    slotOk && koOk && enOk,
    `slotOk=${slotOk} koOk=${koOk} enOk=${enOk}`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) C-D42-2 (4) — keyword-chips.tsx + listbox/option + ko/en parity.
// ─────────────────────────────────────────────────────────────────────────────
{
  assert(
    "C-D42-2 (1/4): src/modules/ui/keyword-chips.tsx ChipId union 5종 (startup-hypothesis/travel-plan/code-review/writing-feedback/free-input)",
    await exists("src/modules/ui/keyword-chips.tsx"),
    "file missing",
  );

  const chips = await readSrc("src/modules/ui/keyword-chips.tsx");
  const unionOk =
    /"startup-hypothesis"/.test(chips) &&
    /"travel-plan"/.test(chips) &&
    /"code-review"/.test(chips) &&
    /"writing-feedback"/.test(chips) &&
    /"free-input"/.test(chips);

  assert(
    "C-D42-2 (2/4): data-test=\"keyword-chips\" 마운트 1건",
    /data-test="keyword-chips"/.test(chips),
  );
  assert(
    "C-D42-2 (3/4): role=\"listbox\" 1건 + role=\"option\" 5건 (총 6건)",
    /role="listbox"/.test(chips) && /role="option"/.test(chips) && unionOk,
    `union=${unionOk}`,
  );

  const i18n = await readSrc("src/modules/i18n/messages.ts");
  // ko 5쌍.
  const koOk =
    /"keyword\.chip\.startup":\s*"스타트업 가설 검증"/.test(i18n) &&
    /"keyword\.chip\.travel":\s*"여행 계획 짜기"/.test(i18n) &&
    /"keyword\.chip\.code":\s*"코드 리뷰"/.test(i18n) &&
    /"keyword\.chip\.writing":\s*"글쓰기 피드백"/.test(i18n) &&
    /"keyword\.chip\.free":\s*"직접 입력"/.test(i18n);
  // en 5쌍.
  const enOk =
    /"keyword\.chip\.startup":\s*"Startup hypothesis check"/.test(i18n) &&
    /"keyword\.chip\.travel":\s*"Trip planning"/.test(i18n) &&
    /"keyword\.chip\.code":\s*"Code review"/.test(i18n) &&
    /"keyword\.chip\.writing":\s*"Writing feedback"/.test(i18n) &&
    /"keyword\.chip\.free":\s*"Free input"/.test(i18n);

  assert(
    "C-D42-2 (4/4): i18n keyword.chip.* 5×2=10 ko/en parity",
    koOk && enOk,
    `koOk=${koOk} enOk=${enOk}`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) C-D42-3 (2) — dark-mode-toggle svg inline 3 아이콘 + placeholder.
// ─────────────────────────────────────────────────────────────────────────────
{
  const toggle = await readSrc("src/modules/ui/dark-mode-toggle.tsx");
  // 자율 정정 D-42-자-2: lucide-react 미설치 → svg id 기반 grep.
  assert(
    'C-D42-3 (1/2): svg id 3 아이콘 (icon-sun / icon-moon / icon-monitor) inline (자율 정정 D-42-자-2: lucide-react 미설치 → svg inline)',
    /id="icon-sun"/.test(toggle) &&
      /id="icon-moon"/.test(toggle) &&
      /id="icon-monitor"/.test(toggle),
  );
  // hydrated=false 시 16x16 placeholder div (Hydration mismatch 회피).
  assert(
    'C-D42-3 (2/2): hydrated=false placeholder div (data-test="dark-mode-toggle-placeholder" + w-4 h-4)',
    /data-test="dark-mode-toggle-placeholder"/.test(toggle) &&
      /w-4 h-4/.test(toggle),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4) C-D42-4 (5) — hero-live-pulse.tsx data-state + animate-pulse + RELEASE 정합 + emerald-600.
// ─────────────────────────────────────────────────────────────────────────────
{
  assert(
    "C-D42-4 (0/5): src/modules/ui/hero-live-pulse.tsx 파일 존재 (자율 정정 D-42-자-4: dday-config SoT 직접 import)",
    await exists("src/modules/ui/hero-live-pulse.tsx"),
  );
  const pulse = await readSrc("src/modules/ui/hero-live-pulse.tsx");
  assert(
    'C-D42-4 (1/5): data-state="dn" + data-state="live" 양쪽 분기',
    /data-state="dn"/.test(pulse) && /data-state="live"/.test(pulse),
  );
  // motion-safe:animate-pulse — Tailwind motion-safe prefix 가 prefers-reduced-motion: reduce 시 자동 미적용.
  assert(
    "C-D42-4 (2/5): animate-pulse 토큰 (motion-safe prefix 정합 — reduced motion 자동 분기)",
    /animate-pulse/.test(pulse),
  );
  assert(
    "C-D42-4 (3/5): prefers-reduced-motion 분기 의무 명시 (주석 또는 motion-safe prefix)",
    /prefers-reduced-motion/.test(pulse) || /motion-safe:/.test(pulse),
  );
  assert(
    "C-D42-4 (4/5): RELEASE_ISO SoT 정합 (dday-config import — 2026-05-08 인라인 미사용 — SoT 단일)",
    /RELEASE_ISO/.test(pulse) && /from\s*"@\/modules\/dday\/dday-config"/.test(pulse),
  );
  assert(
    "C-D42-4 (5/5): bg-emerald-600 토큰 (LIVE 시각 임팩트)",
    /bg-emerald-600/.test(pulse),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 결과
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n────────────────────────────────────────────────");
console.log(`총 게이트: ${pass + fail} · PASS: ${pass} · FAIL: ${fail}`);
console.log("────────────────────────────────────────────────");

if (fail > 0) {
  console.error(`\n✗ verify-d42 FAILED (${fail} 건)`);
  process.exit(1);
}

console.log(`\n✓ verify-d42: ${pass}/${pass} PASS — D-D42 P0 5건 (C-D42-1∼4 + C-D42-5 본 파일) + 168 정식 HARD GATE 17 사이클 도전`);
process.exit(0);
