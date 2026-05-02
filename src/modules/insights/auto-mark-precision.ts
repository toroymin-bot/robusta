/**
 * auto-mark-precision.ts
 *   - C-D26-1 (D6 11시 슬롯, 2026-05-02) — Tori spec C-D26-1 (B-61/F-61/D-61).
 *
 * Why: 자동 마크 v1 정밀도(precision)/재현율(recall) 측정 순수 함수.
 *   sample = { inferred, actual, text }. inferred = inferInsightKind 결과, actual = 사용자 검증 결과.
 *   사용자가 'auto' 마크를 'user'로 승격하면 actual = inferred (TP).
 *   사용자가 마크 해제하면 actual = null (FP).
 *   사용자가 다른 kind 로 수동 마크하면 actual = 그 kind (FN: inferred null/다른 kind).
 *
 * 결과 노출: dev-mode strip 의 정밀도 카드 — sample ≥ 100 시 표시.
 *
 * OCP: 외부 의존 0. 순수 함수.
 */

import type { InsightKind } from "@/modules/conversation/conversation-types";

export interface AutoMarkSample {
  inferred: InsightKind | null;
  actual: InsightKind | null;
  text: string;
}

export interface AutoMarkPrecisionResult {
  tp: number;
  fp: number;
  fn: number;
  tn: number;
  precision: number;
  recall: number;
  sample: number;
}

/**
 * 분류:
 *   - inferred && actual && inferred === actual → TP (자동 마크가 옳았다)
 *   - inferred && (actual === null || inferred !== actual) → FP (자동 마크 오탐)
 *   - !inferred && actual → FN (사용자만 마크 — 자동이 놓침)
 *   - !inferred && !actual → TN (양쪽 모두 마크 0 — 정상)
 *
 * 분모 0 가드: precision/recall 모두 1 fallback (sample 0건 시 의미 없음 — 호출자가 sample.length 가드).
 */
export function measureAutoMarkPrecision(
  samples: AutoMarkSample[],
): AutoMarkPrecisionResult {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let tn = 0;
  for (const s of samples) {
    if (s.inferred && s.actual && s.inferred === s.actual) tp += 1;
    else if (
      s.inferred &&
      (s.actual === null || s.inferred !== s.actual)
    ) {
      fp += 1;
    } else if (!s.inferred && s.actual) fn += 1;
    else tn += 1;
  }
  const precision = tp + fp === 0 ? 1 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 1 : tp / (tp + fn);
  return { tp, fp, fn, tn, precision, recall, sample: samples.length };
}
