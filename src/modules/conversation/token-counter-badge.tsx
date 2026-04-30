/**
 * token-counter-badge.tsx
 *   - C-D17-17 (Day 5 15시 슬롯, 2026-04-30) — F-16 BYOK 비용 가시성 헤더 뱃지.
 *     · 헤더(HeaderCluster)에 박힘 — 데스크탑 인라인 + 모바일 오버레이 양쪽에 동일하게 표시.
 *     · 형태: `⚡ 12.4K tok / $0.04` (누적). 0건이면 마운트 X (시각 노이즈 0).
 *     · 클릭 동작 X — 표시만. 추후 분석 화면 도입 시 onClick 박을 것.
 *   - hydration: usage-store.hydrate() 1회 호출 후 subscribe.
 */

"use client";

import { useEffect } from "react";
import {
  formatCost,
  formatTokens,
  useUsageStore,
} from "@/modules/usage/usage-store";

export function TokenCounterBadge() {
  const totalInputs = useUsageStore((s) => s.totalInputs);
  const totalOutputs = useUsageStore((s) => s.totalOutputs);
  const totalCost = useUsageStore((s) => s.totalCost);
  const hydrated = useUsageStore((s) => s.hydrated);
  const hydrate = useUsageStore((s) => s.hydrate);

  useEffect(() => {
    if (!hydrated) void hydrate();
  }, [hydrated, hydrate]);

  const total = totalInputs + totalOutputs;
  if (!hydrated) return null;
  if (total <= 0) return null;

  return (
    <span
      className="whitespace-nowrap rounded border border-robusta-divider px-2 py-1 text-[11px] text-robusta-inkDim"
      data-test="token-counter-badge"
      title={`입력 ${formatTokens(totalInputs)} / 출력 ${formatTokens(totalOutputs)} / 누적 비용 ${formatCost(totalCost)}`}
    >
      <span aria-hidden>⚡ </span>
      {formatTokens(total)} tok · {formatCost(totalCost)}
    </span>
  );
}
