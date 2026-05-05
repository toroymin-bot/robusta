/**
 * /launch/kpi — 24h funnelEvents read-only KPI dashboard.
 *   - C-D44-3 (D-3 19시 슬롯, 2026-05-05) — Tori spec C-D44-3 (B-D44-5 + F-D44-3).
 *
 * 정책:
 *   - 'use client' 디렉티브 의무 — Next 15 dynamic({ssr:false}) 는 Client Component 에서만 허용.
 *   - 외부 API 호출 0 — Dexie funnelEvents read-only 만.
 *
 * 자율 정정 D-44-자-5: 명세 경로 src/app/[lang]/launch/kpi/page.tsx 미존재 — 실 라우트는 /launch (lang 0).
 */

"use client";

import dynamic from "next/dynamic";

const FunnelKPIDashboard = dynamic(
  () => import("@/modules/launch/funnel-kpi"),
  { ssr: false, loading: () => null },
);

export default function LaunchKPIPage() {
  return <FunnelKPIDashboard />;
}
