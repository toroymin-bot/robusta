/**
 * /launch — 24h Robusta 모니터 페이지.
 *   C-D43-4 (D-3 15시 슬롯, 2026-05-05) — Tori spec C-D43-4 (F-D43-5 / B-D43-3).
 *
 * Why: D-Day 라이브 후 24h Roy 모니터링 도구. funnelEvents launch:* prefix 카운트 + HN 수동 입력.
 *   D-Day 전 → placeholder.
 *
 * 정책:
 *   - 'use client' 디렉티브 의무 — Next 15 dynamic({ssr:false}) 는 Client Component 에서만 허용.
 *   - 외부 API 호출 0 (BYOK 정합).
 *   - dynamic import 메인 번들 영향 최소화 (page.tsx 자체는 단일 mount).
 */

"use client";

import dynamic from "next/dynamic";

const LaunchMonitorView = dynamic(
  () => import("@/modules/launch/launch-monitor-view"),
  { ssr: false, loading: () => null },
);

export default function LaunchPage() {
  return <LaunchMonitorView />;
}
