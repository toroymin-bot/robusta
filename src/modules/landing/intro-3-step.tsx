"use client";

/**
 * intro-3-step.tsx
 *   - C-D38-3 (D-4 19시 슬롯, 2026-05-04) — Tori spec C-D38-3 (V-D38-1 (b) / D-D38 사용자 가시 가치).
 *
 * Why: 첫 진입자 4-funnel(visit→BYOK→persona→message) 시각화 — 인라인 hero strip 3 dots.
 *   모달 마찰 0 / 페이지 이동 0 / 메시지 1+ 후 자동 unmount(null 반환).
 *
 * 정책 (자율 정정 D-38-자-1 정합):
 *   - welcome-view.tsx 헤더 안 인라인 마운트 — 첫 진입자만 노출 (visitedAt 0 분기).
 *   - 단계 결정: db.messages.count > 0 → null / personas.count > 0 → step 3 / apiKeys.count > 0 → step 2 / else → step 1.
 *   - 외부 dep 0 (Dexie 기존 / Tailwind 기존). 예상 번들 영향 ≈ +1.2 kB (168 103 kB 무영향).
 *   - dangerouslySetInnerHTML 미사용. dynamic import 로 SSR 안전.
 *   - Safari private mode (IndexedDB 차단) → catch → step 1 fallback (안전한 default).
 *
 * 단계 라벨 (정확 일치 — verify-d38 grep 의무):
 *   1: "Bring your Claude key"
 *   2: "Pick a persona"
 *   3: "Send a message"
 *
 * 디자인:
 *   - 컨테이너 inline-flex items-center gap-3.
 *   - dot w-2 h-2 rounded-full + transition-colors duration-400.
 *     active → bg-emerald-500 / done → bg-stone-400 / pending → bg-stone-200 dark:bg-stone-700.
 *   - 라벨 text-xs text-stone-500.
 *
 * 보존 13 영향: 0 (신규 모듈, welcome-view 1줄 import + 1줄 마운트).
 */

import { useEffect, useState, type JSX } from "react";

const STEP_LABELS = [
  "Bring your Claude key", // 1
  "Pick a persona", // 2
  "Send a message", // 3
] as const;

type ActiveStep = 1 | 2 | 3 | null;

export function Intro3Step(): JSX.Element | null {
  // 첫 렌더 (SSR/hydrate 직전) → step 1 fallback (Safari private 도 동일 분기).
  const [activeStep, setActiveStep] = useState<ActiveStep>(1);

  useEffect(() => {
    let cancelled = false;

    async function detect(): Promise<void> {
      try {
        // SSR 회피: 'use client' 가드 + 동적 import (Dexie window 의존).
        const { getDb } = await import("@/modules/storage/db");
        const db = getDb();

        // (1) 메시지 1+ → 자동 unmount (null).
        const msgCount = await db.messages.count();
        if (cancelled) return;
        if (msgCount > 0) {
          setActiveStep(null);
          return;
        }

        // (2) 페르소나 1+ → step 3 ("Send a message").
        const personaCount = await db.personas.count();
        if (cancelled) return;
        if (personaCount > 0) {
          setActiveStep(3);
          return;
        }

        // (3) BYOK 키 1+ → step 2 ("Pick a persona").
        const keyCount = await db.apiKeys.count();
        if (cancelled) return;
        if (keyCount > 0) {
          setActiveStep(2);
          return;
        }

        // (4) 그 외 → step 1 ("Bring your Claude key").
        setActiveStep(1);
      } catch {
        // IndexedDB 차단 (Safari private) — step 1 fallback.
        if (!cancelled) setActiveStep(1);
      }
    }

    void detect();

    return () => {
      cancelled = true;
    };
  }, []);

  // 메시지 1+ → null 반환 (자동 dismiss).
  if (activeStep === null) return null;

  return (
    <div
      data-test="intro-3-step"
      data-active-step={activeStep}
      className="inline-flex items-center gap-3"
      role="status"
      aria-label={`Onboarding step ${activeStep} of 3`}
    >
      {([1, 2, 3] as const).map((n) => {
        const state =
          n < activeStep ? "done" : n === activeStep ? "active" : "pending";
        const dotClass =
          state === "active"
            ? "bg-emerald-500"
            : state === "done"
              ? "bg-stone-400"
              : "bg-stone-200 dark:bg-stone-700";
        return (
          <span key={n} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              data-step={n}
              data-state={state}
              className={`w-2 h-2 rounded-full transition-colors duration-400 ${dotClass}`}
            />
            <span className="text-xs text-stone-500">
              {STEP_LABELS[n - 1]}
            </span>
          </span>
        );
      })}
    </div>
  );
}

export default Intro3Step;
