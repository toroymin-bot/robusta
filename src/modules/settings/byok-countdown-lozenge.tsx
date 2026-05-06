"use client";

/**
 * settings/byok-countdown-lozenge.tsx
 *   - C-D47-3 (D-2 07시 슬롯, 2026-05-06) — Tori spec C-D47-3 (D-D47-3).
 *
 * Why: Roy BYOK 시연 16:00 KST T-5 ∼ T+30 카운트다운 lozenge.
 *   T-5 ∼ T-0: "🎬 시연 5분 전" (motion-safe pulse).
 *   T+0 ∼ T+30: "🎬 시연 진행 중".
 *   그 외: 숨김 (T-5 이전 / T+30 이후 모두 hidden).
 *
 * 정책:
 *   - BYOK_DEMO_ISO SoT 직접 import (@/modules/dday/dday-config) — D-47-자-1 SoT 모듈 분리 정합.
 *   - 30초 tick — 잡스 정밀도 충분 (T-5 표시 정확도 ±30초).
 *   - clearInterval cleanup — unmount 시 누수 0.
 *   - motion-safe:animate-pulse — prefers-reduced-motion 자동 respect.
 *   - 모바일 좌측 상단 분기 (left-4 sm:left-auto sm:right-4) + 11px 폰트.
 *   - aria-live="polite" + role="status" — 보조 기술 사용자에게도 안내.
 *   - 외부 dev-deps +0.
 *
 * D-46-자-4 분리 패턴 락 정합.
 */

import { useEffect, useRef, useState } from "react";
import { BYOK_DEMO_ISO } from "@/modules/dday/dday-config";
import { t, type Locale } from "@/modules/i18n/messages";
import { logFunnelEvent } from "@/modules/launch/funnel-events";

type Phase = "hidden" | "t5" | "now" | "done";

const T5_WINDOW_MS = 5 * 60_000;
const T30_WINDOW_MS = 30 * 60_000;
const TICK_MS = 30_000;

function computePhase(now: number, target: number): Phase {
  const diff = target - now;
  if (diff > T5_WINDOW_MS) return "hidden";
  if (diff > 0) return "t5";
  if (diff > -T30_WINDOW_MS) return "now";
  return "done";
}

interface ByokCountdownLozengeProps {
  locale?: Locale;
}

export function ByokCountdownLozenge({
  locale = "ko",
}: ByokCountdownLozengeProps) {
  const [phase, setPhase] = useState<Phase>("hidden");
  // C-D48-3 (B-D48-4) — 'now' phase 1회 guard. T+0 진입 시 'byok_demo_completed'
  //   1회만 기록 (30초 tick 마다 중복 발생 방지). useRef로 mount 동안 1회만.
  const completedFiredRef = useRef(false);

  useEffect(() => {
    const target = new Date(BYOK_DEMO_ISO).getTime();
    function tick() {
      const next = computePhase(Date.now(), target);
      setPhase(next);
      if (next === "now" && !completedFiredRef.current) {
        completedFiredRef.current = true;
        // C-D48-3 (B-D48-4) — BYOK 시연 정각 진입 (T+0) = 시연 시작 1건.
        //   D+1 보고서 'completed' 카운트의 분자.
        void logFunnelEvent("byok_demo_completed");
      }
    }
    tick();
    const id = setInterval(tick, TICK_MS);
    return () => clearInterval(id);
  }, []);

  if (phase === "hidden" || phase === "done") return null;

  const labelKey =
    phase === "t5"
      ? "settings.byok.countdown.t5"
      : "settings.byok.countdown.now";

  return (
    <div
      data-test="settings-byok-countdown-lozenge"
      role="status"
      aria-live="polite"
      className="
        fixed top-16 right-4 sm:top-16 sm:right-4 left-4 sm:left-auto z-20
        rounded-full
        ring-2 ring-[var(--accent)]
        bg-robusta-canvas
        px-3 py-1.5
        text-[11px] sm:text-xs
        text-[var(--accent)]
        motion-safe:animate-pulse
      "
    >
      {t(labelKey, undefined, locale)}
    </div>
  );
}

export default ByokCountdownLozenge;
