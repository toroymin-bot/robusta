/**
 * insight-store.ts
 *   - C-D24-4 (D6 03시 슬롯, 2026-05-02) — B-52 인사이트 라이브러리 사이드 시트 v0.
 *
 * v0 정책:
 *   - 인메모리 zustand store. IndexedDB 영구화는 별도 마이그레이션 (db.ts 보존 대상).
 *   - 룸 단위 캡처 카드 — 메시지 → 통찰 캡처 시 추가, 단순 리스트 유지.
 *   - 검색·태그·메모는 P2 분리. 1차는 capture / byRoom / count / remove 4종 메서드.
 *   - cleanup 은 호출자 책임. SideSheet close 시 메모리 누수 방지를 위해 store 자체는 영구 (페이지 갱신 시 휘발).
 */

"use client";

import { create } from "zustand";
import type { InsightKind } from "@/modules/conversation/conversation-types";

export interface Insight {
  id: string;
  roomId: string;
  sourceMessageId: string;
  text: string;
  personaId?: string | null;
  insightKind?: InsightKind;
  createdAt: number;
}

export interface CaptureInput {
  roomId: string;
  sourceMessageId: string;
  text: string;
  personaId?: string | null;
  insightKind?: InsightKind;
}

interface InsightStoreState {
  insights: Insight[];
  capture: (params: CaptureInput) => Insight;
  byRoom: (roomId: string, limit?: number) => Insight[];
  count: (roomId: string) => number;
  remove: (id: string) => void;
}

function genId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `ins_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const useInsightStore = create<InsightStoreState>((set, get) => ({
  insights: [],

  capture(params) {
    const insight: Insight = {
      id: genId(),
      roomId: params.roomId,
      sourceMessageId: params.sourceMessageId,
      text: params.text,
      personaId: params.personaId ?? null,
      insightKind: params.insightKind,
      createdAt: Date.now(),
    };
    set((s) => ({ insights: [...s.insights, insight] }));
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
  },
}));
