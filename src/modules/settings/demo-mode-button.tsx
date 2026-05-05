"use client";

/**
 * settings/demo-mode-button.tsx
 *   - C-D46-1 (D-2 03시 슬롯, 2026-05-06) — Tori spec C-D46-1 (B-D46-1 / F-D46-1 / D-D46-1∼2).
 *
 * Why: Roy BYOK 시연 30분 (5/6 16:00 KST 정각, B-D46-1 시각 락) 진입점.
 *   1클릭 → applyDemoSeeds() 멱등 4 페르소나 즉시 주입 → toast 5초 안내 → 시연 마찰 0.
 *
 * 자율 정정:
 *   - D-46-자-4: settings 컴포넌트 위치 = 'src/modules/settings/' (분리). settings/page.tsx 인라인 대신 분리 — 재사용성 + 단일 책임.
 *
 * 정책:
 *   - applyDemoSeeds 멱등 (D-45-자-6 정합) — 2회 클릭 시 4종 유지, 중복 0.
 *   - showToast info 모드 + 5000ms (보존 13 toast.tsx 정합).
 *   - 우측 상단 fixed lozenge (sm:right-4 sm:top-4) / 모바일 좌측 상단 (left-4 top-4 / 11px).
 *   - lucide-react 미설치 (D-42-자-2 정합) → 🎭 emoji 인라인.
 *   - 보존 13 persona-types / persona-edit-modal / toast / messages 무수정 import만.
 *   - 외부 dev-deps +0.
 */

import { useState } from "react";
import { applyDemoSeeds } from "@/modules/personas/persona-demo-seeds";
import { useToastStore } from "@/modules/ui/toast";
import { t, type Locale } from "@/modules/i18n/messages";

interface DemoModeButtonProps {
  locale?: Locale;
}

export function DemoModeButton({ locale = "ko" }: DemoModeButtonProps) {
  const [busy, setBusy] = useState(false);
  const push = useToastStore((s) => s.push);

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    try {
      await applyDemoSeeds(); // 멱등 (D-45-자-6 정합) — 2회 호출 시 4종 유지.
      push({
        tone: "info",
        message: t("settings.demo.button.hint", undefined, locale),
        ttlMs: 5000, // 보존 13 toast.tsx 5초 자동 폐기 정합.
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      aria-label={t("settings.demo.button.label", undefined, locale)}
      data-test="settings-demo-mode-button"
      className="
        fixed z-30
        top-4 left-4 sm:left-auto sm:right-4
        rounded-full
        ring-2 ring-[var(--accent)]
        bg-[var(--surface-elevated)]
        px-3.5 py-2
        text-[11px] sm:text-xs
        text-robusta-ink
        hover:bg-robusta-divider
        transition-colors
        disabled:opacity-60
      "
    >
      {t("settings.demo.button.label", undefined, locale)}
    </button>
  );
}

export default DemoModeButton;
