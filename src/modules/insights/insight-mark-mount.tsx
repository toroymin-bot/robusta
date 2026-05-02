/**
 * insight-mark-mount.tsx
 *   - C-D29-5 (D-5 03시 슬롯, 2026-05-03) — Tori spec C-D29-5 (꼬미 §11 P2 권장 흡수).
 *
 * Why: auto-mark-sample-store hydrate() 부트 호출처. C-D28-4 hydrate 시그니처 추가됐지만
 *   호출처가 dev-mode-strip 외 부재 — 일반 사용자 첫 페인트 시점에 sample 복원 안 됨.
 *
 * 동작:
 *   - useEffect 1회 호출 — autoMarkSampleStore.hydrate() (idempotent — 중복 안전).
 *   - StrictMode 이중 마운트 → store 의 hydrated 플래그로 idempotent 보장 (auto-mark-sample-store §52).
 *   - hydrate Promise reject → store 내부에서 console.warn + samples=[] fallback.
 *
 * dynamic import:
 *   - 호출자 (conversation-workspace) 가 next/dynamic ssr:false 로 lazy 로드.
 *   - 메인 번들 +0 의무 (168 kB 게이트 유지). zustand store 는 이미 main bundle 에 있으므로 +0.
 *
 * OCP: auto-mark-sample-store.ts 무수정. 본 컴포넌트는 hydrate 호출만 하고 null 렌더.
 */

"use client";

import { useEffect } from "react";
import { useAutoMarkSampleStore } from "@/stores/auto-mark-sample-store";

/**
 * InsightMarkMount — null 렌더 + hydrate 1회 호출 컴포넌트.
 *   conversation-workspace 등 client root 에 1회만 마운트.
 */
export function InsightMarkMount(): null {
  const hydrate = useAutoMarkSampleStore((s) => s.hydrate);
  useEffect(() => {
    void hydrate();
  }, [hydrate]);
  return null;
}
