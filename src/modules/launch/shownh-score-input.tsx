"use client";

/**
 * shownh-score-input.tsx
 *   - C-D47-2 (D-2 07시 슬롯, 2026-05-06) — Tori spec C-D47-2 (B-D47-2 / F-D47-2 / D-D47-2 보조).
 *
 * Why: D+1 (5/9 09:00 KST) 보고서 Show HN 점수 입력 UI — 선제 v2 구현.
 *   localStorage `launch.shownh.score` 영속 → 새로고침 후 점수 유지 (Roy 부담 0).
 *   d1-report.ts generateD1ReportMd가 자동 픽업 (TBD → 실 점수 자동 전환).
 *
 * 정책:
 *   - 'use client' — useState/useEffect/localStorage 의존.
 *   - 빈 string → d1-report에서 'TBD' fallback (C-D46-4 시그니처 정합).
 *   - maxLength 32 — 특수 문자 ('+13 -2') 또는 숫자 ('87') 유연 입력.
 *   - localStorage QuotaExceeded / SSR / 시크릿 모드 — try/catch silent skip.
 *   - 보존 13 i18n/messages.ts append-only 정합 (C-D47-2 신규 키 2종).
 */

import { useEffect, useState } from "react";
import { t, type Locale } from "@/modules/i18n/messages";

/** localStorage 영속 키 — 본 §3 정책 락 (B-D47-2). */
export const SHOWNH_SCORE_STORAGE_KEY = "launch.shownh.score";

interface ShownhScoreInputProps {
  locale?: Locale;
}

export function ShownhScoreInput({ locale = "ko" }: ShownhScoreInputProps) {
  const [value, setValue] = useState<string>("");

  useEffect(() => {
    // 마운트 후 localStorage 자동 복원 — hydration mismatch 회피 (SSR=빈, CSR=복원).
    try {
      const stored = window.localStorage.getItem(SHOWNH_SCORE_STORAGE_KEY);
      if (stored !== null) setValue(stored);
    } catch {
      /* localStorage 미지원 / 시크릿 모드 — silent skip. */
    }
  }, []);

  function handleChange(next: string) {
    setValue(next);
    try {
      window.localStorage.setItem(SHOWNH_SCORE_STORAGE_KEY, next);
    } catch {
      /* QuotaExceeded — silent skip (32자 maxLength로 사실상 발생 0). */
    }
  }

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm text-robusta-ink">
        {t("settings.report.d1.score.label", undefined, locale)}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={t(
          "settings.report.d1.score.placeholder",
          undefined,
          locale,
        )}
        aria-label={t("settings.report.d1.score.label", undefined, locale)}
        data-test="settings-shownh-score-input"
        maxLength={32}
        className="
          rounded-md
          border border-robusta-divider
          bg-robusta-canvas
          px-3 py-2
          text-sm
          text-robusta-ink
          placeholder:text-robusta-inkDim
          focus:outline-none
          focus:ring-2
          focus:ring-[var(--accent)]
        "
      />
    </label>
  );
}

export default ShownhScoreInput;
