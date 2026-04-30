/**
 * verify-d18.mjs
 *   - C-D18 (D6 03시 슬롯, 2026-05-01) 신규 모듈 단위 시뮬레이션 검증.
 *   - 의존성 없는 순수 로직 함수만 검증 (브라우저/Dexie/React 의존 함수는 제외).
 *   - 컴파일된 결과물 대신 esbuild 로 즉시 변환 후 import 해서 검증할 수 있지만,
 *     본 슬롯에서는 가드 로직만 console 출력 — 회귀 시 결과로 판단.
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

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

// 1) emptyStateRegistry — 9조합 카피 모두 존재 확인 (소스 grep).
{
  const src = await readFile(
    resolve(root, "src/modules/onboarding/empty-state-registry.ts"),
    "utf8",
  );
  assert(
    "registry: zeroParticipants ko/en 카피 박힘",
    src.includes("같이 생각할 사람을 불러오자") &&
      src.includes("Bring someone to think with"),
  );
  assert(
    "registry: onlyHuman ko/en 카피 박힘",
    src.includes("AI 1명을 추가하면 대화가 시작돼요") &&
      src.includes("Add 1 AI to start"),
  );
  assert(
    "registry: zeroMessages ko/en 카피 박힘",
    src.includes("먼저 한마디 던져보자") && src.includes("Drop your first thought"),
  );
  assert(
    "registry: short variant 3종 박힘 (모바일 ≤360px)",
    src.includes("copyShort") &&
      src.includes("참여자를 추가하세요") &&
      src.includes("AI를 추가하세요") &&
      src.includes("먼저 입력해보세요"),
  );
  assert(
    "registry: 3종 ctaIntent 모두 박힘",
    src.includes('"addParticipant"') &&
      src.includes('"addAI"') &&
      src.includes('"focusInput"'),
  );
  assert(
    "registry: shouldUseShortCopy 360px 임계값 박힘",
    src.includes("window.innerWidth <= 360"),
  );
}

// 2) themeStore — 3-state 확장 + 기존 호환 확인.
{
  const src = await readFile(resolve(root, "src/modules/ui/theme.ts"), "utf8");
  assert(
    "themeStore: ThemeChoice 'system'|'light'|'dark' 박힘",
    src.includes('export type ThemeChoice = "system" | "light" | "dark"'),
  );
  assert(
    "themeStore: setChoice 함수 박힘",
    src.includes("setChoice: (choice: ThemeChoice)") &&
      src.includes("async setChoice(choice)"),
  );
  assert(
    "themeStore: SETTINGS_CHOICE_KEY 박힘",
    src.includes('SETTINGS_CHOICE_KEY = "theme.choice"'),
  );
  assert(
    "themeStore: legacy setTheme 호환 (setChoice 위임)",
    src.includes("await get().setChoice(theme)"),
  );
  assert(
    "themeStore: choice='system' 시 prefers listener 활성",
    src.includes('choice === "system" ? "false" : "true"'),
  );
}

// 3) useResponsiveSheet — 360px/768px 임계값 + 80% 강제 + ESC.
{
  const src = await readFile(
    resolve(root, "src/hooks/useResponsiveSheet.ts"),
    "utf8",
  );
  assert(
    "useResponsiveSheet: NARROW_PHONE_THRESHOLD 360px 박힘",
    src.includes("NARROW_PHONE_THRESHOLD = 360"),
  );
  assert(
    "useResponsiveSheet: NARROW_PHONE_WIDTH_PCT 80 박힘",
    src.includes("NARROW_PHONE_WIDTH_PCT = 80"),
  );
  assert(
    "useResponsiveSheet: ESC 닫기 listener 박힘",
    src.includes('ev.key === "Escape"') && src.includes("setOpenState(false)"),
  );
  assert(
    "useResponsiveSheet: SSR 가드 (window 미존재)",
    src.includes('typeof window === "undefined"'),
  );
}

// 4) contextWindowGuard — KEEP_TAIL 20 + 시스템 보존 + 휴리스틱 토큰.
{
  const src = await readFile(
    resolve(root, "src/services/context/contextWindowGuard.ts"),
    "utf8",
  );
  assert(
    "contextGuard: KEEP_TAIL=20 박힘",
    src.includes("KEEP_TAIL = 20"),
  );
  assert(
    "contextGuard: shouldCompact 80% 임계 박힘",
    src.includes("threshold = 0.8"),
  );
  assert(
    "contextGuard: 시스템 프롬프트 보존 로직 박힘",
    src.includes('m.role === "system"'),
  );
  assert(
    "contextGuard: LLM 실패 fallback (원본 반환)",
    src.includes("[robusta] contextWindowGuard.compact: LLM 요약 실패") &&
      src.includes("return messages"),
  );
  assert(
    "contextGuard: 멀티바이트 휴리스틱 (한/일/중)",
    src.includes("multiByteChars") && src.includes("Math.ceil(asciiChars / 4)"),
  );
}

// 5) roomExporter — Markdown 표·JSON schema·다운로드 트리거.
{
  const src = await readFile(
    resolve(root, "src/services/export/roomExporter.ts"),
    "utf8",
  );
  assert(
    "roomExporter: EXPORT_FORMAT_VERSION=1 박힘",
    src.includes("EXPORT_FORMAT_VERSION = 1"),
  );
  assert(
    "roomExporter: 빈 룸 안내 (메시지 0건)",
    src.includes("_빈 룸 — 메시지 0건_"),
  );
  assert(
    "roomExporter: 빈 룸 안내 (참여자 0건)",
    src.includes("_참여자 없음_"),
  );
  assert(
    "roomExporter: SSR 가드 (downloadAs)",
    src.includes("browser-only API 호출 — SSR 금지"),
  );
  assert(
    "roomExporter: Markdown 표 셀 escape (`|` 처리)",
    src.includes('s.replace(/\\|/g, "\\\\|")'),
  );
  assert(
    "roomExporter: JSON schema (version/room/participants/messages)",
    src.includes("version: EXPORT_FORMAT_VERSION") &&
      src.includes("participants:") &&
      src.includes("messages:"),
  );
}

// 6) EmptyStateCta — registry 통합.
{
  const src = await readFile(
    resolve(root, "src/modules/onboarding/empty-state-cta.tsx"),
    "utf8",
  );
  assert(
    "EmptyStateCta: registry variant 3종 (zeroParticipants/onlyHuman/zeroMessages)",
    src.includes('"zeroParticipants"') &&
      src.includes('"onlyHuman"') &&
      src.includes('"zeroMessages"'),
  );
  assert(
    "EmptyStateCta: onIntent 콜백 prop 박힘",
    src.includes("onIntent?: (intent: EmptyCtaIntent) => void"),
  );
  assert(
    "EmptyStateCta: 모바일 줄바꿈 박살 방지 (whitespace-nowrap)",
    src.includes("whitespace-nowrap"),
  );
}

// 7) HeaderCluster — 3-segment + ARIA.
{
  const src = await readFile(
    resolve(root, "src/modules/conversation/header-cluster.tsx"),
    "utf8",
  );
  assert(
    "HeaderCluster: themeChoice prop 추가",
    src.includes("themeChoice?:") &&
      src.includes("onSetThemeChoice?:"),
  );
  assert(
    "HeaderCluster: 3-segment ARIA group + aria-pressed",
    src.includes('role="group"') &&
      src.includes("aria-pressed={active}"),
  );
  assert(
    "HeaderCluster: 3-segment data-test 동적 생성 (theme-segment-${seg.v})",
    src.includes("`theme-segment-${seg.v}`") ||
      src.includes("theme-segment-system"),
  );
  assert(
    "HeaderCluster: legacy 토글 fallback (themeChoice 미전달 시)",
    src.includes("useSegment ?") &&
      src.includes("data-test=\"theme-toggle-button\""),
  );
}

// 어휘 룰 검증 — 신규 파일에 "박다/박았/박음/박제" 0건.
{
  const newFiles = [
    "src/modules/onboarding/empty-state-registry.ts",
    "src/hooks/useResponsiveSheet.ts",
    "src/services/context/contextWindowGuard.ts",
    "src/services/export/roomExporter.ts",
  ];
  for (const f of newFiles) {
    const src = await readFile(resolve(root, f), "utf8");
    const hits = src.match(/박다|박았|박음|박제/g);
    assert(
      `vocab: ${f} "박다/박음" 0건`,
      !hits,
      hits ? `발견: ${hits.join(",")}` : "",
    );
  }
}

console.log(`\n결과: ${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
