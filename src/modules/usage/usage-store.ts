/**
 * usage-store.ts
 *   - C-D17-17 (Day 5 15시 슬롯, 2026-04-30) — F-16 BYOK 비용 가시성.
 *     · BYOK 사용자가 본인 키로 얼마 썼는지 헤더 뱃지로 즉시 인지.
 *     · 누적 inputTokens + outputTokens + 비용($) 박음.
 *     · 영구화: IndexedDB settings 테이블의 "usage.cumulative" key 단일 레코드 박음.
 *       (per-message 별도 테이블 X — 헤더 뱃지에는 누적값만 필요. 추후 분석 화면 필요시 별도 store 추가.)
 *   - 모델별 가격: PRICING 표 — 누락 모델은 cost=undefined로 처리(토큰만 표시).
 *   - 호출 시점: conversation-view.tsx의 runAiTurn에서 chunk.kind==="usage" 받을 때 appendUsage 호출.
 *
 * 보안/비용 정책:
 *   - localStorage 미사용 (D-4.4 정합 — IndexedDB 단일 통로).
 *   - IndexedDB 차단 환경: in-memory만 (다음 부트엔 0으로 리셋, silent 안전).
 *   - 키 저장 X — 토큰/비용 수치만.
 */

"use client";

import { create } from "zustand";
import { getDb } from "@/modules/storage/db";

const SETTINGS_USAGE_KEY = "usage.cumulative";

/** 모델별 per-MTok 가격 (USD). 똘이 §36.5 명세 정합 + fallback 모델 박음.
 *  배치 모드 50% 할인은 본 SDK 호출 경로엔 적용 X — 일반 가격만. */
export const PRICING: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 1, output: 5 },
  "claude-opus-4-7": { input: 5, output: 25 },
  // D-8.3 폴백 모델 — Anthropic 가격 페이지 기준(추정 2026-04 시점, 변동 시 갱신 필요).
  "claude-3-5-sonnet-latest": { input: 3, output: 15 },
};

export interface ModelUsage {
  inputs: number;
  outputs: number;
  cost: number; // USD, 누적. 가격표에 없는 모델은 0(cost) 박힘.
}

interface UsagePersisted {
  totalInputs: number;
  totalOutputs: number;
  totalCost: number;
  byModel: Record<string, ModelUsage>;
  updatedAt: number;
}

interface UsageStore {
  totalInputs: number;
  totalOutputs: number;
  totalCost: number;
  byModel: Record<string, ModelUsage>;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  /** runAiTurn에서 호출 — usage event 받을 때마다 누적. */
  appendUsage: (entry: { model: string; input: number; output: number }) => Promise<void>;
  /** QA/디버깅용 — 누적 리셋 (UI 미노출, 콘솔에서만). */
  reset: () => Promise<void>;
}

function computeCost(model: string, input: number, output: number): number {
  const p = PRICING[model];
  if (!p) return 0;
  // per-MTok 가격이라 (tokens / 1_000_000) * price
  return (input / 1_000_000) * p.input + (output / 1_000_000) * p.output;
}

export const useUsageStore = create<UsageStore>((set, get) => ({
  totalInputs: 0,
  totalOutputs: 0,
  totalCost: 0,
  byModel: {},
  hydrated: false,

  async hydrate() {
    if (get().hydrated) return;
    try {
      const db = getDb();
      const row = await db.settings.get(SETTINGS_USAGE_KEY);
      if (row?.value) {
        try {
          const parsed = JSON.parse(row.value) as UsagePersisted;
          set({
            totalInputs: parsed.totalInputs ?? 0,
            totalOutputs: parsed.totalOutputs ?? 0,
            totalCost: parsed.totalCost ?? 0,
            byModel: parsed.byModel ?? {},
            hydrated: true,
          });
          return;
        } catch {
          // 손상된 JSON — 0부터 시작. silent.
        }
      }
    } catch {
      // IndexedDB 차단 — in-memory만.
    }
    set({ hydrated: true });
  },

  async appendUsage(entry) {
    const { model, input, output } = entry;
    if ((!input || input <= 0) && (!output || output <= 0)) return;
    const inDelta = Math.max(0, input | 0);
    const outDelta = Math.max(0, output | 0);
    const costDelta = computeCost(model, inDelta, outDelta);
    const prev = get();
    const prevModel = prev.byModel[model] ?? { inputs: 0, outputs: 0, cost: 0 };
    const nextModel: ModelUsage = {
      inputs: prevModel.inputs + inDelta,
      outputs: prevModel.outputs + outDelta,
      cost: prevModel.cost + costDelta,
    };
    const nextState = {
      totalInputs: prev.totalInputs + inDelta,
      totalOutputs: prev.totalOutputs + outDelta,
      totalCost: prev.totalCost + costDelta,
      byModel: { ...prev.byModel, [model]: nextModel },
    };
    set(nextState);
    try {
      const db = getDb();
      const persisted: UsagePersisted = {
        ...nextState,
        updatedAt: Date.now(),
      };
      await db.settings.put({
        key: SETTINGS_USAGE_KEY,
        value: JSON.stringify(persisted),
        updatedAt: persisted.updatedAt,
      });
    } catch {
      // IndexedDB 차단 — in-memory만 유지. silent.
    }
  },

  async reset() {
    set({ totalInputs: 0, totalOutputs: 0, totalCost: 0, byModel: {} });
    try {
      await getDb().settings.delete(SETTINGS_USAGE_KEY);
    } catch {
      // silent
    }
  },
}));

/** 누적 토큰을 사람이 읽기 쉬운 단위로 포맷. <1K → 그대로 / 1K~999K → "12.4K" / 1M+ → "1.2M". */
export function formatTokens(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}K`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}

/** 누적 비용을 USD 4자리(소수) 포맷. $0.0000. */
export function formatCost(usd: number): string {
  if (usd <= 0) return "$0";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

export const __usage_internal = {
  SETTINGS_USAGE_KEY,
  computeCost,
};
