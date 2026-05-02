/**
 * auto-mark-sample-store.ts
 *   - C-D26-1 (D6 11시 슬롯, 2026-05-02) — Tori spec C-D26-1.
 *
 * Why: 자동 마크 sample 누적 store (zustand, 메모리 only).
 *   영구화는 D-D27 후보 (Dexie v8 가능성).
 *   add() → 자동 마크가 inferred kind 를 산출했을 때 호출 (insight-mark 의 사용자 검증 분기).
 *   getAll() → measureAutoMarkPrecision 에 전달.
 *   clear() → dev-mode 카드 reset 버튼 (선택).
 *
 * OCP: 외부 의존 0 (zustand only). insight-store 와 분리 (precision 측정 전용).
 */

"use client";

import { create } from "zustand";
import type { AutoMarkSample } from "@/modules/insights/auto-mark-precision";

const SAMPLE_LIMIT = 1000;

interface AutoMarkSampleStore {
  samples: AutoMarkSample[];
  add: (s: AutoMarkSample) => void;
  clear: () => void;
  getAll: () => AutoMarkSample[];
}

export const useAutoMarkSampleStore = create<AutoMarkSampleStore>(
  (set, get) => ({
    samples: [],
    add(s) {
      const next = [...get().samples, s];
      // 메모리 가드 — 1000건 초과 시 가장 오래된 것부터 drop.
      if (next.length > SAMPLE_LIMIT) next.shift();
      set({ samples: next });
    },
    clear() {
      set({ samples: [] });
    },
    getAll() {
      return get().samples;
    },
  }),
);
