/**
 * schedule-store.ts
 *   - C-D17-16 (Day 5 23시 슬롯, 2026-04-30) — F-15 자동 발언 스케줄 UI 골격.
 *     · Zustand store + IndexedDB persist via settings 테이블 key="schedule.rules".
 *     · 영구화: 단일 JSON 레코드 (rules 배열). per-rule 인덱스 X — 헤더/모달은 전체 list만 필요.
 *     · 트리거 X: 본 store는 데이터 모델만 박힘. cron 트리거는 D11+ Vercel Cron 박은 후 별도 모듈.
 *
 * 보안/비용 정책:
 *   - 키 저장 X — 스케줄 메타만 (participantId, frequency, enabled).
 *   - localStorage 미사용 (D-4.4 정합 — IndexedDB 단일 통로).
 *   - IndexedDB 차단 환경: in-memory만 (다음 부트엔 빈 list로 리셋, silent 안전).
 */

"use client";

import { create } from "zustand";
import { getDb } from "@/modules/storage/db";
import {
  type ScheduleRule,
  type ScheduleFrequency,
  isValidFrequency,
} from "./schedule-types";

const SETTINGS_SCHEDULE_KEY = "schedule.rules";

interface ScheduleStore {
  rules: ScheduleRule[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  /** 신규 룰 추가 — 유효하지 않은 frequency면 false 반환(silent 거부). */
  addRule: (input: {
    participantId: string;
    frequency: ScheduleFrequency;
  }) => Promise<boolean>;
  /** id로 삭제. 존재하지 않으면 noop. */
  removeRule: (id: string) => Promise<void>;
  /** id의 enabled 토글. 존재하지 않으면 noop. */
  toggleRule: (id: string) => Promise<void>;
  /** 특정 참여자에 박힌 룰 목록. */
  getRulesForParticipant: (participantId: string) => ScheduleRule[];
}

function makeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // 폴백: 랜덤 + 타임스탬프. 충돌 위험 매우 낮지만 명시.
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function persist(rules: ScheduleRule[]): Promise<void> {
  try {
    const db = getDb();
    await db.settings.put({
      key: SETTINGS_SCHEDULE_KEY,
      value: JSON.stringify(rules),
      updatedAt: Date.now(),
    });
  } catch {
    // IndexedDB 차단 환경 — in-memory만 유지. silent (UI 동작은 정상).
  }
}

export const useScheduleStore = create<ScheduleStore>((set, get) => ({
  rules: [],
  hydrated: false,

  async hydrate() {
    if (get().hydrated) return;
    try {
      const db = getDb();
      const row = await db.settings.get(SETTINGS_SCHEDULE_KEY);
      if (row?.value) {
        try {
          const parsed = JSON.parse(row.value) as ScheduleRule[];
          if (Array.isArray(parsed)) {
            // 손상 row 방어 — frequency invalid면 drop.
            const cleaned = parsed.filter(
              (r) =>
                r &&
                typeof r.id === "string" &&
                typeof r.participantId === "string" &&
                typeof r.enabled === "boolean" &&
                r.frequency &&
                isValidFrequency(r.frequency),
            );
            set({ rules: cleaned, hydrated: true });
            return;
          }
        } catch {
          // JSON 손상 — 빈 list로 시작.
        }
      }
    } catch {
      // IndexedDB 차단 — in-memory.
    }
    set({ hydrated: true });
  },

  async addRule(input) {
    if (!isValidFrequency(input.frequency)) return false;
    if (!input.participantId) return false;
    const now = Date.now();
    const rule: ScheduleRule = {
      id: makeId(),
      participantId: input.participantId,
      frequency: input.frequency,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    };
    const next = [...get().rules, rule];
    set({ rules: next });
    await persist(next);
    return true;
  },

  async removeRule(id) {
    const prev = get().rules;
    const next = prev.filter((r) => r.id !== id);
    if (next.length === prev.length) return;
    set({ rules: next });
    await persist(next);
  },

  async toggleRule(id) {
    const prev = get().rules;
    let changed = false;
    const next = prev.map((r) => {
      if (r.id !== id) return r;
      changed = true;
      return { ...r, enabled: !r.enabled, updatedAt: Date.now() };
    });
    if (!changed) return;
    set({ rules: next });
    await persist(next);
  },

  getRulesForParticipant(participantId) {
    return get().rules.filter((r) => r.participantId === participantId);
  },
}));

export const __schedule_internal = {
  SETTINGS_SCHEDULE_KEY,
};
