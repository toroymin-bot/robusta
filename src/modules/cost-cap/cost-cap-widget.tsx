/**
 * cost-cap-widget.tsx
 *   - C-D30-1 (D-5 07시 슬롯, 2026-05-03) — Tori spec C-D30-1.
 *
 * Why: Settings / Schedules 페이지 상단 BYOK 비용 cap 위젯.
 *   - 라벨: "BYOK 일일 비용 한도" (i18n cost.cap.title)
 *   - 부제: BYOK 안심 메시징 (B-D30-2) — i18n cost.cap.subtitle
 *   - 현재/한도 텍스트 + donut 0~100% + 자정 KST 리셋 시각 표시
 *
 * 168 HARD GATE: 호출자가 dynamic import 로 lazy chunk 분리. 본 컴포넌트 자체는 정적 export.
 *
 * OCP: schedule-runner / costAccum / i18n 무수정. 단순 read-only.
 */

"use client";

import type { JSX } from "react";
import { useCostCap, pctToTone } from "./cost-cap-store";
import { t } from "@/modules/i18n/messages";

export function CostCapWidget(): JSX.Element {
  const { dailyUsd, capUsd, pct, resetAtKst, hydrated } = useCostCap();
  const tone = pctToTone(pct);

  return (
    <section
      aria-label={t("cost.cap.title")}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: 16,
        borderRadius: 12,
        border: "1px solid var(--color-border, #e5e7eb)",
        background: "var(--color-surface, #ffffff)",
      }}
    >
      <header style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <h3
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 600,
            color: "var(--color-text-primary, #111827)",
          }}
        >
          {t("cost.cap.title")}
        </h3>
        <p
          style={{
            margin: 0,
            fontSize: 12,
            color: "var(--color-text-secondary, #6b7280)",
          }}
        >
          {t("cost.cap.subtitle")}
        </p>
      </header>

      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <Donut pct={pct} tone={tone} size={48} />
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: "var(--color-text-primary, #111827)",
            }}
          >
            {hydrated
              ? t("cost.cap.current", {
                  current: formatUsd(dailyUsd),
                  cap: formatUsd(capUsd),
                })
              : "—"}
          </span>
          <span
            style={{
              fontSize: 12,
              color: "var(--color-text-secondary, #6b7280)",
            }}
          >
            {t("cost.cap.reset", { time: resetAtKst })}
          </span>
        </div>
      </div>

      {tone !== "info" && (
        <p
          role="status"
          style={{
            margin: 0,
            fontSize: 12,
            color: toneColor(tone),
          }}
        >
          {t("cost.cap.warn", { pct: String(pct) })}
        </p>
      )}
    </section>
  );
}

interface DonutProps {
  pct: number;
  tone: "info" | "warning" | "error";
  size: number;
}

function Donut({ pct, tone, size }: DonutProps): JSX.Element {
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct / 100);
  const color = toneColor(tone);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={t("cost.cap.tooltip", { pct: String(pct) })}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--color-border, #e5e7eb)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        fontSize={Math.round(size / 4)}
        fontWeight={600}
        fill="var(--color-text-primary, #111827)"
      >
        {`${pct}%`}
      </text>
    </svg>
  );
}

function toneColor(tone: "info" | "warning" | "error"): string {
  if (tone === "error") return "#dc2626"; // red-600
  if (tone === "warning") return "#d97706"; // amber-600
  return "#2563eb"; // blue-600
}

function formatUsd(usd: number): string {
  if (!Number.isFinite(usd)) return "$0.00";
  return `$${usd.toFixed(2)}`;
}

export const __cost_cap_widget_internal = { Donut, toneColor, formatUsd };
