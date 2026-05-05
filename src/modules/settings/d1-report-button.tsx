"use client";

/**
 * settings/d1-report-button.tsx
 *   - C-D46-4 (D-2 03시 슬롯, 2026-05-06) — Tori spec C-D46-4 (B-D46-3 / F-D46-4 / D-D46-5).
 *
 * Why: D+1 (5/9 09:00 KST) 회고 자동 .md 다운로드 진입점. Roy 1클릭 → 차트 0, 표 3종, 1 페이지.
 *
 * 정책:
 *   - downloadD1Report — funnelEvents Dexie v10 read-only (db.put/add/delete grep 0).
 *   - locale 분기 — 헤더만 i18n, 데이터는 동일.
 *   - 외부 dev-deps +0.
 */

import { useState } from "react";
import { downloadD1Report } from "@/modules/launch/d1-report";
import { t, type Locale } from "@/modules/i18n/messages";

interface D1ReportButtonProps {
  locale?: Locale;
}

export function D1ReportButton({ locale = "ko" }: D1ReportButtonProps) {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    try {
      await downloadD1Report(locale);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      aria-label={t("settings.report.d1.button.label", undefined, locale)}
      data-test="settings-d1-report-button"
      className="
        rounded-md
        ring-1 ring-robusta-divider
        bg-robusta-canvas
        px-3.5 py-2
        text-[12px] sm:text-sm
        text-robusta-ink
        hover:bg-robusta-divider
        transition-colors
        disabled:opacity-60
      "
    >
      {t("settings.report.d1.button.label", undefined, locale)}
      <span className="ml-2 text-[11px] text-robusta-inkDim">
        {t("settings.report.d1.button.hint", undefined, locale)}
      </span>
    </button>
  );
}

export default D1ReportButton;
