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

/**
 * C-D23-1 (D6 23시 슬롯, 2026-05-01) — KQ_16 자체 결정 (똘이 21시 미응답).
 *
 * 똘이 §4 D-22 ("참여자 색상 시스템 v2 — 5베이스 WCAG AA") 와 정렬.
 * 5베이스(노랑·청록·라일락·주황·민트) 의 hue 시드 5개로 축소·재정렬.
 *
 * 변경 전(D-D22): [20, 200, 130, 280, 50, 320] (6 hues).
 * 변경 후(D-D23): [20, 50, 150, 200, 280]      (5 hues).
 *   · 핫핑크(320) 제거 — D-22 5베이스 외.
 *   · 130 → 150 (민트는 청록(200)과 거리 50° 확보 — minDistance 30° 게이트 충족 + 시각 구분 강화).
 *   · 라일락(280) 보존, 주황(20) / 노랑(50) / 청록(200) 보존.
 *
 * 영향: 신규 참여자 color 자동 부여 시 5베이스 우선. 기존 conv 의 저장된 hue 는 그대로(영속).
 * 색맹 보강(hueToShape) 은 5분면 boundary 0/72/144/216/288 — 5 hue 가 각 분면에 1개씩 정확 배치.
 *
 * 똘이 21시·다음 슬롯에서 hue 시드 변경 요청 시 본 const 만 교체하면 됨 (호출처 비종속).
 */
export const PARTICIPANT_HUE_SEEDS = [20, 50, 150, 200, 280] as const;

/**
 * C-D24-2 (D6 03시 슬롯, 2026-05-02) — F-53 5베이스 hue CSS 변수 토큰화.
 *   globals.css :root --participant-hue-base-1..5 와 1:1 매핑.
 *   디자이너가 globals.css 1곳을 조정하면 verify-hue-sync.mjs 가 TS 상수와 동기 강제.
 *   배열 인덱스 = PARTICIPANT_HUE_SEEDS 인덱스 (length 5 강제).
 */
export const PARTICIPANT_HUE_SEED_CSS_VARS = [
  "--participant-hue-base-1",
  "--participant-hue-base-2",
  "--participant-hue-base-3",
  "--participant-hue-base-4",
  "--participant-hue-base-5",
] as const;

/**
 * C-D23-1: 5베이스 hue 의 시맨틱 이름 — i18n / 디버그 / aria 보강용.
 *   배열 인덱스가 PARTICIPANT_HUE_SEEDS 와 동기. 길이 5 강제 — 추가 시 양 const 같이 수정.
 *   ko/en 양면 — 호출자가 locale 결정.
 */
export const PARTICIPANT_HUE_SEED_NAMES = {
  ko: ["주황", "노랑", "민트", "청록", "라일락"],
  en: ["orange", "yellow", "mint", "teal", "lilac"],
} as const;

/**
 * C-D25-3 (D6 07시 슬롯, 2026-05-02) — KQ_18.2 (b) PersonaColorToken → hue 매핑 정의.
 * C-D26-5 (D6 11시 슬롯, 2026-05-02) — KQ_20 (a) 흡수: 본 파일에서 분리 → ./theme-hue.ts.
 *   theme.ts (다크모드 store + cookie boot) 는 layout.tsx 가 정적 import 하므로 메인 번들 핵심.
 *   카드 표시 전용 매핑은 별도 chunk 로 옮겨 168 kB 회복.
 *   호출자(persona-picker-modal / persona-card-color-dot) 는 "@/modules/ui/theme-hue" 직접 import.
 */

/**
 * C-D23-1: 임의 hue 값(0~360) → 5베이스 중 가장 가까운 이름 반환.
 *   Wrap-around 거리 계산 — 350° 와 10° 는 20° 거리.
 *   참여자 hue 가 baseSeed 와 정확히 같지 않아도 1차 분면에서 결정적 매핑.
 */
export function hueToBaseName(hue: number, locale: "ko" | "en" = "ko"): string {
  const norm = ((hue % 360) + 360) % 360;
  let bestIdx = 0;
  let bestDist = 360;
  for (let i = 0; i < PARTICIPANT_HUE_SEEDS.length; i += 1) {
    const seed = PARTICIPANT_HUE_SEEDS[i]!;
    const d = Math.abs(norm - seed);
    const dist = Math.min(d, 360 - d);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }
  return PARTICIPANT_HUE_SEED_NAMES[locale][bestIdx]!;
}

export type RobustaTheme = typeof robustaTokens;
export type ThemeMode = "light" | "dark";

// C-D18-2 (D6 03시 슬롯, 2026-05-01) — KQ_14 채택분.
// 사용자 선택 3-state: 'system' (OS 자동) / 'light' / 'dark'.
// 'resolved' 는 항상 light/dark — DOM/CSS는 resolved 만 본다.
export type ThemeChoice = "system" | "light" | "dark";

// D-9.1: settings 테이블의 키 이름.
const SETTINGS_THEME_KEY = "theme";
// C-D18-2: 사용자가 선택한 3-state 값 — 'theme' (resolved light/dark) 와 분리 저장.
//   기존 'theme' 키와 충돌 없음 — 'theme' 은 D-9.1 부터 light/dark만 저장.
const SETTINGS_CHOICE_KEY = "theme.choice";
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

/**
 * C-D17-20 (Day 5 19시 슬롯, 2026-04-30) — F-19: 초기 테마 결정 헬퍼.
 *   우선순위 — cookie > prefers-color-scheme > 'light'.
 *   id-22 정합 — 사용자 명시(cookie) 우선, 시스템 자동(prefers) 보조.
 *   matchMedia 미지원 (구형 브라우저) → 'light' fallback.
 *   layout.tsx boot script와 동일한 로직을 TS 측에 정의 — 단위 검증 가능 (#181~#183).
 */
