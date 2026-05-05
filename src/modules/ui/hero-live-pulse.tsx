"use client";

/**
 * hero-live-pulse.tsx
 *   - C-D42-4 (D-3 11시 슬롯, 2026-05-05) — Tori spec C-D42-4 (V-D42-1 Hero LIVE 펄스 + D-N→LIVE 자동 전환).
 *
 * Why: Hero h1 옆 D-N / LIVE 라벨 — 5/8 00:00 KST 정각 자동 전환 + 펄스 시각 임팩트.
 *   사용자 첫 진입에서 D-Day 카운트다운 + 라이브 상태 즉시 인지 (잡스 "기대를 만들어라" 정합).
 *
 * 정책 (자율 정정 D-42-자-4):
 *   - 명세 src/lib/dday.ts 추정 경로 미존재 → 실 SoT = src/modules/dday/dday-config.ts (D-D34 기존).
 *     본 모듈은 dday-config.ts 의 RELEASE_ISO + isLive() 직접 import (인라인 복제 X / SoT 단일).
 *   - releaseAt prop 옵셔널 (테스트용) — 미주입 시 dday-config RELEASE_ISO.
 *
 * 분기:
 *   - now < release  → <span data-state="dn" className="bg-stone-500"> "D-N" </span>
 *   - now >= release → <span data-state="live" className="bg-emerald-600 animate-pulse"> "LIVE" </span>
 *
 * 엣지:
 *   - prefers-reduced-motion: reduce → animate-pulse 미적용 (CSS 자동 처리 — Tailwind motion-safe 불필요,
 *     본 모듈은 명시적 motion-safe:animate-pulse 토큰 사용해 reduce 시 정적 표시).
 *   - SSR 안전: hydrated false 시 D-N 기본 (now=Date 순간 값) — Hydration mismatch 회피용 placeholder 미사용
 *     (서버/클라 RELEASE_ISO 동일 + new Date() 약간의 시차 < 1초 = D-N 결과 동일).
 *   - UTC 비교 의무: dday-config RELEASE_ISO = "2026-05-08T00:00:00+09:00" — Date.getTime() UTC 기반 비교.
 *
 * 보존 13 영향: 0 (신규 모듈, hero-title-slot.tsx 마운트 1줄).
 */

import type { JSX } from "react";
import { isLive, daysUntilRelease, RELEASE_ISO } from "@/modules/dday/dday-config";

export interface HeroLivePulseProps {
  /** 테스트/시뮬용 — 미주입 시 new Date(). */
  now?: Date;
  /** 테스트/시뮬용 — 미주입 시 dday-config RELEASE_ISO. */
  releaseAt?: Date;
}

export function HeroLivePulse(props: HeroLivePulseProps = {}): JSX.Element {
  const now = props.now ?? new Date();
  // releaseAt 주입 시 자체 비교, 미주입 시 dday-config SoT 함수 사용.
  const release = props.releaseAt ?? new Date(RELEASE_ISO);
  const live = props.releaseAt ? now.getTime() >= release.getTime() : isLive(now);
  const n = props.releaseAt
    ? Math.ceil((release.getTime() - now.getTime()) / 86_400_000)
    : daysUntilRelease(now);

  if (live) {
    return (
      <span
        data-test="hero-live-pulse"
        data-state="live"
        // V-D42-1: bg-emerald-600 + motion-safe:animate-pulse — prefers-reduced-motion: reduce 분기 자동.
        //   transition-colors duration-600 — D-N → LIVE 페이드 (브라우저 hot reload / 첫 hydrate 동안).
        className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold text-white bg-emerald-600 motion-safe:animate-pulse transition-colors duration-600"
        aria-label="Now Live"
      >
        LIVE
      </span>
    );
  }

  return (
    <span
      data-test="hero-live-pulse"
      data-state="dn"
      className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold text-white bg-stone-500 transition-colors duration-600"
      aria-label={`D minus ${n}`}
    >
      D-{n}
    </span>
  );
}

export default HeroLivePulse;
