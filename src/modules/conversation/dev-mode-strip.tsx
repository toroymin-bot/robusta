/**
 * dev-mode-strip.tsx
 *   - C-D26-1 (D6 11시 슬롯, 2026-05-02) — Tori spec C-D26-1 (D-61).
 *
 * dev-mode 카드 1줄 — 자동 마크 정밀도/재현율 노출.
 *   sample ≥ 100 → "🤖 auto: P {p}% / R {r}% / N {n}"
 *   sample < 100 → "🤖 auto: ({n}/100 sampling…)"
 *   activate: URL hash #dev 활성 시만. 일반 사용자 노출 0.
 *
 * 마운트: ConversationWorkspace dynamic import — 메인 번들 +0.
 *
 * OCP: 신규. auto-mark-precision + auto-mark-sample-store 의존.
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { measureAutoMarkPrecision } from "@/modules/insights/auto-mark-precision";
import { useAutoMarkSampleStore } from "@/stores/auto-mark-sample-store";
import { t } from "@/modules/i18n/messages";

const SAMPLE_THRESHOLD = 100;

export function DevModeStrip() {
  const samples = useAutoMarkSampleStore((s) => s.samples);
  const [active, setActive] = useState(false);

  useEffect(() => {
    function check() {
      setActive(
        typeof window !== "undefined" && window.location.hash === "#dev",
      );
    }
    check();
    window.addEventListener("hashchange", check);
    return () => window.removeEventListener("hashchange", check);
  }, []);

  const result = useMemo(() => measureAutoMarkPrecision(samples), [samples]);

  if (!active) return null;

  if (result.sample < SAMPLE_THRESHOLD) {
    return (
      <div
        data-test="dev-mode-strip"
        className="px-3 py-1 text-[11px] text-robusta-inkDim"
      >
        {t("devMode.autoMark.sampling", { sample: String(result.sample) })}
      </div>
    );
  }

  const precPct = Math.round(result.precision * 100);
  const recPct = Math.round(result.recall * 100);
  return (
    <div
      data-test="dev-mode-strip"
      className="px-3 py-1 text-[11px] text-robusta-inkDim"
    >
      {t("devMode.autoMark.precision", {
        precision: String(precPct),
        recall: String(recPct),
        sample: String(result.sample),
      })}
    </div>
  );
}
