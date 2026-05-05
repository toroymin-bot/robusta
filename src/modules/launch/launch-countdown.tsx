"use client";

/**
 * launch-countdown.tsx
 *   - C-D44-1 (D-3 19시 슬롯, 2026-05-05) — Tori spec C-D44-1 (F-D44-1 + B-D44-2).
 *
 * Why: /launch 페이지 + Hero 보조 — 5/8 00:00 KST 라이브까지 시/분/초 카운트.
 *   D-Day 도달 시 onLive() 1회 호출 → 호출자(Hero)가 LIVE 상태로 자동 전환.
 *
 * 자율 정정:
 *   - D-44-자-1: 명세 RELEASE_ISO = '2026-05-08T10:00:00+09:00' 추정 — 실 SoT (dday-config.ts) 값은
 *                '2026-05-08T00:00:00+09:00' 자정. SoT 무수정 의무 (D-36-자-1 정합) — dday-config 직접 import.
 *   - D-44-자-2: 명세 import 경로 '@/modules/launch/release-iso' 미존재 — 실 SoT 모듈은 '@/modules/dday/dday-config'.
 *
 * 정책:
 *   - SSR hydration mismatch 회피 — 초기 render 빈 placeholder + suppressHydrationWarning + useEffect로 client 시각.
 *   - D-Day 도달 후 음수 → 0으로 clamp + isLive=true 영구 유지.
 *   - 탭 inactive(Page Visibility API) → visible 복귀 시 즉시 재계산.
 *   - prefers-reduced-motion 적용 시 pulse class 미주입 (motion-safe).
 *   - Date.now() 시계 역행 시 직전 값 유지 (NTP 보정 보호).
 *   - 외부 dev-deps +0.
 */

import type { JSX } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { RELEASE_ISO } from "@/modules/dday/dday-config";

export interface LaunchCountdownProps {
  /** 'compact' | 'full' — full은 시/분/초 모두, compact는 시간만. */
  variant?: "compact" | "full";
  /** D-Day 도달 시 1회 호출 (Hero D-N → LIVE 전환 trigger). */
  onLive?: () => void;
  /** 테스트/시뮬용 — 미주입 시 RELEASE_ISO. */
  releaseAt?: Date;
}

interface Remaining {
  hours: number;
  minutes: number;
  seconds: number;
  isLive: boolean;
}

const ZERO: Remaining = { hours: 0, minutes: 0, seconds: 0, isLive: false };

function compute(now: Date, release: Date, prev?: Remaining): Remaining {
  const diffMs = release.getTime() - now.getTime();
  // 시계 역행(NTP 보정) — 직전 값 유지.
  if (prev && diffMs < 0 && !prev.isLive) {
    // diff 가 갑자기 양 → 음으로 튀었다면 정상 D-Day 도달.
    // 직전이 양 + 본 결과가 큰 음수 (>1분 역행)면 직전 값 유지.
    const prevTotal =
      prev.hours * 3600 + prev.minutes * 60 + prev.seconds;
    const nowTotal = Math.max(0, Math.ceil(diffMs / 1000));
    // 60s 이상 역행 시 직전 유지.
    if (prevTotal > 0 && nowTotal === 0 && diffMs < -60_000) return prev;
  }
  if (diffMs <= 0) {
    return { hours: 0, minutes: 0, seconds: 0, isLive: true };
  }
  const totalSec = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  return { hours, minutes, seconds, isLive: false };
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function LaunchCountdown(
  props: LaunchCountdownProps = {},
): JSX.Element {
  const variant = props.variant ?? "full";
  // useMemo 안 — useEffect deps 안정화 (재렌더 시 동일 Date 인스턴스).
  const release = useMemo(
    () => props.releaseAt ?? new Date(RELEASE_ISO),
    [props.releaseAt],
  );

  // SSR 가드 — 초기 render 빈 placeholder, useEffect 후 실 시각.
  const [hydrated, setHydrated] = useState(false);
  const [rem, setRem] = useState<Remaining>(ZERO);
  const onLiveRef = useRef(props.onLive);
  const liveFiredRef = useRef(false);
  const prevRef = useRef<Remaining | undefined>(undefined);

  // onLive 콜백 동기화 (재렌더 시 stale closure 회피).
  useEffect(() => {
    onLiveRef.current = props.onLive;
  }, [props.onLive]);

  useEffect(() => {
    setHydrated(true);

    function tick() {
      const next = compute(new Date(), release, prevRef.current);
      prevRef.current = next;
      setRem(next);
      if (next.isLive && !liveFiredRef.current) {
        liveFiredRef.current = true;
        onLiveRef.current?.();
      }
    }

    tick();
    const id = window.setInterval(tick, 1000);

    function onVisibility() {
      if (document.visibilityState === "visible") tick();
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [release]);

  // SSR / hydrate 직후 — placeholder.
  if (!hydrated) {
    return (
      <span
        data-test="launch-countdown"
        data-state="loading"
        suppressHydrationWarning
        className="inline-flex items-center font-mono tabular-nums text-robusta-inkDim"
        aria-label="loading countdown"
      >
        --:--:--
      </span>
    );
  }

  if (rem.isLive) {
    return (
      <span
        data-test="launch-countdown"
        data-state="live"
        className="inline-flex items-center font-mono font-semibold text-emerald-600 motion-safe:animate-pulse"
        aria-label="now live"
      >
        LIVE
      </span>
    );
  }

  if (variant === "compact") {
    return (
      <span
        data-test="launch-countdown"
        data-state="counting"
        data-variant="compact"
        className="inline-flex items-center font-mono tabular-nums text-robusta-ink"
        aria-label={`${rem.hours} hours remaining`}
      >
        {rem.hours}시간
      </span>
    );
  }

  return (
    <span
      data-test="launch-countdown"
      data-state="counting"
      data-variant="full"
      className="inline-flex items-center font-mono tabular-nums text-robusta-ink"
      aria-label={`${rem.hours} hours ${rem.minutes} minutes ${rem.seconds} seconds remaining`}
    >
      {pad2(rem.hours)}:{pad2(rem.minutes)}:{pad2(rem.seconds)}
    </span>
  );
}

export default LaunchCountdown;
