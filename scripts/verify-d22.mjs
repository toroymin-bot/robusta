#!/usr/bin/env node
/**
 * verify-d22.mjs
 *   - D-D22 (D6 19시 슬롯, 2026-05-01) — 자율 산출 5건 검증.
 *   - verify-d21.mjs 패턴 계승. assertion 30+ 목표.
 *
 * 검증 범위:
 *   1) C-D22-1 — useRoomExport SideSheet UI 와이어업 (export-menu.tsx + buildRoomLike + header-cluster 통합)
 *   2) C-D22-2 — hueToShape participants-panel 호출처 연결 (aria-label 합성 + shape glyph)
 *   3) C-D22-3 — Playwright SideSheet ESC focus 복귀 케이스 등록
 *   4) C-D22-4 — .github/workflows/verify-gate.yml CI 게이트 정의
 *   5) C-D22-5 — 본 스크립트 자체 + 통합 게이트 (vocab / contrast / i18n / verify-d21 회귀 0)
 *
 * 의존성 0 — node 표준만.
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

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

function tryExec(cmd) {
  try {
    const out = execSync(cmd, { stdio: "pipe", encoding: "utf8" });
    return { ok: true, out };
  } catch (e) {
    return { ok: false, out: e.stdout?.toString() ?? "", err: e.stderr?.toString() ?? "" };
  }
}

// 1) C-D22-1 — Export 메뉴 + 매퍼 + 와이어업.
{
  const menu = await readSrc("src/modules/conversation/export-menu.tsx");
  assert(
    "C-D22-1: export-menu.tsx 헤더 주석 (D6 19시)",
    menu.includes("C-D22-1") && menu.includes("2026-05-01"),
  );
  assert(
    "C-D22-1: ExportMenu 함수 export",
    menu.includes("export function ExportMenu("),
  );
  assert(
    "C-D22-1: useRoomExport hook 사용",
    menu.includes('from "@/views/conversation/useRoomExport"') ||
      menu.includes('useRoomExport({ getRoom })'),
  );
  assert(
    "C-D22-1: buildRoomLike 매퍼 사용",
    menu.includes('buildRoomLike(') && menu.includes('@/views/conversation/buildRoomLike'),
  );
  assert(
    "C-D22-1: MD/JSON 두 버튼 + data-test",
    menu.includes('data-test="export-menu-md"') && menu.includes('data-test="export-menu-json"'),
  );
  assert(
    "C-D22-1: 빈 룸 disabled 처리",
    menu.includes("isEmpty") && menu.includes("disabled"),
  );
  assert(
    "C-D22-1: 토스트 성공/실패 양 분기",
    menu.includes('"export.toast.success"') && menu.includes('"export.toast.failure"'),
  );
  assert(
    "C-D22-1: aria-label/group 마크업",
    menu.includes('role="group"') && menu.includes('"export.menu.aria"'),
  );
  assert(
    "C-D22-1: 모바일 터치 타깃 44px 보장",
    menu.includes("min-h-[44px]"),
  );

  const mapper = await readSrc("src/views/conversation/buildRoomLike.ts");
  assert(
    "C-D22-1: buildRoomLike pure 매퍼 export",
    mapper.includes("export function buildRoomLike("),
  );
  assert(
    "C-D22-1: conversation 미존재 → null 반환",
    mapper.includes("if (!conversation) return null"),
  );
  assert(
    "C-D22-1: human → 'user' / AI → 'assistant' 매핑",
    mapper.includes('"assistant"') && mapper.includes('"user"'),
  );

  const header = await readSrc("src/modules/conversation/header-cluster.tsx");
  assert(
    "C-D22-1: header-cluster 가 ExportMenu 마운트",
    header.includes("import { ExportMenu }") && header.includes("<ExportMenu />"),
  );
  // SideSheet flag ON 분기 안에서만 마운트되어야 함 (풀스크린 오버레이는 deprecated).
  // 단순 정적 검증 — SideSheet 블록 안에 ExportMenu 가 있는지 substring 검사로 갈음.
  const sideSheetBlock = header.split("<SideSheet")[1] ?? "";
  const beforeNextSideSheet = sideSheetBlock.split("</SideSheet>")[0] ?? "";
  assert(
    "C-D22-1: ExportMenu 가 SideSheet 블록 내부에 마운트",
    beforeNextSideSheet.includes("<ExportMenu />"),
  );

  const i18n = await readSrc("src/modules/i18n/messages.ts");
  for (const key of [
    "export.menu.title",
    "export.menu.section",
    "export.menu.markdown",
    "export.menu.json",
    "export.menu.aria",
    "export.toast.success",
    "export.toast.failure",
    "export.disabled.empty",
  ]) {
    assert(`C-D22-1 i18n: "${key}" 정의됨`, i18n.includes(`"${key}"`));
  }
}

// 2) C-D22-2 — hueToShape 호출처 연결.
{
  const panel = await readSrc("src/modules/participants/participants-panel.tsx");
  assert(
    "C-D22-2: participants-panel 헤더에 D6 19시 주석",
    panel.includes("C-D22-2") && panel.includes("2026-05-01"),
  );
  assert(
    "C-D22-2: hueToShapeAria / parseHueFromColor import",
    panel.includes("hueToShapeAria") && panel.includes("parseHueFromColor"),
  );
  assert(
    "C-D22-2: hue null 가드 (비-hsl color 호환)",
    panel.includes("hue !== null"),
  );
  assert(
    "C-D22-2: aria-label 합성 (i18n participants.shape.aria)",
    panel.includes('"participants.shape.aria"'),
  );
  assert(
    "C-D22-2: data-test=participant-shape-* 속성 노출",
    panel.includes("participant-shape-"),
  );
  // li 본문에 aria-label binding.
  assert(
    "C-D22-2: li aria-label 변수 바인딩",
    panel.includes("aria-label={liAriaLabel}"),
  );

  const i18n = await readSrc("src/modules/i18n/messages.ts");
  assert(
    'C-D22-2 i18n: "participants.shape.aria" 정의됨',
    i18n.includes('"participants.shape.aria"'),
  );
}

// 3) C-D22-3 — Playwright SideSheet ESC focus 복귀.
{
  const spec = await readSrc("tests/verify-live.spec.ts");
  assert(
    "C-D22-3: spec 헤더 주석에 C-D22-3 명시",
    spec.includes("C-D22-3"),
  );
  assert(
    "C-D22-3: SideSheet ESC focus 복귀 describe 블록",
    spec.includes("SideSheet ESC focus 복귀") || spec.includes("ESC focus"),
  );
  assert(
    "C-D22-3: keyboard.press('Escape') 동작",
    spec.includes('keyboard.press("Escape")'),
  );
  assert(
    "C-D22-3: data-test=mobile-menu-trigger focus 복귀 검증",
    spec.includes("mobile-menu-trigger") && spec.includes("activeElement"),
  );
  assert(
    "C-D22-3: SIDE_SHEET_FLAG_ON OFF 시 test.skip 분기",
    spec.includes("test.skip(true,"),
  );
  assert(
    "C-D22-3: viewport 모바일 375x667",
    spec.includes("width: 375") && spec.includes("height: 667"),
  );
}

// 4) C-D22-4 — GitHub Actions verify-gate.
{
  const wf = await readSrc(".github/workflows/verify-gate.yml");
  assert(
    "C-D22-4: 워크플로우 헤더 주석 (D6 19시)",
    wf.includes("C-D22-4") && wf.includes("2026-05-01"),
  );
  assert(
    "C-D22-4: name verify-gate",
    wf.includes("name: verify-gate"),
  );
  assert(
    "C-D22-4: push main + pull_request 트리거",
    wf.includes("branches: [main]") && wf.includes("pull_request:"),
  );
  assert(
    "C-D22-4: typecheck step",
    wf.includes("npm run typecheck"),
  );
  assert(
    "C-D22-4: i18n key 가드 step",
    wf.includes("scripts/check-i18n-keys.mjs"),
  );
  assert(
    "C-D22-4: 어휘 룰 step (--all)",
    wf.includes("check-vocab.mjs --all"),
  );
  assert(
    "C-D22-4: 콘트라스트 step",
    wf.includes("measure-contrast.mjs"),
  );
  assert(
    "C-D22-4: D-D22 통합 검증 step",
    wf.includes("verify-d22.mjs"),
  );
  assert(
    "C-D22-4: next build step",
    wf.includes("npm run build"),
  );
  assert(
    "C-D22-4: workflow_dispatch 수동 트리거",
    wf.includes("workflow_dispatch:"),
  );
}

// 5) 통합 게이트 회귀 0 — vocab / contrast / i18n / verify-d21.
{
  const v = tryExec("node scripts/check-vocab.mjs --all");
  assert("게이트: check-vocab.mjs --all 0 hits", v.ok, v.err);

  const c = tryExec("node scripts/measure-contrast.mjs");
  assert("게이트: measure-contrast.mjs 실행 PASS", c.ok, c.err);

  const i = tryExec("node scripts/check-i18n-keys.mjs");
  assert("게이트: check-i18n-keys.mjs 실행 PASS", i.ok, i.err);

  const d21 = tryExec("node scripts/verify-d21.mjs");
  assert("게이트: verify-d21.mjs 회귀 0 (33/33 PASS)", d21.ok, d21.err);
}

console.log(`\n=== verify-d22 결과 ===`);
console.log(`PASS: ${pass}`);
console.log(`FAIL: ${fail}`);
if (fail > 0) process.exit(1);
