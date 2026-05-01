/**
 * insight-store.ts
 *   - C-D24-4 (D6 03시 슬롯, 2026-05-02) — B-52 인사이트 라이브러리 사이드 시트 v0 (메모리 only).
 *   - C-D25-2 (D6 07시 슬롯, 2026-05-02) — Tori spec B-57/F-57: Dexie v7 영구화 어댑터.
 *
 * v1 정책:
 *   - 단일 진실 소스 = Dexie `insights` 표 (db.ts v7 신규).
 *   - zustand 메모리는 룸별 최근 50건 캐시 — UI 동기 read 경로 보존(byRoom/count/remove API 호환).
 *   - capture/remove 는 Dexie write 와 메모리 갱신을 동시 (fire-and-forget put).
 *   - hydrate(roomId) — 룸 진입 시 1회. Dexie 조회 → 메모리 캐시 채움. 멱등.
 *   - SSR (typeof window === 'undefined') → Dexie 호출 skip, 메모리만 (D3 패턴 계승).
 *   - IndexedDB 차단/실패 → catch + silent fallback (메모리만 유지). 토스트는 호출자 책임.
 *   - 룸 단위 검색·태그·메모는 P2 분리.
 *
 * cleanup 은 호출자 책임. SideSheet close 시 메모리 누수 방지를 위해 store 자체는 영구.
 */

"use client";

import { create } from "zustand";
import type { InsightKind } from "@/modules/conversation/conversation-types";
import { getDb, type InsightRow } from "@/modules/storage/db";

export interface Insight {
  id: string;
  roomId: string;
  sourceMessageId: string;
  text: string;
  personaId?: string | null;
  insightKind?: InsightKind;
  /** C-D25-2: 사용자 수동 vs 자동 마크 표식. 라이브러리 카드에서 분기 가능. */
  markedBy?: "user" | "auto";
  createdAt: number;
}

export interface CaptureInput {
  roomId: string;
  sourceMessageId: string;
  text: string;
  personaId?: string | null;
  insightKind?: InsightKind;
  markedBy?: "user" | "auto";
}

interface InsightStoreState {
  insights: Insight[];
  /** C-D25-2: 룸 진입 시 1회 호출. Dexie → 메모리 캐시 채움. 멱등 — 같은 룸 재호출 시 최신 50건 재로드. */
  hydrate: (roomId: string) => Promise<void>;
  capture: (params: CaptureInput) => Insight;
  byRoom: (roomId: string, limit?: number) => Insight[];
  count: (roomId: string) => number;
  remove: (id: string) => void;
}

const ROOM_CACHE_LIMIT = 50;

function genId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `ins_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function rowToInsight(row: InsightRow): Insight {
  return {
    id: row.id,
    roomId: row.roomId,
    sourceMessageId: row.sourceMessageId,
    text: row.text,
    personaId: row.personaId,
    insightKind: row.insightKind ?? undefined,
    markedBy: row.markedBy,
    createdAt: row.createdAt,
  };
}

function insightToRow(i: Insight): InsightRow {
  return {
    id: i.id,
    roomId: i.roomId,
    sourceMessageId: i.sourceMessageId,
    text: i.text,
    personaId: i.personaId ?? null,
    insightKind: i.insightKind ?? null,
    markedBy: i.markedBy ?? "user",
    createdAt: i.createdAt,
  };
}

/** SSR / IndexedDB 차단 환경 안전 wrapper — 실패 시 silent. */
async function safeDexie<T>(fn: () => Promise<T>): Promise<T | null> {
  if (typeof window === "undefined") return null;
  try {
    return await fn();
  } catch (err) {
    console.warn("[robusta] insight dexie op failed", err);
    return null;
  }
}

export const useInsightStore = create<InsightStoreState>((set, get) => ({
  insights: [],

  async hydrate(roomId) {
    const result = await safeDexie(async () => {
      const db = getDb();
      // [roomId+createdAt] 인덱스 최신순 — 최신 50건만 메모리에.
      const rows = await db.insights
        .where("[roomId+createdAt]")
        .between([roomId, 0], [roomId, Date.now() + 1])
        .reverse()
        .limit(ROOM_CACHE_LIMIT)
        .toArray();
      return rows.map(rowToInsight);
    });
    if (!result) return;
    // 다른 룸의 메모리 캐시는 보존. 본 룸 항목만 교체.
    set((s) => {
      const otherRooms = s.insights.filter((i) => i.roomId !== roomId);
      return { insights: [...otherRooms, ...result] };
    });
  },

  capture(params) {
    const insight: Insight = {
      id: genId(),
      roomId: params.roomId,
      sourceMessageId: params.sourceMessageId,
      text: params.text,
      personaId: params.personaId ?? null,
      insightKind: params.insightKind,
      markedBy: params.markedBy ?? "user",
      createdAt: Date.now(),
    };
    set((s) => ({ insights: [...s.insights, insight] }));
    // C-D25-2: Dexie 동시 write — 실패 silent (메모리는 이미 등록).
    void safeDexie(async () => {
      const db = getDb();
      await db.insights.put(insightToRow(insight));
    });
    return insight;
  },

  byRoom(roomId, limit = 50) {
    const all = get().insights.filter((i) => i.roomId === roomId);
    // 최신순 정렬, limit 적용 (페이지네이션은 P2).
    return all.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
  },

  count(roomId) {
    return get().insights.reduce(
      (acc, i) => (i.roomId === roomId ? acc + 1 : acc),
      0,
    );
  },

  remove(id) {
    set((s) => ({ insights: s.insights.filter((i) => i.id !== id) }));
    // C-D25-2: Dexie delete — 실패 silent (메모리는 이미 제거).
    void safeDexie(async () => {
      const db = getDb();
      await db.insights.delete(id);
    });
  },
}));

/** verify-d25.mjs 용 — 내부 상수 노출. */
export const __insight_store_internal = {
  ROOM_CACHE_LIMIT,
};
