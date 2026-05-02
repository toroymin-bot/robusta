/**
 * cost-cap-badge.tsx
 *   - C-D30-1 (D-5 07시 슬롯, 2026-05-03) — Tori spec C-D30-1 (D-D30-1 헤더 배지).
 *
 * Why: 사이드바 셸 헤더 우측 16×16px donut 배지. hover 시 tooltip.
 *   - pct < 80%  → blue-600 (info)
 *   - 80~95%     → amber-600 (warning)
 *   - > 95%      → red-600 (error)
 *   - tooltip: "$0.65/$1.00 (자정 09:00 KST 리셋)" 형식 (i18n cost.cap.tooltip)
 *
 * 168 HARD GATE: 호출자가 dynamic import 권장.
 *
 * OCP: schedule-runner / costAccum 무수정.
 */

"use client";

import type { JSX } from "react";
import { useCostCap, pctToTone } from "./cost-cap-store";
import { t } from "@/modules/i18n/messages";

const BADGE_SIZE = 16;
const BADGE_STROKE = 2.5;

export function CostCapBadge(): JSX.Element {
  const { dailyUsd, capUsd, pct, resetAtKst, hydrated } = useCostCap();
  const tone = pctToTone(pct);
  const color = badgeColor(tone);
  const radius = (BADGE_SIZE - BADGE_STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct / 100);

  const tooltipText = hydrated
    ? `${formatUsd(dailyUsd)}/${formatUsd(capUsd)} (${t("cost.cap.reset", { time: resetAtKst })})`
    : t("cost.cap.title");

  return (
    <span
      role="img"
      aria-label={tooltipText}
      title={tooltipText}
      data-tone={tone}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: BADGE_SIZE,
        height: BADGE_SIZE,
      }}
    >
      <svg
        width={BADGE_SIZE}
        height={BADGE_SIZE}
        viewBox={`0 0 ${BADGE_SIZE} ${BADGE_SIZE}`}
        aria-hidden="true"
      >
        <circle
          cx={BADGE_SIZE / 2}
          cy={BADGE_SIZE / 2}
          r={radius}
          fill="none"
          stroke="var(--color-border, #e5e7eb)"
          strokeWidth={BADGE_STROKE}
        />
        <circle
          cx={BADGE_SIZE / 2}
          cy={BADGE_SIZE / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={BADGE_STROKE}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${BADGE_SIZE / 2} ${BADGE_SIZE / 2})`}
        />
      </svg>
    </span>
  );
}

function badgeColor(tone: "info" | "warning" | "error"): string {
  if (tone === "error") return "#dc2626";
  if (tone === "warning") return "#d97706";
  return "#2563eb";
}

function formatUsd(usd: number): string {
  if (!Number.isFinite(usd)) return "$0.00";
  return `$${usd.toFixed(2)}`;
}

export const __cost_cap_badge_internal = { BADGE_SIZE, BADGE_STROKE, badgeColor, formatUsd };
