"use client";

/**
 * hero-live-transition.tsx
 *   - C-D44-4 (D-3 19시 슬롯, 2026-05-05) — Tori spec C-D44-4 (F-D44-4 + D-D44-1).
 *
 * Why: Hero D-N → LIVE 자동 전환 마이크로 인터랙션 — 5/8 자정 KST 정각 도달 시
 *   3초 페이드 + scale 1.0→1.4 ease-out pulse, prefers-reduced-motion 즉시 전환.
 *
 * 자율 정정:
 *   - D-44-자-3: 명세 src/modules/launch/hero-live-transition.tsx — 실 hero-* 모듈 위치는
 *                src/modules/ui/ (hero-live-pulse.tsx + hero-title-slot.tsx 정합).
 *
 * 정책:
 *   - 전환 1회 한정 — useRef guard 재실행 방지.
 *   - GPU transform 사용 (transform: scale).
 *   - prefers-reduced-motion: reduce → 애니메이션 0, 즉시 전환.
 *   - 5/8 자정 KST ±1초 허용 — RELEASE_ISO SoT 직접 import (D-42-자-4 정합).
 *
 * 외부 dev-deps +0.
 */

import type { JSX } from "react";
import { useEffect, useRef, useState } from "react";
import { t } from "@/modules/i18n/messages";

/** C-D45-4 (D-3 23시 슬롯, 2026-05-05) — LIVE 첫 1시간 강조 임계 (D-D45-1).
 *  liveSinceMs < STRONG_RING_MS → 4px ring (강조) + pulse 1.05.
 *  liveSinceMs ≥ STRONG_RING_MS → 2px ring (일반) + pulse 비활성. */
const STRONG_RING_MS = 60 * 60 * 1000;

export interface HeroLiveTransitionProps {
  /** D-N 모드 → LIVE 모드 전환 — RELEASE_ISO 도달 시 LaunchCountdown.onLive 콜백으로 true. */
  isLive: boolean;
  children: React.ReactNode;
  /**
   * C-D45-4 (D-D45-1) — RELEASE_ISO 도달 후 경과 시간(ms).
   *   < 3,600,000ms → 4px ring + pulse 1.05 (강조 모드, 첫 1시간).
   *   ≥ 3,600,000ms → 2px ring + pulse 비활성 (일반 LIVE 모드).
   *   undefined → 기본 동작 (D-N→LIVE 전환만, ring 0).
   */
  liveSinceMs?: number;
}

export function HeroLiveTransition(
  props: HeroLiveTransitionProps,
): JSX.Element {
  const transitionedRef = useRef(false);
  const [animating, setAnimating] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  // prefers-reduced-motion 동기화.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // isLive 첫 true → 1회 애니메이션 트리거.
  useEffect(() => {
    if (!props.isLive) return;
    if (transitionedRef.current) return;
    transitionedRef.current = true;
    if (reducedMotion) return; // 즉시 전환 — 애니메이션 0.
    setAnimating(true);
    const tid = window.setTimeout(() => setAnimating(false), 3000);
    return () => window.clearTimeout(tid);
  }, [props.isLive, reducedMotion]);

  // C-D45-4 — strong ring 분기 (4px vs 2px).
  const liveSinceMs = props.liveSinceMs;
  const isStrongRing =
    props.isLive && liveSinceMs !== undefined && liveSinceMs < STRONG_RING_MS;
  const isWeakRing =
    props.isLive && liveSinceMs !== undefined && liveSinceMs >= STRONG_RING_MS;

  // ring class 합성 — 4px (ring-4) 강조 / 2px (ring-2) 일반 / 미지정 시 ring 0.
  // pulse는 prefers-reduced-motion 존중 (motion-safe:animate-pulse).
  const ringClass = isStrongRing
    ? "ring-4 ring-red-500 motion-safe:animate-pulse"
    : isWeakRing
      ? "ring-2 ring-red-400"
      : "";

  return (
    <span
      data-test="hero-live-transition"
      data-state={props.isLive ? "live" : "dn"}
      data-animating={animating ? "true" : "false"}
      data-reduced-motion={reducedMotion ? "true" : "false"}
      data-ring={isStrongRing ? "strong" : isWeakRing ? "weak" : "none"}
      aria-label={t("hero.live.transition.aria")}
      className={
        animating
          ? `inline-flex items-center rounded motion-safe:animate-pulse ${ringClass}`.trim()
          : `inline-flex items-center rounded ${ringClass}`.trim()
      }
      style={
        animating
          ? {
              transform: "scale(1.4)",
              transition: "transform 3000ms ease-out, opacity 3000ms ease-out",
              willChange: "transform",
            }
          : isStrongRing && !reducedMotion
            ? {
                // C-D45-1 — 강조 모드 60Hz pulse 1.0→1.05 (animate-pulse 보강).
                transform: "scale(1.0)",
                transition: "transform 600ms ease-out",
              }
            : { transform: "scale(1.0)", transition: "transform 3000ms ease-out" }
      }
    >
      {props.children}
    </span>
  );
}

export default HeroLiveTransition;
