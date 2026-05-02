/**
 * rule-row-adapter.ts
 *   - C-D29-4 (D-5 03시 슬롯, 2026-05-03) — Tori spec C-D29-4 (꼬미 §11 P1 권장 흡수).
 *
 * Why: schedule-store 의 ScheduleRule (frequency: every-minutes/hourly-at/daily-at) 와
 *   schedule-runner 의 ScheduleRow (cron 문자열 + target_room/target_persona) 두 모델 보존.
 *   양방향 변환 어댑터만 추가 — OCP (둘 다 무수정).
 *
 * 변환 룰 (Tori spec C-D29-4):
 *   ScheduleRule.frequency      ↔ ScheduleRow.cron
 *   ─────────────────────────── ─ ─────────────────────
 *   {every-minutes, 5}            "*\/5 * * * *"
 *   {every-minutes, 30}           "*\/30 * * * *"
 *   {hourly-at, 0}                "0 * * * *"
 *   {hourly-at, M} (1~59)         "M * * * *"
 *   {daily-at, H, 0}              "0 H * * *"
 *   {daily-at, H, M}              "M H * * *"
 *
 * 5 preset 외 cron (예: "*\/7 * * * *") 은 ScheduleRule 로 표현 불가 → rowToRule 반환 null + console.warn.
 *
 * OCP: 외부 의존 — schedule-types (ScheduleRule) + db (ScheduleRow) 타입만 import.
 */

import type {
  ScheduleRule,
  ScheduleFrequency,
} from "@/modules/schedule/schedule-types";
import type { ScheduleRow } from "@/modules/storage/db";

/**
 * ruleToRow — ScheduleRule → ScheduleRow 변환.
 *   rule.participantId 는 ScheduleRow.target_persona 로 매핑.
 *   target_room 은 rule 에 없으므로 "default" 고정 (Spec 004 본체에서 필드 추가 시 정정).
 *   prompt 는 빈 문자열 — fire 시점에 conversation-store 가 결정.
 *   name 은 frequency describe + participantId 합성.
 */
export function ruleToRow(rule: ScheduleRule): ScheduleRow {
  return {
    id: rule.id,
    name: `${describeFrequencyShort(rule.frequency)} → ${rule.participantId}`,
    cron: frequencyToCron(rule.frequency),
    target_room: "default",
    target_persona: rule.participantId,
    prompt: "",
    enabled: rule.enabled,
    last_run: null,
    created_at: rule.createdAt,
  };
}

/**
 * rowToRule — ScheduleRow → ScheduleRule 변환.
 *   cron 이 5 preset (every-N-minutes / hourly-at / daily-at) 외이면 null + console.warn.
 *   target_room 정보는 ScheduleRule 모델에 없으므로 무시.
 */
export function rowToRule(row: ScheduleRow): ScheduleRule | null {
  const freq = cronToFrequency(row.cron);
  if (!freq) {
    if (typeof console !== "undefined") {
      console.warn(
        "[robusta] rule-row-adapter: cron not representable as ScheduleRule",
        row.cron,
      );
    }
    return null;
  }
  return {
    id: row.id,
    participantId: row.target_persona,
    frequency: freq,
    enabled: row.enabled,
    createdAt: row.created_at,
    updatedAt: row.created_at,
  };
}

/** ScheduleFrequency → cron 문자열. 5 preset 보장. */
export function frequencyToCron(f: ScheduleFrequency): string {
  if (f.kind === "every-minutes") {
    return `*/${f.minutes} * * * *`;
  }
  if (f.kind === "hourly-at") {
    return `${f.minute} * * * *`;
  }
  // daily-at
  return `${f.minute} ${f.hour} * * *`;
}

/**
 * cronToFrequency — cron 문자열 → ScheduleFrequency 또는 null (5 preset 외).
 *   매칭 패턴:
 *     "*\/N * * * *"      → {every-minutes, N}
 *     "M * * * *"          → {hourly-at, M}     (M = 0~59)
 *     "M H * * *"          → {daily-at, H, M}   (H = 0~23, M = 0~59)
 */
export function cronToFrequency(cron: string): ScheduleFrequency | null {
  const trimmed = cron.trim();
  // every-minutes: */N * * * *
  const em = /^\*\/(\d+)\s+\*\s+\*\s+\*\s+\*$/.exec(trimmed);
  if (em) {
    const n = Number(em[1]);
    if (Number.isInteger(n) && n > 0 && n < 60) {
      return { kind: "every-minutes", minutes: n };
    }
    return null;
  }
  // hourly-at: M * * * *  (M = 0~59)
  const ha = /^(\d+)\s+\*\s+\*\s+\*\s+\*$/.exec(trimmed);
  if (ha) {
    const m = Number(ha[1]);
    if (Number.isInteger(m) && m >= 0 && m <= 59) {
      return { kind: "hourly-at", minute: m };
    }
    return null;
  }
  // daily-at: M H * * *
  const da = /^(\d+)\s+(\d+)\s+\*\s+\*\s+\*$/.exec(trimmed);
  if (da) {
    const m = Number(da[1]);
    const h = Number(da[2]);
    if (
      Number.isInteger(m) &&
      m >= 0 &&
      m <= 59 &&
      Number.isInteger(h) &&
      h >= 0 &&
      h <= 23
    ) {
      return { kind: "daily-at", hour: h, minute: m };
    }
    return null;
  }
  return null;
}

function describeFrequencyShort(f: ScheduleFrequency): string {
  if (f.kind === "every-minutes") return `매 ${f.minutes}분`;
  if (f.kind === "hourly-at") return `매시 ${String(f.minute).padStart(2, "0")}분`;
  return `매일 ${String(f.hour).padStart(2, "0")}:${String(f.minute).padStart(2, "0")}`;
}
