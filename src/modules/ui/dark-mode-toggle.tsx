"use client";

/**
 * dark-mode-toggle.tsx
 *   - C-D40-2 (D-3 03시 슬롯, 2026-05-05) — Tori spec C-D40-2 (V-D40-2 + D-D40-1).
 *   - 자율 D-41-자-1 (D-3 07시 슬롯, 2026-05-05) — a11y 보강:
 *     · aria-label 동적 합성 (현재 상태 + 다음 액션 — 스크린리더 정합).
 *     · focus-visible:ring-2 키보드 포커스 가시화 (WCAG 2.4.7 정합 / header-cluster #192 패턴 일관).
 *     · aria-live="polite" sr-only status — 토글 시 변경 알림 (스크린리더 사용자).
 *     · 회귀 위험 0 — verify-d40 게이트 (data-test/export 시그니처/디자인 토큰 10종) 모두 보존.
 *
 * Why: 우상단 fixed 토글 버튼 — 'system'/'light'/'dark' 3-way cycle.
 *   D-3 본격 다크모드 토글 본체 — D-2/D-1 a11y 권장 사전 진행 (자율 슬롯).
 *
 * 자율 정정 (D-40-자-1): 명세 src/modules/theme/dark-mode-toggle.tsx 신규 디렉토리 →
 *   실 SoT = src/modules/ui/* (theme.ts/theme-hue.ts 분리 패턴 정합 / D-26 Tori KQ_20 (a) 결정).
 *
 * 자율 정정 (D-40-자-2): 명세 localStorage 'robusta:theme:mode' →
 *   실 SoT = useThemeStore (D-9.1 IndexedDB(settings) 영구화 + cookie 'robusta.theme.boot' 부트 깜빡임 방지).
 *   useDarkMode hook 신규 X — useThemeStore.setChoice 직접 호출 (보존 13 v3 무손상 + 백워드 호환).
 *
 * 디자인 토큰 (D-D40-1 정확 일치 / Secondary border outline):
 *   container: fixed top-3 right-3 z-50
 *   button:    bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 px-2 py-1 text-xs rounded
 *              border border-stone-300 dark:border-stone-700
 *              hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors
 *              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-500
 *              dark:focus-visible:ring-stone-400 focus-visible:ring-offset-2
 *              focus-visible:ring-offset-white dark:focus-visible:ring-offset-stone-900
 *
 * 엣지:
 *   - hydrate 전 SSR 깜빡임 회피: hydrated=false 면 placeholder 너비만 (cycle 라벨 미렌더 + aria-label 안내).
 *   - 'system' 일 때 prefers-color-scheme listener 가 자동 갱신 (theme.ts 본체).
 *   - 1회 클릭 = 1회 cycle: system → light → dark → system.
 *
 * 보존 13 영향: 0 — 신규 컴포넌트, layout.tsx 1줄 마운트만.
 */

import { useEffect } from "react";
import type { JSX } from "react";
import { useThemeStore } from "@/modules/ui/theme";
import type { ThemeChoice } from "@/modules/ui/theme";

/** cycle 순서 — D-D40-1 의장 정합 (system 시작 권장 — prefers 따름). */
const CYCLE: ThemeChoice[] = ["system", "light", "dark"];

function nextChoice(cur: ThemeChoice): ThemeChoice {
  const idx = CYCLE.indexOf(cur);
  return CYCLE[(idx + 1) % CYCLE.length]!;
}

function labelOf(choice: ThemeChoice): string {
  switch (choice) {
    case "system":
      return "auto";
    case "light":
      return "light";
    case "dark":
      return "dark";
  }
}

/** a11y: 현재 상태 한국어 라벨 (스크린리더 정합 / 자율 D-41-자-1). */
function ariaLabelOf(choice: ThemeChoice): string {
  switch (choice) {
    case "system":
      return "자동";
    case "light":
      return "라이트";
    case "dark":
      return "다크";
  }
}

export function DarkModeToggle(): JSX.Element {
  const choice = useThemeStore((s) => s.choice);
  const hydrated = useThemeStore((s) => s.hydrated);
  const hydrate = useThemeStore((s) => s.hydrate);
  const setChoice = useThemeStore((s) => s.setChoice);

  // 첫 마운트 시 1회 hydrate (theme.ts 본체) — 이미 hydrate 됐으면 noop.
  useEffect(() => {
    if (!hydrated) {
      void hydrate();
    }
  }, [hydrated, hydrate]);

  const onClick = () => {
    void setChoice(nextChoice(choice));
  };

  // 자율 D-41-자-1: a11y aria-label 동적 합성 — 현재 상태 + 다음 액션.
  //   hydrated=false: "다크모드 토글 (로딩 중)" — 키보드 포커스 시 명확 안내.
  //   hydrated=true:  "다크모드 토글: 현재 자동, 클릭하면 라이트로" 형식.
  const nextLabel = ariaLabelOf(nextChoice(choice));
  const ariaLabel = hydrated
    ? `다크모드 토글: 현재 ${ariaLabelOf(choice)}, 클릭하면 ${nextLabel}로`
    : "다크모드 토글 (로딩 중)";

  return (
    <div className="fixed top-3 right-3 z-50">
      <button
        type="button"
        onClick={onClick}
        data-test="dark-mode-toggle"
        aria-label={ariaLabel}
        className="bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 px-2 py-1 text-xs rounded border border-stone-300 dark:border-stone-700 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-500 dark:focus-visible:ring-stone-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-stone-900"
      >
        {hydrated ? labelOf(choice) : "—"}
      </button>
      {/* 자율 D-41-자-1: sr-only live region — 토글 시 스크린리더에 현재 상태 안내. */}
      <span className="sr-only" role="status" aria-live="polite" data-test="dark-mode-toggle-status">
        {hydrated ? `테마: ${ariaLabelOf(choice)}` : ""}
      </span>
    </div>
  );
}

export default DarkModeToggle;
