/**
 * auto-mark-sample-store.ts
 *   - C-D26-1 (D6 11시 슬롯, 2026-05-02) — Tori spec C-D26-1.
 *   - C-D28-4 (D6 23시 슬롯, 2026-05-02) — Tori spec C-D28-4 (B-D28-1/F-D28-1).
 *     · 메모리 only → Dexie v8 autoMarks 테이블 영속화 + LRU 1000 cap.
 *     · 호출자(insight-mark.tsx)는 add(sample, roomId?) 로 호출 — 기존 add(s) 호환.
 *     · hydrate() 부트 1회 호출 — 새로고침 후에도 sample 보존.
 *     · IndexedDB 미지원/차단 시 인메모리 fallback (기존 동작 유지).
 *
 * Why: 자동 마크 sample 누적 store (zustand + Dexie). measureAutoMarkPrecision 입력.
 *
 * OCP: 외부 의존 — zustand + db (getDb / autoMarkRowToSample / autoMarkSampleToRow).
 *   기존 add(s) 시그니처 보존 (두 번째 인자 roomId 옵션 추가 — 누락 시 'default').
 */

"use client";

import { create } from "zustand";
import type { AutoMarkSample } from "@/modules/insights/auto-mark-precision";
import {
  getDb,
  autoMarkRowToSample,
  autoMarkSampleToRow,
} from "@/modules/storage/db";

// C-D28-4: LRU cap. Dexie row 가 1000 초과 시 가장 오래된(ts asc 첫 1건) row 삭제.
const SAMPLE_LIMIT = 1000;
const DEFAULT_ROOM_ID = "default";

interface AutoMarkSampleStore {
  samples: AutoMarkSample[];
  hydrated: boolean;
  /**
   * C-D28-4: 부트 시 1회 호출 (insight-mark 또는 dev-mode-strip 마운트).
   *   IndexedDB 차단 시 silent — samples=[] 유지.
   */
  hydrate: () => Promise<void>;
  /**
   * C-D26-1 호환 시그니처 — roomId 옵션. 누락 시 DEFAULT_ROOM_ID.
   *   IndexedDB 영속 + LRU 1000 cap 평가.
   */
  add: (s: AutoMarkSample, roomId?: string) => void;
  clear: () => void;
  getAll: () => AutoMarkSample[];
}

export const useAutoMarkSampleStore = create<AutoMarkSampleStore>(
  (set, get) => ({
    samples: [],
    hydrated: false,

    async hydrate() {
      if (get().hydrated) return;
      if (typeof window === "undefined") {
        set({ hydrated: true });
        return;
      }
      try {
        const db = getDb();
        // 최신순 1000건 — Dexie [roomId+ts] 인덱스로 정렬 + 한계.
        //   여러 룸 sample 누적 시에도 ts asc 로 가져온 뒤 메모리에 그대로 push.
        const rows = await db.autoMarks.orderBy("ts").toArray();
        // LRU: 부트 시 1000 초과 row 발견 시 정리 (다중 탭 race 안전망).
        if (rows.length > SAMPLE_LIMIT) {
          const overflow = rows.length - SAMPLE_LIMIT;
          const idsToDelete = rows
            .slice(0, overflow)
            .map((r) => r.id)
            .filter((id): id is number => typeof id === "number");
          if (idsToDelete.length > 0) {
            await db.autoMarks.bulkDelete(idsToDelete);
          }
          rows.splice(0, overflow);
        }
        set({
          samples: rows.map(autoMarkRowToSample),
          hydrated: true,
        });
      } catch (err) {
        // IndexedDB 차단(privacy 모드 등) → silent fallback. samples=[] 유지.
        console.warn("[robusta] auto-mark hydrate skipped", err);
        set({ hydrated: true });
      }
    },

    add(s, roomId = DEFAULT_ROOM_ID) {
      // 1) 메모리 우선 갱신 (UX 즉시 반영).
      const next = [...get().samples, s];
      if (next.length > SAMPLE_LIMIT) next.shift();
      set({ samples: next });
      // 2) Dexie 영속 + LRU cap (silent on failure).
      if (typeof window === "undefined") return;
      const ts = Date.now();
      void (async () => {
        try {
          const db = getDb();
          const row = autoMarkSampleToRow(s, roomId, ts);
          // 트랜잭션: add + count + (가장 오래된 1건 delete) — 다중 탭 race 안전.
          await db.transaction("rw", db.autoMarks, async () => {
            await db.autoMarks.add(row as never);
            const total = await db.autoMarks.count();
            if (total > SAMPLE_LIMIT) {
              // 가장 오래된 ts asc 첫 1건 삭제 — LRU.
              const oldest = await db.autoMarks.orderBy("ts").first();
              if (oldest && typeof oldest.id === "number") {
                await db.autoMarks.delete(oldest.id);
              }
            }
          });
        } catch (err) {
          // IndexedDB 차단/스키마 문제 — silent. 메모리 path 는 이미 갱신됨.
          console.warn("[robusta] auto-mark persist skipped", err);
        }
      })();
    },

    clear() {
      set({ samples: [] });
      if (typeof window === "undefined") return;
      void (async () => {
        try {
          await getDb().autoMarks.clear();
        } catch (err) {
          console.warn("[robusta] auto-mark clear skipped", err);
        }
      })();
    },

    getAll() {
      return get().samples;
    },
  }),
);
