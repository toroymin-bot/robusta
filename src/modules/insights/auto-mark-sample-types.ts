/**
 * auto-mark-sample-types.ts
 *   - C-D27-2 (D6 15시 슬롯, 2026-05-02) — Tori spec C-D27-2 (B-67/F-67/D-67).
 *
 * Why: 자동 마크 v1 정밀도 측정용 샘플 케이스 4종 분류.
 *   sample = { inferred: kind|null, actual: kind|null }.
 *   - TP: inferred=actual (자동 마크가 옳음)
 *   - FP: inferred 있음 + actual 다름/null (자동 오탐)
 *   - FN: inferred 없음 + actual 있음 (자동이 놓침)
 *   - TN: 양쪽 모두 null (정상 — 본 슬롯 미흡수, sample-store add 호출 시점에서 actual=inferred=null 케이스 거의 0)
 *
 * 호출자: insight-mark.tsx 의 사용자 검증 분기 3종.
 *
 * OCP: 외부 의존 0. 순수 함수. classifySample → SampleCase 반환.
 */

import type { InsightKind } from "@/modules/conversation/conversation-types";

export type SampleCase = "tp" | "fp" | "fn" | "tn";

export function classifySample(
  inferred: InsightKind | null,
  actual: InsightKind | null,
): SampleCase {
  if (inferred && actual && inferred === actual) return "tp";
  if (inferred && (actual === null || inferred !== actual)) return "fp";
  if (!inferred && actual) return "fn";
  return "tn";
}
