"use client";

/**
 * schedules/schedule-add-form.tsx
 *   C-D35-3 (D-4 03시 슬롯, 2026-05-04) — Tori spec C-D35-3 (F-D35-3).
 *
 * Why: /schedules 페이지 form — preset 5건 dropdown + label + persona id + enable toggle.
 *   Dexie schedules 테이블에 cron preset row 직접 등록 (ScheduleRule 표현 불가 패턴 포함).
 *   onSubmit 후 onAdded 콜백 호출 → 페이지가 list reload + BroadcastChannel publish.
 *
 * 정책:
 *   - label trim 후 빈 문자열 → submit 버튼 비활성화
 *   - participantId 공백 → "default" 자동 사용 (persistCronPresetRow 안에서 처리)
 *   - 외부 dev-deps 0
 */

import { useState } from "react";
import { CRON_PRESETS, type CronPresetId } from "./cron-presets";
import { persistCronPresetRow } from "./schedule-store-bridge";
import { publishScheduleChange } from "./schedule-broadcast";
import { t } from "@/modules/i18n/messages";
import { useToastStore } from "@/modules/ui/toast";

interface ScheduleAddFormProps {
  onAdded?: () => void;
}

export function ScheduleAddForm({ onAdded }: ScheduleAddFormProps) {
  const [presetId, setPresetId] = useState<CronPresetId>(CRON_PRESETS[0].id);
  const [label, setLabel] = useState("");
  const [persona, setPersona] = useState("default");
  const [enabled, setEnabled] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const trimmedLabel = label.trim();
  const canSubmit = !submitting && trimmedLabel.length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    const preset = CRON_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setSubmitting(true);
    try {
      await persistCronPresetRow({
        cron: preset.cron,
        label: trimmedLabel,
        participantId: persona,
        enabled,
      });
      publishScheduleChange();
      setLabel("");
      onAdded?.();
    } catch (err) {
      useToastStore.getState().push({
        tone: "error",
        message: t("schedule.save.fail"),
      });
      if (typeof console !== "undefined") {
        console.warn("[robusta] schedule add failed", err);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      data-test="schedules-add-form"
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded border border-robusta-divider bg-transparent px-4 py-3"
    >
      <div className="flex flex-col gap-1">
        <label
          htmlFor="schedule-add-preset"
          className="text-xs text-robusta-inkDim"
        >
          {t("schedule.add.preset")}
        </label>
        <select
          id="schedule-add-preset"
          data-test="schedules-add-preset"
          value={presetId}
          onChange={(e) => setPresetId(e.target.value as CronPresetId)}
          className="rounded border border-robusta-divider bg-transparent px-2 py-1 text-sm text-robusta-ink"
        >
          {CRON_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {t(p.labelKey)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="schedule-add-label"
          className="text-xs text-robusta-inkDim"
        >
          {t("schedule.add.label")}
        </label>
        <input
          id="schedule-add-label"
          data-test="schedules-add-label"
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={60}
          className="rounded border border-robusta-divider bg-transparent px-2 py-1 text-sm text-robusta-ink"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="schedule-add-persona"
          className="text-xs text-robusta-inkDim"
        >
          {t("schedule.add.persona")}
        </label>
        <input
          id="schedule-add-persona"
          data-test="schedules-add-persona"
          type="text"
          value={persona}
          onChange={(e) => setPersona(e.target.value)}
          maxLength={40}
          className="rounded border border-robusta-divider bg-transparent px-2 py-1 text-sm text-robusta-ink"
        />
      </div>

      <label className="flex items-center gap-2 text-xs text-robusta-ink">
        <input
          data-test="schedules-add-enable"
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        {t("schedule.add.enable")}
      </label>

      <div className="flex justify-end">
        <button
          type="submit"
          data-test="schedules-add-submit"
          disabled={!canSubmit}
          className="rounded bg-robusta-accent px-3 py-1.5 text-sm font-semibold text-black disabled:opacity-60"
        >
          {t("schedule.add.submit")}
        </button>
      </div>
    </form>
  );
}

export default ScheduleAddForm;