export function getInitialTheme(): ThemeMode {
  const cookie = readBootCookie();
  if (cookie === "light" || cookie === "dark") return cookie;
  if (getSystemDark()) return "dark";
  return "light";
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
  /** 현재 적용된 테마(resolved) — 'light' | 'dark'. CSS/DOM은 이 값을 본다. */
  theme: ThemeMode;
  /**
   * C-D18-2 (D6 03시 KQ_14): 사용자가 선택한 3-state — 'system' | 'light' | 'dark'.
   * 'system' 일 때 prefers-color-scheme 을 그대로 따르고, light/dark 일 때 사용자 명시(override).
   * 기존 호출자(theme: light/dark) 호환 유지 — choice 미사용 시 기존 behavior 동일.
   */
  choice: ThemeChoice;
  /** 클라이언트 hydration 완료 여부 (SSR 깜빡임 방지용). */
  hydrated: boolean;
  /** 첫 마운트 시 1회 호출 — IndexedDB 마이그레이션 + 읽기 + DOM 적용. */
  hydrate: () => Promise<void>;
  /** 테마 직접 설정 (light/dark) — choice='light'|'dark'(override) 로 정렬됨. */
  setTheme: (theme: ThemeMode) => Promise<void>;
  /** C-D18-2: 3-state 선택 — 'system' 선택 시 userOverride 해제, prefers 동기화. */
  setChoice: (choice: ThemeChoice) => Promise<void>;
  /** 토글 (light ↔ dark) — choice도 동일하게 갱신. */
  toggle: () => Promise<void>;
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  theme: "light",
  choice: "system",
  hydrated: false,

  async hydrate() {
    // 1) localStorage → IndexedDB 1회 이관 (D-9.1)
    await migrateThemeFromLocalStorage();

    // 2) 읽기 우선순위:
    //    a. settings.theme.choice (D6 신규) → 3-state 직접
    //    b. settings.theme         (D-9.1)  → light/dark = override → choice 동일 매핑
    //    c. cookie/prefers/'light'           → choice='system' 가정
    let choice: ThemeChoice = "system";
    let resolved: ThemeMode;
    try {
      const db = getDb();
      const storedChoice = await db.settings.get(SETTINGS_CHOICE_KEY);
      if (
        storedChoice?.value === "system" ||
        storedChoice?.value === "light" ||
        storedChoice?.value === "dark"
      ) {
        choice = storedChoice.value;
      } else {
        // legacy: settings.theme(light/dark) 가 정의되어 있으면 override 의미로 choice 매핑
        const stored = await db.settings.get(SETTINGS_THEME_KEY);
        if (stored?.value === "light" || stored?.value === "dark") {
          choice = stored.value;
        }
      }
    } catch {
      // IndexedDB 차단 — choice='system' 유지
    }

    if (choice === "light" || choice === "dark") {
      resolved = choice;
    } else {
      // choice='system' — cookie 우선, 그다음 prefers, 그다음 'light'
      const cookieVal = readBootCookie();
      resolved = cookieVal ?? (getSystemDark() ? "dark" : "light");
    }

    applyThemeToDom(resolved);
    set({ theme: resolved, choice, hydrated: true });

    // 3) D-9.5 (P1): prefers-color-scheme listener — choice='system' 일 때만 따름.
    //    기존 SETTINGS_USER_OVERRIDE_KEY 는 choice 와 동등 (light/dark = override).
    setupPrefersColorSchemeListener();
  },

  async setTheme(theme) {
    // 호환 경로 — choice 도 동일하게 light/dark 로 정렬 (override).
    await get().setChoice(theme);
  },

  async setChoice(choice) {
    // resolved 계산 — choice='system' 이면 prefers 따름.
    const resolved: ThemeMode =
      choice === "light" || choice === "dark"
        ? choice
        : getSystemDark()
          ? "dark"
          : "light";

    applyThemeToDom(resolved);
    writeBootCookie(resolved); // 다음 부트 깜빡임 방지 — 항상 resolved 등록
    set({ theme: resolved, choice });

    try {
      const db = getDb();
      await db.settings.put({
        key: SETTINGS_CHOICE_KEY,
        value: choice,
        updatedAt: Date.now(),
      });
      // 기존 'theme' 키 — light/dark 는 그대로 적용하고 'system' 일 때는 resolved 보존(레거시 호환).
      await db.settings.put({
        key: SETTINGS_THEME_KEY,
        value: resolved,
        updatedAt: Date.now(),
      });
      // userOverride: light/dark 면 true, system 이면 false (prefers listener 다시 활성).
      await db.settings.put({
        key: SETTINGS_USER_OVERRIDE_KEY,
        value: choice === "system" ? "false" : "true",
        updatedAt: Date.now(),
      });
    } catch (err) {
      // IndexedDB 차단 — 메모리 only (D3 패턴 계승). cookie는 등록.
      console.warn("[robusta] theme persist failed", err);
    }
  },

  async toggle() {
    // light → dark → system → light 의 3-cycle 도 가능하지만, 기존 toggle 의미 보존 위해
    // light ↔ dark 만 순환. system 에서 toggle 호출 시 현재 resolved 의 반대로.
    const cur = get();
    const next: ThemeMode = cur.theme === "light" ? "dark" : "light";
    await get().setChoice(next);
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
    // C-D18-2: choice='system' 유지(선택은 system 그대로) + theme(resolved)만 갱신.
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
  // C-D17-20 (Day 5 19시) F-19: 단위 테스트용 export.
  getInitialTheme,
};
