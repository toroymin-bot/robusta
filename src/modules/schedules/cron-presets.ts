/**
 * schedules/cron-presets.ts
 *   C-D35-3 (D-4 03시 슬롯, 2026-05-04) — Tori spec C-D35-3 / F-D35-3.
 *
 * Why: schedule UI form 의 cron preset dropdown — 5 패턴.
 *   free-form cron 입력은 사용자 실수 위험 → preset 5건으로 한정 (MVP 안전).
 *   cron-preview-chip(C-D34-4) 가 5 preset 모두 정상 라벨 출력 의무 (라운드트립).
 *
 *   외부 의존 0 — 단일 const 배열만 export.
 */

import type { MessageKey } from "@/modules/i18n/messages";

export interface CronPreset {
  id: string;
  cron: string;
  labelKey: MessageKey;
}

export const CRON_PRESETS = [
  { id: "hourly", cron: "0 * * * *", labelKey: "schedule.preset.hourly" },
  { id: "daily9", cron: "0 9 * * *", labelKey: "schedule.preset.daily9" },
  {
    id: "weekday_mon9",
    cron: "0 9 * * 1",
    labelKey: "schedule.preset.weekday_mon9",
  },
  {
    id: "monthly_d1_9",
    cron: "0 9 1 * *",
    labelKey: "schedule.preset.monthly_d1_9",
  },
  { id: "friday18", cron: "0 18 * * 5", labelKey: "schedule.preset.friday18" },
] as const satisfies readonly CronPreset[];

export type CronPresetId = (typeof CRON_PRESETS)[number]["id"];
