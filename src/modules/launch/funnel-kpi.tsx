"use client";

/**
 * funnel-kpi.tsx
 *   - C-D44-3 (D-3 19시 슬롯, 2026-05-05) — Tori spec C-D44-3 (F-D44-3).
 *
 * Why: 24h funnelEvents read-only KPI 페이지 — 인라인 SVG 막대그래프.
 *   외부 chart 라이브러리 0 (외부 dev-deps +0 의무).
 *
 * 정책:
 *   - read-only — getFunnel24h 만 호출 (db.put/add/delete 0).
 *   - 30초 자동 갱신 (setInterval).
 *   - 빈 결과 시 "데이터 없음" 안내.
 *
 * 외부 dev-deps +0.
 */

import type { JSX } from "react";
import { useEffect, useState } from "react";
import { t, type Locale } from "@/modules/i18n/messages";
import { getFunnel24h, type FunnelKPI } from "./funnel-kpi-query";

const EMPTY_KPI: FunnelKPI = {
  total: 0,
  byType: {},
  windowStart: "",
  windowEnd: "",
};

export interface FunnelKPIDashboardProps {
  lang?: Locale;
}

function BarChart(props: { data: Record<string, number>; max: number }): JSX.Element {
  const entries = Object.entries(props.data).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return <div data-test="kpi-bars-empty" />;
  const barH = 22;
  const labelW = 180;
  const chartW = 360;
  const totalH = entries.length * (barH + 4);
  return (
    <svg
      data-test="kpi-bars"
      role="img"
      aria-label="funnel events bar chart"
      viewBox={`0 0 ${labelW + chartW + 60} ${totalH}`}
      className="w-full"
    >
      {entries.map(([type, count], i) => {
        const w = props.max > 0 ? (count / props.max) * chartW : 0;
        const y = i * (barH + 4);
        return (
          <g key={type}>
            <text
              x={0}
              y={y + barH * 0.7}
              fontSize={11}
              fill="currentColor"
              className="text-robusta-inkDim"
            >
              {type}
            </text>
            <rect
              x={labelW}
              y={y}
              width={Math.max(w, 1)}
              height={barH}
              className="fill-robusta-accent"
              opacity={0.85}
            />
            <text
              x={labelW + Math.max(w, 1) + 6}
              y={y + barH * 0.7}
              fontSize={11}
              fill="currentColor"
              className="font-mono tabular-nums text-robusta-ink"
            >
              {count}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function FunnelKPIDashboard(
  props: FunnelKPIDashboardProps = {},
): JSX.Element {
  const lang: Locale = props.lang ?? "ko";
  const [kpi, setKpi] = useState<FunnelKPI>(EMPTY_KPI);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    let cancelled = false;
    async function refresh() {
      const next = await getFunnel24h();
      if (!cancelled) setKpi(next);
    }
    void refresh();
    const id = window.setInterval(() => {
      void refresh();
    }, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const max = Math.max(0, ...Object.values(kpi.byType));

  return (
    <main
      data-test="funnel-kpi-dashboard"
      className="mx-auto max-w-3xl px-4 py-8"
    >
      <header className="mb-4">
        <h1 className="text-xl font-semibold text-robusta-ink">
          {t("launch.kpi.title", undefined, lang)}
        </h1>
        <p className="mt-1 text-sm text-robusta-inkDim">
          {t("launch.kpi.subtitle", undefined, lang)}
        </p>
      </header>

      <div className="mb-4 flex gap-4 text-xs text-robusta-inkDim">
        <span data-test="kpi-total">
          {t("launch.kpi.total", undefined, lang)}:{" "}
          <span className="font-mono tabular-nums text-robusta-ink">
            {kpi.total}
          </span>
        </span>
        <span
          data-test="kpi-window"
          suppressHydrationWarning
          className="font-mono tabular-nums"
        >
          {t("launch.kpi.window", undefined, lang)}:{" "}
          {hydrated ? `${kpi.windowStart} → ${kpi.windowEnd}` : "—"}
        </span>
      </div>

      {kpi.total === 0 ? (
        <p
          data-test="kpi-empty"
          className="rounded border border-robusta-divider bg-stone-50 p-4 text-sm text-robusta-inkDim dark:bg-stone-900"
        >
          {t("launch.kpi.empty", undefined, lang)}
        </p>
      ) : (
        <div className="rounded border border-robusta-divider p-3">
          <BarChart data={kpi.byType} max={max} />
        </div>
      )}
    </main>
  );
}
