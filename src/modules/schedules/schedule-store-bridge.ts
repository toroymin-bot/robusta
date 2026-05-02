/**
 * schedule-store-bridge.ts
 *   - C-D30-3 (D-5 07시 슬롯, 2026-05-03) — Tori spec C-D30-3 (꼬미 §2 권장 #2 + F-D30-3).
 *
 * Why: Spec 004 본체 — schedule-store (UI 상태) 와 schedule-runner (Dexie ScheduleRow polling) 의
 *   양방향 wiring. C-D29-4 rule-row-adapter (ruleToRow / rowToRule) 활용.
 *
 * 자율 결정 (꼬미 §2 자체):
 *   - 명세는 src/stores/schedule-store.ts 또는 src/modules/schedules/schedule-store.ts 라고 함.
 *     기존 src/modules/schedule/schedule-store.ts 가 보존 13 자산 (D-D17 P1 신규).
 *     OCP — 기존 store 무수정. 본 bridge 모듈을 schedules/ (D-D29-4 어댑터와 동일 위치) 에 신설.
 *   - persistRule / loadRules / deleteRule 헬퍼만 export. UI 는 본 헬퍼 호출 후 useScheduleStore 갱신.
 *
 * 동시 다중 탭 race (MVP):
 *   - 마지막 쓰기 우선 (last-write-wins). BroadcastChannel 통합은 Phase 2.
 *
 * OCP: schedule-store / schedule-runner / rule-row-adapter / db (ScheduleRow) 모두 무수정.
 */

"use client";

import type { ScheduleRule } from "@/modules/schedule/schedule-types";
import { ruleToRow, rowToRule } from "./rule-row-adapter";

/**
 * persistRule — ScheduleRule → Dexie schedules 테이블 put.
 *
 *   id 미발급 (rule.id === "") 이면 crypto.randomUUID() 으로 생성 후 ScheduleRule 갱신은 호출자 책임.
 *   본 함수는 입력된 rule 의 id 를 그대로 row.id 로 사용.
 *
 *   엣지 케이스:
 *     - SSR (window undefined) → throw (호출자가 client-only 보장)
 *     - Dexie put 실패 → 예외 전파 (호출자가 Toast warning)
 */
export async function persistRule(rule: ScheduleRule): Promise<void> {
  if (typeof window === "undefined") {
    throw new Error("persistRule: client-only");
  }
  const { getDb } = await import("@/modules/storage/db");
  const db = getDb();
  const row = ruleToRow(rule);
  await db.schedules.put(row);
}

/**
 * loadRules — Dexie schedules 전체 → ScheduleRule[] 변환.
 *
 *   row.cron 이 5 preset 외 (custom) → rowToRule null → 본 함수가 filter (UI 미지원).
 *   Spec 004 본체에서 custom cron UI 지원 시 별도 함수 (loadRulesIncludingCustom) 추가 예정.
 *
 *   엣지 케이스:
 *     - SSR → 빈 배열
 *     - Dexie 차단 → throw (호출자가 in-memory fallback)
 */
export async function loadRules(): Promise<ScheduleRule[]> {
  if (typeof window === "undefined") return [];
  const { getDb } = await import("@/modules/storage/db");
  const db = getDb();
  const rows = await db.schedules.toArray();
  const rules: ScheduleRule[] = [];
  for (const row of rows) {
    const rule = rowToRule(row);
    if (rule) rules.push(rule);
  }
  return rules;
}

/**
 * deleteRule — id 로 Dexie schedules row 삭제.
 *
 *   존재하지 않는 id → noop (Dexie delete 가 silent).
 *
 *   엣지 케이스:
 *     - SSR → throw
 *     - Dexie 차단 → throw
 */
export async function deleteRule(id: string): Promise<void> {
  if (typeof window === "undefined") {
    throw new Error("deleteRule: client-only");
  }
  if (!id) return;
  const { getDb } = await import("@/modules/storage/db");
  const db = getDb();
  await db.schedules.delete(id);
}

/**
 * generateRuleId — crypto.randomUUID() 폴백.
 *   schedule-store.makeId() 와 동일 패턴 — 본 bridge 가 외부 의존 없이 id 발급 시 사용.
 */
export function generateRuleId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export const __schedule_bridge_internal = {
  persistRule,
  loadRules,
  deleteRule,
  generateRuleId,
};
