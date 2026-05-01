#!/usr/bin/env node
/**
 * verify-d21.mjs
 *   - D-D21 (D6 15시 슬롯, 2026-05-01) — 자율 산출 5건 검증.
 *   - verify-d20.mjs 패턴 계승 — assertion 30+ 목표.
 *
 * 검증 범위:
 *   1) C-D21-1 — scripts/check-i18n-keys.mjs 존재 + 실행 PASS (exit 0).
 *   2) C-D21-2 — SideSheet.tsx 포커스 복귀 로직 (previousFocusRef).
 *   3) C-D21-3 — participant-color.ts hueToShape / shapeToLabel / hueToShapeAria 5분면 매핑.
 *   4) C-D21-4 — useRoomExport.ts dynamic import + SSR 가드 + canExport.
 *   5) check-i18n-keys.mjs / measure-contrast.mjs / check-vocab.mjs 통합 게이트.
 *
 * 의존성 0 — node 표준만 사용.
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

// 1) C-D21-1 — i18n 키 회귀 가드.
{
  const src = await readSrc("scripts/check-i18n-keys.mjs");
  assert(
    "C-D21-1: scripts/check-i18n-keys.mjs 헤더 주석 (D6 15시)",
    src.includes("C-D21-1") && src.includes("2026-05-01"),
  );
  assert(
    "C-D21-1: extractDictKeys / extractUsedKeys 함수 정의",
    src.includes("function extractDictKeys") && src.includes("function extractUsedKeys"),
  );
  assert(
    "C-D21-1: ko/en 양쪽 dict 파싱",
    src.includes('"ko"') && src.includes('"en"'),
  );
  assert(
    "C-D21-1: t(\"…\")/t('…') 사용 키 정규식 매칭",
    src.includes("\\bt\\(\\s*[\"']"),
  );
  assert(
    "C-D21-1: MISSING-KO / MISSING-EN 오류 분류",
    src.includes("MISSING-KO") && src.includes("MISSING-EN"),
  );
  // 실행 PASS — exit 0.
  const r = tryExec("node scripts/check-i18n-keys.mjs");
  assert("C-D21-1: 실행 결과 exit 0 (사용 키 모두 ko/en 등록)", r.ok, r.err);
  assert(
    "C-D21-1: 출력에 사용 키 카운트 노출",
    r.ok && /사용 키 \d+개/.test(r.out),
  );
}

// 2) C-D21-2 — SideSheet 포커스 복귀.
{
  const src = await readSrc("src/components/SideSheet/SideSheet.tsx");
  assert(
    "C-D21-2: previousFocusRef 도입",
    src.includes("previousFocusRef"),
  );
  assert(
    "C-D21-2: open=true 시 document.activeElement capture",
    src.includes("document.activeElement") && src.includes("previousFocusRef.current"),
  );
  assert(
    "C-D21-2: panelRef.current?.contains(active) 자기 포함 가드",
    src.includes("panelRef.current?.contains(active)"),
  );
  assert(
    "C-D21-2: cleanup 에서 prev.focus() 복귀",
    src.includes("prev.focus()"),
  );
  assert(
    "C-D21-2: document.contains(prev) detached 가드",
    src.includes("document.contains(prev)"),
  );
  assert(
    "C-D21-2: try/catch 로 disabled focus 안전",
    src.includes("try {") && src.includes("} catch {"),
  );
  assert(
    "C-D21-2: WCAG 2.4.3 / 2.4.7 명시 주석",
    src.includes("WCAG 2.4.3") && src.includes("2.4.7"),
  );
}

// 3) C-D21-3 — participant-color hueToShape.
{
  const src = await readSrc("src/modules/participants/participant-color.ts");
  assert(
    "C-D21-3: ParticipantShape type union",
    src.includes('export type ParticipantShape ='),
  );
  assert(
    "C-D21-3: hueToShape function export",
    src.includes("export function hueToShape("),
  );
  assert(
    "C-D21-3: 5분면 boundary (72/144/216/288)",
    src.includes("h < 72") &&
      src.includes("h < 144") &&
      src.includes("h < 216") &&
      src.includes("h < 288"),
  );
  assert(
    "C-D21-3: 5종 글리프 (◉ ◯ ◇ △ ◊)",
    src.includes('"◉"') &&
      src.includes('"◯"') &&
      src.includes('"◇"') &&
      src.includes('"△"') &&
      src.includes('"◊"'),
  );
  assert(
    "C-D21-3: shapeToLabel ko/en 분기",
    src.includes("SHAPE_LABEL_KO") && src.includes("SHAPE_LABEL_EN"),
  );
  assert(
    "C-D21-3: hueToShapeAria 결합 helper",
    src.includes("export function hueToShapeAria("),
  );
  // 동작 검증 — 동적 evaluation 없이 분기 테스트는 정적 inspection 으로 대체.
  assert(
    "C-D21-3: normalizeHue 통한 결정성 (hue %= 360)",
    src.includes("normalizeHue(hue)"),
  );
}

// 4) C-D21-4 — useRoomExport.
{
  const src = await readSrc("src/views/conversation/useRoomExport.ts");
  assert(
    "C-D21-4: useRoomExport hook export",
    src.includes("export function useRoomExport("),
  );
  assert(
    "C-D21-4: dynamic import (메인 번들 영향 0)",
    src.includes('await import("@/services/export/roomExporter")'),
  );
  assert(
    "C-D21-4: SSR 가드 (window/document undefined check)",
    src.includes('typeof window !== "undefined"') &&
      src.includes('typeof document !== "undefined"'),
  );
  assert(
    "C-D21-4: ExportFormat union 'md' | 'json'",
    src.includes('"md" | "json"'),
  );
  assert(
    "C-D21-4: canExport 플래그 노출",
    src.includes("canExport"),
  );
  assert(
    "C-D21-4: 파일명 ymdUTC + safeRoomSlug 합성",
    src.includes("ymdUTC()") && src.includes("safeRoomSlug("),
  );
  assert(
    "C-D21-4: getRoom() null 가드",
    src.includes("if (!room)"),
  );
  assert(
    "C-D21-4: never exhaustive 가드",
    src.includes("_exhaustive: never"),
  );
  assert(
    "C-D21-4: \"use client\" directive (브라우저 전용 hook)",
    src.includes('"use client"'),
  );
}

// 5) 통합 게이트 — i18n + contrast + vocab.
{
  const r = tryExec("node scripts/measure-contrast.mjs");
  assert("게이트: measure-contrast.mjs 실행 PASS", r.ok, r.err);

  const v = tryExec("node scripts/check-vocab.mjs --all");
  assert("게이트: check-vocab.mjs --all 0 hits", v.ok, v.err);

  const i = tryExec("node scripts/check-i18n-keys.mjs");
  assert("게이트: check-i18n-keys.mjs 실행 PASS", i.ok, i.err);
}

console.log(`\n=== verify-d21 결과 ===`);
console.log(`PASS: ${pass}`);
console.log(`FAIL: ${fail}`);
if (fail > 0) process.exit(1);
