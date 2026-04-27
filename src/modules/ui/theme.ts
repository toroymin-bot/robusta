/**
 * theme.ts — D2: tokens 정의만. D3 (D-8.6, P1, 2026-04-27): 다크모드 토글 store + persist.
 *
 * 영구화 방식: localStorage (key='robusta:theme'). IndexedDB settings는 D4 D-9.1 정식.
 *   ⚠ 보안 명세 D-4.4 (localStorage 미사용)는 API 키에 한정. 테마는 보안 무관이라 OK.
 *
 * SSR 깜빡임 방지: layout.tsx 의 <head> inline script가 첫 렌더 직전에 data-theme 적용.
 */

"use client";

import { create } from "zustand";

export const robustaTokens = {
  light: {
    canvas: "#FFFCEB",
    ink: "#15140E",
    inkDim: "#5C5849",
    divider: "#EAE3C7",
    accent: "#C9A227",
    accentSoft: "#F1E1A1",
  },
  dark: {
    canvas: "#1A1814",
    ink: "#F1E9CC",
    inkDim: "#A39A7E",
    divider: "#2E2A20",
    accent: "#E2B946",
    accentSoft: "#3A3320",
  },
} as const;

export const PARTICIPANT_HUE_SEEDS = [20, 200, 130, 280, 50, 320] as const;

export type RobustaTheme = typeof robustaTokens;
export type ThemeMode = "light" | "dark";

const STORAGE_KEY = "robusta:theme";

/**
 * 시스템 prefers-color-scheme 기준 dark 여부.
 * 서버/SSR에서는 false 반환 (window 미정의).
 */
function getSystemDark(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/**
 * localStorage에서 저장된 테마 읽기. 미저장 시 시스템 prefers 폴백.
 * SSR 안전 — window 없으면 'light' 반환.
 */
function readInitialTheme(): ThemeMode {
  if (typeof window === "undefined") return "light";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // localStorage 접근 실패 (private browsing 등) → 시스템 폴백
  }
  return getSystemDark() ? "dark" : "light";
}

/**
 * <html data-theme="..."> 적용 + tailwind 'dark' class 동기화 (정적 export 호환).
 */
function applyThemeToDom(theme: ThemeMode): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset["theme"] = theme;
  // tailwind dark variants도 함께 동작하도록 'dark' class 토글
  if (theme === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

interface ThemeStore {
  /** 현재 적용된 테마 — 'light' | 'dark'. */
  theme: ThemeMode;
  /** 클라이언트 hydration 완료 여부 (SSR 깜빡임 방지용). */
  hydrated: boolean;
  /** 첫 마운트 시 호출 — localStorage / 시스템 prefers 읽고 store 동기화. */
  hydrate: () => void;
  /** 테마 직접 설정 (light/dark). */
  setTheme: (theme: ThemeMode) => void;
  /** 토글 (light ↔ dark). */
  toggle: () => void;
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  theme: "light",
  hydrated: false,
  hydrate() {
    const initial = readInitialTheme();
    applyThemeToDom(initial);
    set({ theme: initial, hydrated: true });
  },
  setTheme(theme) {
    applyThemeToDom(theme);
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, theme);
      }
    } catch (err) {
      // localStorage 쓰기 실패 → 콘솔 warn만 (silent fallback, 명세 §7 엣지)
      console.warn("[robusta] theme persist failed", err);
    }
    set({ theme });
  },
  toggle() {
    get().setTheme(get().theme === "light" ? "dark" : "light");
  },
}));

export const __theme_internal = { STORAGE_KEY, readInitialTheme, applyThemeToDom };
