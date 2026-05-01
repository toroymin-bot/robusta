#!/usr/bin/env node
/**
 * verify-d20.mjs
 *   - D-D20 (D6 11시 슬롯, 2026-05-01) — 신규 5건 + WCAG + lint 통합 검증.
 *   - verify-d19.mjs 패턴 계승 — assertion 약 60개 목표.
 *
 * 검증 범위:
 *   1) C-D20-1 — header-cluster.tsx SideSheet flag dual-track + SIDE_SHEET_FLAG_ON 분기.
 *   2) C-D20-2 — conversation-api.ts maybeCompactHistory dynamic import.
 *   3) C-D20-3 — header-cluster-store + handleEmptyIntent → openMenu 연동.
 *   4) C-D20-4 — measure-contrast.mjs 실행 통합 (필수 페어 PASS).
 *   5) C-D20-5 — eslint.config.mjs 등록 + check-vocab --all 0건.
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

// 1) C-D20-1 — header-cluster.tsx SideSheet flag dual-track.
{
  const src = await readSrc("src/modules/conversation/header-cluster.tsx");
  assert(
    "C-D20-1: SIDE_SHEET_FLAG_ON 빌드 타임 상수 정의",
    src.includes("SIDE_SHEET_FLAG_ON") &&
      src.includes("NEXT_PUBLIC_ROBUSTA_SIDE_SHEET"),
  );
  assert(
    "C-D20-1: SideSheet 컴포넌트 import",
    src.includes('from "@/components/SideSheet/SideSheet"'),
  );
  assert(
    "C-D20-1: flag 분기 — SideSheet vs 풀스크린 오버레이",
    src.includes("SIDE_SHEET_FLAG_ON ?") &&
      src.includes("<SideSheet"),
  );
  assert(
    "C-D20-1: SideSheet 좌측 60% widthPct 명시",
    src.includes('widthPct={60}') &&
      src.includes('side="left"'),
  );
  assert(
    "C-D20-1: 풀스크린 오버레이 OCP 보존 (deprecated 마커)",
    src.includes("deprecated 2026-05-01 — see C-D20-1"),
  );
  assert(
    "C-D20-1: flag ON 시 body lock skip (SideSheet 자체 처리)",
    src.includes("if (SIDE_SHEET_FLAG_ON) return;"),
  );
  assert(
    "C-D20-1: 햄버거 트리거 + aria-expanded 정합",
    src.includes('data-test="mobile-menu-trigger"') &&
      src.includes("aria-expanded={open}"),
  );
}

// 2) C-D20-2 — conversation-api.ts maybeCompactHistory dynamic import.
{
  const src = await readSrc("src/modules/conversation/conversation-api.ts");
  assert(
    "C-D20-2: shouldCompact 정적 import (휴리스틱 < 1kB)",
    src.includes('import { shouldCompact, type Msg } from "@/services/context/contextWindowGuard"'),
  );
  assert(
    "C-D20-2: maybeCompactHistory 함수 정의",
    src.includes("async function maybeCompactHistory("),
  );
  assert(
    "C-D20-2: dynamic import — anthropic-llm-client 메인 번들 외 분리",
    src.includes('import("@/services/context/anthropic-llm-client")'),
  );
  assert(
    "C-D20-2: dynamic import — compact 도 별도 chunk",
    src.includes('import("@/services/context/contextWindowGuard")'),
  );
  assert(
    "C-D20-2: BYOK 키 누락 시 원본 반환 (압축 스킵)",
    src.includes("if (!apiKey)") &&
      src.includes("return history;"),
  );
  assert(
    "C-D20-2: compact 실패 → 원본 반환 + 에러 로깅",
    src.includes("[contextCompact] failed:") &&
      src.includes("console.error"),
  );
  assert(
    "C-D20-2: streamMessage 진입부에서 maybeCompactHistory 호출",
    src.includes("await maybeCompactHistory("),
  );
  assert(
    "C-D20-2: DEFAULT_MODEL_CONTEXT_TOKENS 정의 (보수적 200k)",
    src.includes("DEFAULT_MODEL_CONTEXT_TOKENS = 200_000"),
  );
}

// 3) C-D20-3 — header-cluster-store + handleEmptyIntent 진화.
{
  const storeSrc = await readSrc("src/stores/header-cluster-store.ts");
  assert(
    "C-D20-3: useHeaderClusterStore zustand store 등록",
    storeSrc.includes("export const useHeaderClusterStore") &&
      storeSrc.includes('from "zustand"'),
  );
  assert(
    "C-D20-3: openMenu/closeMenu/setMenuOpen API 노출",
    storeSrc.includes("openMenu:") &&
      storeSrc.includes("closeMenu:") &&
      storeSrc.includes("setMenuOpen:"),
  );
  assert(
    "C-D20-3: menuOpen 기본값 false (SSR 안전)",
    storeSrc.includes("menuOpen: false"),
  );

  const headerSrc = await readSrc(
    "src/modules/conversation/header-cluster.tsx",
  );
  assert(
    "C-D20-3: HeaderCluster 가 useHeaderClusterStore subscribe",
    headerSrc.includes(
      'from "@/stores/header-cluster-store"',
    ) &&
      headerSrc.includes("useHeaderClusterStore"),
  );
  assert(
    "C-D20-3: HeaderCluster 자체 useState 제거 (store lift)",
    !headerSrc.includes("const [open, setOpen] = useState(false)"),
  );

  const viewSrc = await readSrc(
    "src/modules/conversation/conversation-view.tsx",
  );
  assert(
    "C-D20-3: conversation-view 가 openMenu import + 호출",
    viewSrc.includes(
      'from "@/stores/header-cluster-store"',
    ) &&
      viewSrc.includes("openHeaderMenu"),
  );
  assert(
    "C-D20-3: 모바일 < 768px 분기 — 메뉴 열기",
    viewSrc.includes("window.innerWidth < 768"),
  );
  assert(
    "C-D20-3: focusInput 의도 — data-test='message-input' 포커스",
    viewSrc.includes('data-test=\'message-input\'') ||
      viewSrc.includes('data-test="message-input"'),
  );

  const inputSrc = await readSrc("src/modules/conversation/input-bar.tsx");
  assert(
    "C-D20-3: input-bar 에 data-test='message-input' 등록",
    inputSrc.includes('data-test="message-input"'),
  );
}

// 4) C-D20-4 — measure-contrast.mjs 실행 통합.
{
  const pkg = JSON.parse(await readSrc("package.json"));
  assert(
    "C-D20-4: package.json measure:contrast 스크립트 보존",
    typeof pkg.scripts["measure:contrast"] === "string" &&
      pkg.scripts["measure:contrast"].includes("measure-contrast.mjs"),
  );
  // 실제 실행 통합 검증.
  let contrastPass = false;
  try {
    execSync("npm run measure:contrast --silent", { stdio: "pipe" });
    contrastPass = true;
  } catch {
    contrastPass = false;
  }
  assert(
    "C-D20-4: measure-contrast 필수 페어 전건 PASS",
    contrastPass,
    "measure:contrast exit !== 0",
  );
}

// 5) C-D20-5 — eslint.config.mjs + check-vocab --all 0건.
{
  const cfg = await readSrc("eslint.config.mjs");
  assert(
    "C-D20-5: eslint.config.mjs flat config 등록",
    cfg.includes("export default ["),
  );
  assert(
    "C-D20-5: robusta/no-bakeum-in-comment rule 등록 (error)",
    cfg.includes('"robusta/no-bakeum-in-comment": "error"'),
  );
  assert(
    "C-D20-5: eslint-rules/no-bakeum-in-comment.js 참조",
    cfg.includes("./eslint-rules/no-bakeum-in-comment.js"),
  );

  const pkg = JSON.parse(await readSrc("package.json"));
  assert(
    "C-D20-5: package.json check:vocab 스크립트 등록 (--all 모드)",
    typeof pkg.scripts["check:vocab"] === "string" &&
      pkg.scripts["check:vocab"].includes("--all"),
  );

  let vocabPass = false;
  try {
    execSync("node scripts/check-vocab.mjs --all", { stdio: "pipe" });
    vocabPass = true;
  } catch {
    vocabPass = false;
  }
  assert(
    "C-D20-5: check-vocab --all 0건 (src/ 전체)",
    vocabPass,
    "check-vocab.mjs --all exit !== 0",
  );

  const checkSrc = await readSrc("scripts/check-vocab.mjs");
  assert(
    "C-D20-5: check-vocab.mjs --all 모드 추가",
    checkSrc.includes('args[0] === "--all"') &&
      checkSrc.includes("walkSrc"),
  );
  assert(
    "C-D20-5: 정규식 확장 — 박힘/박힌 추가 매칭",
    checkSrc.includes("힘") && checkSrc.includes("힌"),
  );
}

// 6) 게이트 회귀 — typecheck (빠른 검증, build 는 별도).
{
  let typecheckPass = false;
  try {
    execSync("npm run typecheck --silent", { stdio: "pipe" });
    typecheckPass = true;
  } catch {
    typecheckPass = false;
  }
  assert(
    "Gate: tsc --noEmit PASS",
    typecheckPass,
    "typecheck exit !== 0",
  );
}

// 7) 종합 보고.
console.log("");
console.log(`결과: ${pass} PASS / ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
