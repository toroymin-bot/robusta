#!/usr/bin/env node
/**
 * verify-d23.mjs
 *   - D-D23 (D6 23시 슬롯, 2026-05-01) — 자율 산출 5건 검증.
 *   - verify-d22.mjs 패턴 계승. assertion 30+ 목표.
 *
 * 검증 범위:
 *   1) C-D23-1 — KQ_16 자체 결정: PARTICIPANT_HUE_SEEDS 5 베이스 + 이름 매핑 + hueToBaseName
 *   2) C-D23-2 — F-22 컨텍스트 슬라이서 UI 와이어업: compacted chunk + 토스트 + i18n
 *   3) C-D23-3 — measure-contrast 5 hue 자동 검증
 *   4) C-D23-4 — verify-gate.yml verify-d23 step 등록
 *   5) C-D23-5 — 본 스크립트 자체 + 통합 게이트 (vocab / contrast / i18n / verify-d22 회귀 0)
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

// 1) C-D23-1 — PARTICIPANT_HUE_SEEDS 5 베이스 + hueToBaseName.
{
  const theme = await readSrc("src/modules/ui/theme.ts");
  assert(
    "C-D23-1: theme.ts 헤더 주석 (D6 23시)",
    theme.includes("C-D23-1") && theme.includes("2026-05-01"),
  );
  // 5 hue 정확 매칭 — [20, 50, 150, 200, 280].
  assert(
    "C-D23-1: PARTICIPANT_HUE_SEEDS 5 hue 정렬 (20, 50, 150, 200, 280)",
    /PARTICIPANT_HUE_SEEDS\s*=\s*\[\s*20\s*,\s*50\s*,\s*150\s*,\s*200\s*,\s*280\s*\]/.test(theme),
  );
  assert(
    "C-D23-1: PARTICIPANT_HUE_SEED_NAMES 정의됨",
    theme.includes("export const PARTICIPANT_HUE_SEED_NAMES"),
  );
  assert(
    "C-D23-1: 이름 ko 5개 (주황·노랑·민트·청록·라일락)",
    theme.includes("주황") &&
      theme.includes("노랑") &&
      theme.includes("민트") &&
      theme.includes("청록") &&
      theme.includes("라일락"),
  );
  assert(
    "C-D23-1: 이름 en 5개 (orange·yellow·mint·teal·lilac)",
    theme.includes("orange") &&
      theme.includes("yellow") &&
      theme.includes("mint") &&
      theme.includes("teal") &&
      theme.includes("lilac"),
  );
  assert(
    "C-D23-1: hueToBaseName(hue, locale) export",
    theme.includes("export function hueToBaseName(hue: number"),
  );
  assert(
    "C-D23-1: hueToBaseName wrap-around 거리 계산",
    theme.includes("Math.min(d, 360 - d)"),
  );
}

// 2) C-D23-2 — F-22 가시화: compacted chunk + 토스트 + i18n.
{
  const api = await readSrc("src/modules/conversation/conversation-api.ts");
  assert(
    "C-D23-2: StreamChunk 에 'compacted' kind 정의",
    api.includes('kind: "compacted"') && api.includes("original: number") && api.includes("shrunk: number"),
  );
  assert(
    "C-D23-2: streamMessage 에서 compacted yield (압축 발생 시)",
    api.includes("compactedHistory.length < input.history.length") && api.includes('kind: "compacted"'),
  );

  const store = await readSrc("src/stores/conversation-store.ts");
  assert(
    "C-D23-2: conversation-store 가 compacted chunk 처리",
    store.includes('chunk.kind === "compacted"'),
  );
  assert(
    "C-D23-2: compacted 토스트 i18n 키 사용",
    store.includes('"toast.context.compacted"'),
  );
  assert(
    "C-D23-2: 토스트 tone='info' (정보 토스트)",
    /chunk\.kind === "compacted"[\s\S]{0,400}tone:\s*"info"/.test(store),
  );

  const i18n = await readSrc("src/modules/i18n/messages.ts");
  assert(
    'C-D23-2 i18n: ko "toast.context.compacted" 정의됨',
    i18n.includes('"toast.context.compacted": "이전 대화 {original}건을 자동으로 {shrunk}건으로 요약했어요"'),
  );
  assert(
    'C-D23-2 i18n: en "toast.context.compacted" 정의됨',
    i18n.includes('"toast.context.compacted": "Auto-summarised {original} earlier messages into {shrunk}"'),
  );
}

// 3) C-D23-3 — measure-contrast 5 hue 자동 검증.
{
  const mc = await readSrc("scripts/measure-contrast.mjs");
  assert(
    "C-D23-3: measure-contrast 헤더 주석 (D6 23시)",
    mc.includes("C-D23-3") && mc.includes("2026-05-01"),
  );
  assert(
    "C-D23-3: PARTICIPANT_HUE_SEEDS 5 hue 동기 (20, 50, 150, 200, 280)",
    mc.includes("[20, 50, 150, 200, 280]"),
  );
  assert(
    "C-D23-3: hslToHex 함수 정의",
    mc.includes("function hslToHex(h, s, l)"),
  );
  assert(
    "C-D23-3: 5 hue 페어 자동 추가 루프",
    mc.includes("PARTICIPANT_HUE_SEEDS.length") && mc.includes("hslToHex(hue,"),
  );
  assert(
    "C-D23-3: hue 페어 mode='hue' (라이트/다크 비종속)",
    mc.includes('"hue"'),
  );
  assert(
    "C-D23-3: AA Large 3:1 임계 (requiresAaLarge: true)",
    /requiresAaLarge:\s*true,?\s*\}/.test(mc),
  );
}

// 4) C-D23-4 — verify-gate.yml verify-d23 step.
{
  const wf = await readSrc(".github/workflows/verify-gate.yml");
  assert(
    "C-D23-4: 워크플로우 헤더 주석 (D6 23시)",
    wf.includes("C-D23-4") && wf.includes("2026-05-01"),
  );
  assert(
    "C-D23-4: D-D23 통합 검증 step",
    wf.includes("D-D23 통합 검증") && wf.includes("verify-d23.mjs"),
  );
  assert(
    "C-D23-4: 게이트 5종 명시 (verify-d23 포함)",
    wf.includes("verify-d23"),
  );
  assert(
    "C-D23-4: D-D22 step 도 보존 (회귀 0)",
    wf.includes("verify-d22.mjs"),
  );
}

// 5) 통합 게이트 회귀 0 — vocab / contrast(5 hue 포함) / i18n / verify-d22.
{
  const v = tryExec("node scripts/check-vocab.mjs --all");
  assert("게이트: check-vocab.mjs --all 0 hits", v.ok, v.err);

  const c = tryExec("node scripts/measure-contrast.mjs");
  assert("게이트: measure-contrast.mjs 5 hue 포함 PASS", c.ok, c.err);

  const i = tryExec("node scripts/check-i18n-keys.mjs");
  assert("게이트: check-i18n-keys.mjs 실행 PASS", i.ok, i.err);

  const d22 = tryExec("node scripts/verify-d22.mjs");
  assert("게이트: verify-d22.mjs 회귀 0", d22.ok, d22.err);

  const d21 = tryExec("node scripts/verify-d21.mjs");
  assert("게이트: verify-d21.mjs 회귀 0", d21.ok, d21.err);
}

// 어휘 룰 — D-D23 신규/수정 산출물 자체 검증.
//   본 스크립트 자체는 검사 대상에서 제외 — 정규식 패턴 자체에 검사 토큰이 포함되어 위양성.
//   (check-vocab.mjs 가 동일 사유로 자기 자신 제외 — 본 파일도 같은 정책.)
{
  const files = [
    "src/modules/ui/theme.ts",
    "src/modules/conversation/conversation-api.ts",
    "src/stores/conversation-store.ts",
    "src/modules/i18n/messages.ts",
    "scripts/measure-contrast.mjs",
    ".github/workflows/verify-gate.yml",
  ];
  for (const f of files) {
    const src = await readSrc(f);
    const hits = src.match(/박(다|았|음|제)/g);
    assert(`어휘 룰: ${f} 박 어휘 0건`, !hits, hits ? `hits=${hits.length}` : "");
  }
}

console.log(`\n=== verify-d23 결과 ===`);
console.log(`PASS: ${pass}`);
console.log(`FAIL: ${fail}`);
if (fail > 0) process.exit(1);
