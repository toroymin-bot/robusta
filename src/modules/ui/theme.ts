/**
 * theme.ts
 *   - D2: 토큰 정의.
 *   - D3 (D-8.6, P1): 다크모드 토글 store + ~~localStorage persist~~.
 *   - D4 (D-9.1, P0): 영구화 백엔드를 IndexedDB(settings) 로 이관.
 *     · 단일 진실 소스: db.settings('theme').
 *     · 첫 페인트 깜빡임 방지 hint: cookie 'robusta.theme.boot' (동기 read 가능).
 *     · 보안 명세 D-4.4(localStorage 미사용)는 API 키 한정 — 테마는 보안 무관이지만,
 *       데이터 통합을 위해 IndexedDB로 일원화. layout.tsx의 부트 inline script 도 cookie read.
 *   - D4 (D-9.5, P1): prefers-color-scheme 'change' listener — 사용자 미명시 시만 따름.
 *
 * 영구화 흐름:
 *   1. layout.tsx <head> inline script: cookie 'robusta.theme.boot' 읽고 <html data-theme> 즉시 적용 (깜빡임 방지).
 *   2. useThemeStore.hydrate(): migrateThemeFromLocalStorage() 1회 → settings.get('theme') → state 동기화.
 *   3. setTheme(t): settings.put + cookie 갱신 + html data-theme + state.
 */

"use client";

import { create } from "zustand";
import { getDb, migrateThemeFromLocalStorage } from "@/modules/storage/db";

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

// D-9.1: settings 테이블의 키 이름.
const SETTINGS_THEME_KEY = "theme";
// D-9.1: 부트 깜빡임 방지 cookie 이름. 정적 export 호환 (서버 set-cookie 불필요).
const BOOT_COOKIE = "robusta.theme.boot";
// D-9.5: 사용자 명시 override 표식 — true 면 prefers-color-scheme listener 무시.
const SETTINGS_USER_OVERRIDE_KEY = "theme.userOverride";

/** ~~localStorage 키 (D-8.6 P1)~~ → D-9.1: IndexedDB로 이관. legacy 마이그레이션은 db.ts 내부에서. */
// const STORAGE_KEY = "robusta:theme"; // ← removed

/**
 * 시스템 prefers-color-scheme 기준 dark 여부.
 * 서버/SSR 또는 matchMedia 미지원 시 false.
 */
function getSystemDark(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** cookie 읽기 (boot inline script와 동기화 위해 동기 함수). */
function readBootCookie(): ThemeMode | null {
  if (typeof document === "undefined") return null;
  try {
    const cookies = document.cookie.split(";");
    for (const c of cookies) {
      const [k, v] = c.split("=").map((s) => s?.trim());
      if (k === BOOT_COOKIE && (v === "light" || v === "dark")) return v;
    }
  } catch {
    // cookie 차단 환경 — silent
  }
  return null;
}

/** cookie 쓰기 (1년 만료, SameSite=Lax). 정적 export + 동일 origin. */
function writeBootCookie(theme: ThemeMode): void {
  if (typeof document === "undefined") return;
  try {
    // 1년 = 31536000초. SameSite=Lax (XSRF 안전, 정적 페이지 OK).
    document.cookie = `${BOOT_COOKIE}=${theme}; path=/; max-age=31536000; SameSite=Lax`;
  } catch {
    // cookie 차단 — silent
  }
}

/** <html data-theme> + tailwind 'dark' class 동기화 (정적 export 호환). */
function applyThemeToDom(theme: ThemeMode): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset["theme"] = theme;
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
  /** 첫 마운트 시 1회 호출 — IndexedDB 마이그레이션 + 읽기 + DOM 적용. */
  hydrate: () => Promise<void>;
  /** 테마 직접 설정 (light/dark) — IndexedDB persist + cookie + DOM + userOverride 박음. */
  setTheme: (theme: ThemeMode) => Promise<void>;
  /** 토글 (light ↔ dark). */
  toggle: () => Promise<void>;
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  theme: "light",
  hydrated: false,

  async hydrate() {
    // 1) localStorage → IndexedDB 1회 이관 (D-9.1)
    await migrateThemeFromLocalStorage();

    // 2) 읽기 우선순위: settings.theme → cookie → 시스템 prefers → 'light'
    let resolved: ThemeMode = "light";
    try {
      const db = getDb();
      const stored = await db.settings.get(SETTINGS_THEME_KEY);
      if (stored?.value === "light" || stored?.value === "dark") {
        resolved = stored.value;
      } else {
        const cookieVal = readBootCookie();
        resolved = cookieVal ?? (getSystemDark() ? "dark" : "light");
      }
    } catch {
      // IndexedDB 차단 — cookie/시스템 prefers fallback
      const cookieVal = readBootCookie();
      resolved = cookieVal ?? (getSystemDark() ? "dark" : "light");
    }

    applyThemeToDom(resolved);
    set({ theme: resolved, hydrated: true });

    // 3) D-9.5 (P1): prefers-color-scheme listener — userOverride 박혀있지 않을 때만 따름.
    //    이미 사용자 명시 setTheme 호출이 있었으면 IndexedDB의 theme.userOverride === 'true'.
    setupPrefersColorSchemeListener();
  },

  async setTheme(theme) {
    applyThemeToDom(theme);
    writeBootCookie(theme); // 다음 부트 깜빡임 방지
    set({ theme });
    // IndexedDB persist + userOverride=true (이후 prefers-color-scheme listener 무시)
    try {
      const db = getDb();
      await db.settings.put({
        key: SETTINGS_THEME_KEY,
        value: theme,
        updatedAt: Date.now(),
      });
      await db.settings.put({
        key: SETTINGS_USER_OVERRIDE_KEY,
        value: "true",
        updatedAt: Date.now(),
      });
    } catch (err) {
      // IndexedDB 차단 — 메모리 only (D3 패턴 계승). cookie는 박힘.
      console.warn("[robusta] theme persist failed", err);
    }
  },

  async toggle() {
    await get().setTheme(get().theme === "light" ? "dark" : "light");
  },
}));

/**
 * D-9.5 (P1, F-D3-9): prefers-color-scheme 'change' listener.
 *   - 사용자가 setTheme 호출한 적 없으면(theme.userOverride !== 'true') 시스템 변경에 따라 theme 갱신.
 *   - 한 번만 setup (모듈 단위 boolean 가드).
 *   - Safari 14+, Chrome/Edge/Firefox 안정 (추정 19).
 */
let prefersListenerSetup = false;
function setupPrefersColorSchemeListener(): void {
  if (prefersListenerSetup) return;
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
  const mql = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = async (ev: MediaQueryListEvent) => {
    try {
      const db = getDb();
      const override = await db.settings.get(SETTINGS_USER_OVERRIDE_KEY);
      if (override?.value === "true") return; // 사용자 명시 우선 — listener 무시
    } catch {
      // IndexedDB 차단 — 시스템 변경에 따름
    }
    const next: ThemeMode = ev.matches ? "dark" : "light";
    applyThemeToDom(next);
    writeBootCookie(next);
    useThemeStore.setState({ theme: next });
  };
  // Safari 14+ 표준 API. 이전 Safari fallback (addListener)은 이미 EOL 직전이라 생략.
  if (typeof mql.addEventListener === "function") {
    mql.addEventListener("change", handler);
    prefersListenerSetup = true;
  }
}

export const __theme_internal = {
  SETTINGS_THEME_KEY,
  SETTINGS_USER_OVERRIDE_KEY,
  BOOT_COOKIE,
  readBootCookie,
  writeBootCookie,
  applyThemeToDom,
  getSystemDark,
};
