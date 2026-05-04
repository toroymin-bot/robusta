"use client";

/**
 * dark-mode-toggle.tsx
 *   - C-D40-2 (D-3 03시 슬롯, 2026-05-05) — Tori spec C-D40-2 (V-D40-2 + D-D40-1).
 *
 * Why: 우상단 fixed 토글 버튼 — 'system'/'light'/'dark' 3-way cycle.
 *   D-3 본격 다크모드 토글 본체 — D-2/D-1 a11y/icon 보강 가능.
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
 *
 * 엣지:
 *   - hydrate 전 SSR 깜빡임 회피: hydrated=false 면 placeholder 너비만 (cycle 라벨 미렌더).
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

  return (
    <div className="fixed top-3 right-3 z-50">
      <button
        type="button"
        onClick={onClick}
        data-test="dark-mode-toggle"
        aria-label="다크모드 토글"
        className="bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 px-2 py-1 text-xs rounded border border-stone-300 dark:border-stone-700 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
      >
        {hydrated ? labelOf(choice) : "—"}
      </button>
    </div>
  );
}

export default DarkModeToggle;
