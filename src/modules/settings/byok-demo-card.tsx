"use client";

/**
 * settings/byok-demo-card.tsx
 *   - C-D48-2 (D-2 11시 슬롯, 2026-05-06) — Tori spec C-D48-2 (B-D48-2 / F-D48-2 / D-D48-1∼5).
 *
 * Why: Roy BYOK 시연 16:00 KST 진행 중 settings 페이지 우측 상단 6단계 시나리오 카드.
 *   BYOK_DEMO_ISO ±2h (14:00∼18:00 KST) 표시 윈도우 — 시연 직전부터 30분 회고까지 + D-Day 직전 산만 0.
 *   step별 ✓ 체크 토글 (localStorage 영속) — 시연 진행도 가시화.
 *
 * 정책:
 *   - BYOK_DEMO_ISO SoT 직접 import (@/modules/dday/dday-config) — D-47-자-1 SoT 모듈 분리 정합.
 *   - 1분 tick — 표시 윈도우 ±2h 정밀도 충분 (시연 시작 ±1분).
 *   - clearInterval cleanup — unmount 시 누수 0.
 *   - localStorage 'byok.demo.card.steps' 영속 — try/catch silent skip (QuotaExceeded/SSR).
 *   - SSR 가드 — 'use client' + useEffect 마운트 후 표시 (hydration mismatch 회피).
 *   - 모바일 좌측 정렬 분기 (left-4 sm:left-auto sm:right-4) + 11px 폰트.
 *   - role="region" + aria-label + aria-pressed — 보조 기술 정합.
 *   - motion-reduce:transition-none — prefers-reduced-motion respect.
 *   - 보존 13 무수정 (i18n append-only 외 0).
 *   - 외부 dev-deps +0.
 *
 * D-46-자-4 분리 패턴 락 정합 (settings/* 단일 책임 모듈).
 */

import { useEffect, useState } from "react";
import { BYOK_DEMO_ISO } from "@/modules/dday/dday-config";
import { t, type Locale } from "@/modules/i18n/messages";
import { logFunnelEvent } from "@/modules/launch/funnel-events";

const STORAGE_KEY = "byok.demo.card.steps";
const TOTAL_STEPS = 6;
const WINDOW_MS_BEFORE = 2 * 60 * 60_000; // 2h before
const WINDOW_MS_AFTER = 2 * 60 * 60_000; // 2h after
const TICK_MS = 60_000; // 1 min

function readSteps(): boolean[] {
  if (typeof window === "undefined") return Array(TOTAL_STEPS).fill(false);
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (!v) return Array(TOTAL_STEPS).fill(false);
    const parsed = JSON.parse(v) as unknown;
    if (Array.isArray(parsed) && parsed.length === TOTAL_STEPS) {
      return parsed.map((b) => Boolean(b));
    }
  } catch {
    /* JSON 깨짐 / 시크릿 모드 silent skip */
  }
  return Array(TOTAL_STEPS).fill(false);
}

function writeSteps(steps: boolean[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(steps));
  } catch {
    /* QuotaExceeded silent skip — 시연 마찰 0 의무 */
  }
}

interface ByokDemoCardProps {
  locale?: Locale;
}

export function ByokDemoCard({ locale = "ko" }: ByokDemoCardProps) {
  const [visible, setVisible] = useState(false);
  const [steps, setSteps] = useState<boolean[]>(() =>
    Array(TOTAL_STEPS).fill(false),
  );

  useEffect(() => {
    setSteps(readSteps()); // hydration 정합 — 마운트 후 영속 상태 픽업.
    const target = new Date(BYOK_DEMO_ISO).getTime();
    function tick() {
      const now = Date.now();
      const diff = now - target;
      setVisible(diff > -WINDOW_MS_BEFORE && diff < WINDOW_MS_AFTER);
    }
    tick();
    const id = setInterval(tick, TICK_MS);
    return () => clearInterval(id);
  }, []);

  if (!visible) return null;

  function toggle(i: number) {
    setSteps((prev) => {
      const next = [...prev];
      next[i] = !next[i];
      writeSteps(next);
      return next;
    });
  }

  // 자율 D-49-자-1 — 리셋: 6단계 모두 false 로 초기화 + funnel 1건 기록.
  //   Why: 시연 ±2h 윈도우 동안 이전 시연 ✓ 잔존 → 산만 (재시연 마찰 0 의무).
  function reset() {
    const fresh = Array(TOTAL_STEPS).fill(false) as boolean[];
    writeSteps(fresh);
    setSteps(fresh);
    void logFunnelEvent("byok_demo_card_reset");
  }

  const completed = steps.filter(Boolean).length;
  const progressPercent = Math.round((completed / TOTAL_STEPS) * 100);
  const stepKeys = [
    "settings.byok.demo.card.step.1",
    "settings.byok.demo.card.step.2",
    "settings.byok.demo.card.step.3",
    "settings.byok.demo.card.step.4",
    "settings.byok.demo.card.step.5",
    "settings.byok.demo.card.step.6",
  ] as const;

  return (
    <div
      data-test="settings-byok-demo-card"
      role="region"
      aria-label={t("settings.byok.demo.card.label", undefined, locale)}
      className="
        fixed top-32 right-4 sm:top-32 sm:right-4 left-4 sm:left-auto z-20
        max-w-[calc(100vw-32px)] sm:max-w-[320px]
        bg-[var(--surface-elevated)] ring-1 ring-[var(--border)]
        rounded-2xl px-4 py-3.5
        motion-reduce:transition-none transition-opacity duration-300
      "
    >
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="text-[11px] sm:text-xs text-robusta-inkDim">
          {t("settings.byok.demo.card.label", undefined, locale)} ({completed}/
          {TOTAL_STEPS})
        </div>
        <button
          type="button"
          onClick={reset}
          aria-label={t("settings.byok.demo.card.reset.label", undefined, locale)}
          className="
            text-[10px] sm:text-[11px] underline text-robusta-inkDim
            hover:text-robusta-ink
            focus:outline-none focus:ring-2 focus:ring-[var(--accent)]
            rounded px-1
            transition-colors motion-reduce:transition-none
          "
        >
          {t("settings.byok.demo.card.reset.label", undefined, locale)}
        </button>
      </div>
      {/* 자율 D-49-자-1 — 시각적 progress bar. role=progressbar + aria-value{now,min,max,text}. */}
      <div
        role="progressbar"
        aria-valuenow={completed}
        aria-valuemin={0}
        aria-valuemax={TOTAL_STEPS}
        aria-valuetext={`${completed}/${TOTAL_STEPS}`}
        aria-label={t("settings.byok.demo.card.progress.label", undefined, locale)}
        className="h-1 w-full bg-[var(--border)] rounded-full overflow-hidden mb-2.5"
      >
        <div
          className="h-full bg-[var(--accent)] transition-all duration-300 motion-reduce:transition-none"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <ol className="flex flex-col gap-1.5">
        {stepKeys.map((key, i) => (
          <li key={key}>
            <button
              type="button"
              onClick={() => toggle(i)}
              aria-pressed={steps[i]}
              tabIndex={0}
              className={`
                text-left text-[11px] sm:text-xs w-full
                rounded px-1 py-0.5
                hover:text-robusta-ink
                focus:outline-none focus:ring-2 focus:ring-[var(--accent)]
                transition-colors motion-reduce:transition-none
                ${steps[i] ? "text-[var(--accent)]" : "text-robusta-inkDim"}
              `}
            >
              {steps[i] ? "✓ " : ""}
              {t(key, undefined, locale)}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default ByokDemoCard;
