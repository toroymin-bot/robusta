/**
 * kq23-banner-expiry.ts
 *   - C-D53-4 (D-1 07시 슬롯, 2026-05-07) — Tori spec C-D53-4 (F-D53-2 / F-D52-3 본체).
 *
 * Why: KQ_23 banner localStorage 24h hold 만료 영구 클리어 헬퍼.
 *   라이브 후 banner 누적 0 보장 — 5/8 D-Day 라이브 시점에 banner 자연 dismiss 가능.
 *   wiring (KQ_23 banner UI) 은 D+1 운용 슬롯 큐 (release freeze 정합).
 *
 * 정책 (명세 § 14 정합):
 *   - dismissedAtIso === null → false (banner 표시)
 *   - 만료 = (now - dismissedAt) ≥ 24h → true (banner 영구 dismiss)
 *   - invalid Date (NaN) → false (방어)
 *   - clock skew (now < dismissedAt) → false (음수 차이 = 미만료)
 *   - SSR (typeof window === 'undefined') + opts 미지정 → throw 'kq23-banner-expiry: server-only'
 *
 * 의존:
 *   - NOW_ISO_OVERRIDE env 재사용 SoT (D-52-자-6 정책) — opts.now 우선, 미지정 시 new Date().
 *
 * 보존 13 영향: 0 (신규 모듈).
 * 외부 dev-deps +0.
 *
 * wiring 큐: KQ_23 banner UI 컴포넌트 wiring 은 D+1 운용 슬롯 (라이브 후 banner 자연 dismiss).
 *   본 슬롯은 헬퍼 + sim 만 — 사용처 0 = 회귀 0.
 */

export const KQ23_BANNER_HOLD_MS = 24 * 60 * 60 * 1000;
const KQ23_LOCALSTORAGE_KEY = "kq23.dismissedAt";

export interface ShouldDismissOpts {
  /** 테스트 inject — 미지정 시 new Date(). NOW_ISO_OVERRIDE env 재사용 SoT. */
  now?: Date;
  /**
   * 테스트 inject — 미지정 시 production 은 localStorage 호출 (SSR throw).
   * null 명시 → banner 표시 (dismiss 안 함).
   */
  dismissedAtIso?: string | null;
}

/**
 * shouldDismissKq23Banner — KQ_23 banner 영구 dismiss 여부 판정.
 *   순수 함수 (opts 모두 inject 시 외부 부수효과 0).
 *
 *   true → banner 영구 dismiss (24h 경과)
 *   false → banner 표시 (미만료, 미dismiss, 또는 invalid).
 */
export function shouldDismissKq23Banner(opts: ShouldDismissOpts = {}): boolean {
  const now = opts.now ?? new Date();

  // dismissedAtIso 명시 시 inject 우선 (테스트/SSR safe).
  let dismissedAtIso: string | null;
  if (opts.dismissedAtIso !== undefined) {
    dismissedAtIso = opts.dismissedAtIso;
  } else {
    if (typeof window === "undefined") {
      throw new Error(
        "kq23-banner-expiry: server-only without dismissedAtIso inject",
      );
    }
    dismissedAtIso = window.localStorage.getItem(KQ23_LOCALSTORAGE_KEY);
  }

  // null → banner 표시.
  if (dismissedAtIso === null) return false;

  const dismissedMs = new Date(dismissedAtIso).getTime();

  // invalid Date → false (방어).
  if (Number.isNaN(dismissedMs)) return false;

  const diffMs = now.getTime() - dismissedMs;

  // clock skew (now < dismissedAt) → false.
  if (diffMs < 0) return false;

  return diffMs >= KQ23_BANNER_HOLD_MS;
}
