"use client";

/**
 * funnel-kpi.tsx
 *   - C-D44-3 (D-3 19시 슬롯, 2026-05-05) — Tori spec C-D44-3 (F-D44-3).
 *   - C-D45-2 (D-3 23시 슬롯, 2026-05-05) — RELEASE_ISO ±1h watch 모드 5s 갱신 + spike 빨강 강조
 *     (B-D45-3 / F-D45-2 / D-D45-3). OCP — 기존 props 무수정.
 *
 * Why: 24h funnelEvents read-only KPI 페이지 — 인라인 SVG 막대그래프.
 *   외부 chart 라이브러리 0 (외부 dev-deps +0 의무).
 *
 * 정책:
 *   - read-only — getFunnel24h(WithSpike) 만 호출 (db.put/add/delete 0).
 *   - 자동 갱신 — RELEASE_ISO ±1h watch 모드는 5초, 그 외 30초 (cleanup 의무 — clearInterval).
 *   - watch 모드 진입/이탈 자동 감지 — 매 refresh 결과의 isWatchMode로 interval 재조정.
 *   - 빈 결과 시 "데이터 없음" 안내.
 *   - spike 항목은 빨강(--bar-spike) — D-D45-3.
 *
 * 외부 dev-deps +0.
 */

import type { JSX } from "react";
import { useEffect, useState } from "react";
import { t, type Locale } from "@/modules/i18n/messages";
import {
  getFunnel24hWithSpike,
  isWatchModeNow,
  type FunnelKPIWithSpike,
  type FunnelSpikeEntry,
} from "./funnel-kpi-query";

const EMPTY_KPI: FunnelKPIWithSpike = {
  total: 0,
  byType: {},
  windowStart: "",
  windowEnd: "",
  isWatchMode: false,
  spikes: [],
};

const INTERVAL_WATCH_MS = 5_000;
const INTERVAL_DEFAULT_MS = 30_000;

export interface FunnelKPIDashboardProps {
  lang?: Locale;
}

function BarChart(props: {
  data: Record<string, number>;
  max: number;
  spikes: FunnelSpikeEntry[];
}): JSX.Element {
  const entries = Object.entries(props.data).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return <div data-test="kpi-bars-empty" />;
  const spikeMap = new Map(props.spikes.map((s) => [s.type, s.isSpike]));
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
        const isSpike = spikeMap.get(type) === true;
        return (
          <g key={type} data-spike={isSpike ? "true" : "false"}>
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
              className={isSpike ? "fill-red-500" : "fill-robusta-accent"}
              opacity={isSpike ? 0.95 : 0.85}
              data-test={isSpike ? "kpi-bar-spike" : "kpi-bar-default"}
            />
            <text
              x={labelW + Math.max(w, 1) + 6}
              y={y + barH * 0.7}
              fontSize={11}
              fill="currentColor"
              className={
                isSpike
                  ? "font-mono tabular-nums text-red-600"
                  : "font-mono tabular-nums text-robusta-ink"
              }
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
  const [kpi, setKpi] = useState<FunnelKPIWithSpike>(EMPTY_KPI);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    let cancelled = false;
    // window.setInterval 반환 타입은 환경(@types/node 노출)에 따라 number 또는 NodeJS.Timeout.
    //   클로저 내부에서만 호출되므로 number cast 으로 일원화 (clearInterval은 양쪽 모두 수용).
    let intervalId: number | undefined;
    let currentMs = 0;

    async function refresh() {
      const next = await getFunnel24hWithSpike();
      if (cancelled) return;
      setKpi(next);
      // watch 모드 진입/이탈 자동 감지 — interval 재조정 (cleanup → 재설정).
      const expectedMs = next.isWatchMode
        ? INTERVAL_WATCH_MS
        : INTERVAL_DEFAULT_MS;
      if (currentMs !== expectedMs) {
        if (intervalId !== undefined) window.clearInterval(intervalId);
        currentMs = expectedMs;
        intervalId = window.setInterval(() => {
          void refresh();
        }, expectedMs) as unknown as number;
      }
    }

    void refresh();
    return () => {
      cancelled = true;
      if (intervalId !== undefined) window.clearInterval(intervalId);
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

      <div className="mb-4 flex flex-wrap gap-4 text-xs text-robusta-inkDim">
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
        {hydrated && kpi.isWatchMode ? (
          <span
            data-test="kpi-watch-mode"
            className="rounded border border-red-300 bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-950 dark:text-red-300"
          >
            {t("launch.kpi.live.watch.label", undefined, lang)}
          </span>
        ) : null}
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
          <BarChart data={kpi.byType} max={max} spikes={kpi.spikes} />
        </div>
      )}
    </main>
  );
}

// SSR-safe re-export — verify-d45 gate import 정합 (isWatchModeNow grep).
export { isWatchModeNow };
