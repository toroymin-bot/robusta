/**
 * token-counter-badge.tsx
 *   - C-D17-17 (Day 5 15시 슬롯, 2026-04-30) — F-16 BYOK 비용 가시성 헤더 뱃지.
 *     · 헤더(HeaderCluster)에 등록됨 — 데스크탑 인라인 + 모바일 오버레이 양쪽에 동일하게 표시.
 *     · 형태: `⚡ 12.4K tok · $0.04` (누적). ~~0건이면 마운트 X~~ → C-D17-19에서 placeholder로 대체.
 *   - C-D17-19 (Day 5 19시 슬롯, 2026-04-30) — F-17 placeholder + D-17 다크/라이트 색상 분기.
 *     · 누적 0건 시 "⚡ 키 등록 시 누적 표시" placeholder 정의 → 클릭 시 onRequestApiKeyModal 호출.
 *     · 다크 모드: bg-robusta-accent/25 text-robusta-paper, 라이트: bg-robusta-accent/15 text-robusta-ink.
 *     · prop onRequestApiKeyModal 미등록 시 placeholder 클릭 noop (defensive default).
 *   - C-D17-22 (Day 5 19시 슬롯, 2026-04-30) — D-19 tabular-nums 클래스 정의 (숫자 폭 균일).
 *   - hydration: usage-store.hydrate() 1회 호출 후 subscribe.
 */

"use client";

import { useEffect } from "react";
import {
  formatCost,
  formatTokens,
  useUsageStore,
} from "@/modules/usage/usage-store";
import { useThemeStore } from "@/modules/ui/theme";

interface TokenCounterBadgeProps {
  /** placeholder 클릭 시 호출. 누적 ≥ 1건이면 호출 X. 미등록 시 noop (defensive). */
  onRequestApiKeyModal?: () => void;
}

export function TokenCounterBadge({
  onRequestApiKeyModal,
}: TokenCounterBadgeProps = {}) {
  const totalInputs = useUsageStore((s) => s.totalInputs);
  const totalOutputs = useUsageStore((s) => s.totalOutputs);
  const totalCost = useUsageStore((s) => s.totalCost);
  const hydrated = useUsageStore((s) => s.hydrated);
  const hydrate = useUsageStore((s) => s.hydrate);

  // C-D17-19 D-17: 다크/라이트 분기 — themeMode 미hydrate 시 'light' fallback (FOUC 1프레임 회피).
  const themeMode = useThemeStore((s) => s.theme);
  const themeHydrated = useThemeStore((s) => s.hydrated);
  const isDark = themeHydrated && themeMode === "dark";

  useEffect(() => {
    if (!hydrated) void hydrate();
  }, [hydrated, hydrate]);

  if (!hydrated) return null;

  const total = totalInputs + totalOutputs;

  // C-D17-19 F-17: 0건 시 placeholder 정의 (이전엔 null 반환).
  //   클릭 시 onRequestApiKeyModal 호출 → ⚙ Keys 모달 자동 open.
  if (total <= 0) {
    const placeholderClass = isDark
      ? "bg-robusta-accent/25 text-robusta-ink border-robusta-accent/40"
      : "bg-robusta-accent/15 text-robusta-ink border-robusta-accent/30";
    return (
      <button
        type="button"
        onClick={() => onRequestApiKeyModal?.()}
        aria-label="BYOK 키 등록"
        data-test="token-counter-badge-placeholder"
        title="BYOK 키 등록 후 누적 토큰/비용이 여기에 표시됩니다"
        className={`whitespace-nowrap rounded border px-2 py-1 text-[11px] font-medium tabular-nums hover:opacity-80 ${placeholderClass}`}
      >
        <span aria-hidden>⚡ </span>
        키 등록 시 누적 표시
      </button>
    );
  }

  // 누적 ≥ 1건 — 기존 동작 + tabular-nums 클래스 추가 (C-D17-22 D-19).
  const filledClass = isDark
    ? "bg-robusta-accent/25 text-robusta-ink border-robusta-accent/40"
    : "bg-robusta-accent/15 text-robusta-ink border-robusta-accent/30";
  return (
    <span
      className={`whitespace-nowrap rounded border px-2 py-1 text-[11px] tabular-nums ${filledClass}`}
      data-test="token-counter-badge"
      title={`입력 ${formatTokens(totalInputs)} / 출력 ${formatTokens(totalOutputs)} / 누적 비용 ${formatCost(totalCost)}`}
    >
      <span aria-hidden>⚡ </span>
      {formatTokens(total)} tok · {formatCost(totalCost)}
    </span>
  );
}
