/**
 * schedule-modal.tsx
 *   - C-D17-16 (Day 5 23시 슬롯, 2026-04-30) — F-15 자동 발언 스케줄 UI 골격.
 *     · 모달 — AI 참여자별 스케줄 룰 add/list/toggle/remove.
 *     · 상단에 "비활성 안내" 배너: 트리거는 D11+에서 등록됨 (현재는 영구화만).
 *     · 접근성: role="dialog" + aria-modal + Esc 닫기 + backdrop 클릭 닫기.
 *
 * UI 골격 (잡스 단순함):
 *   1. 참여자 list (AI만, kind==='ai') — 각 카드에 룰 list + "추가" 버튼.
 *   2. 추가 폼 — frequency kind dropdown + 값 입력 + 저장.
 *   3. 룰 row — 라벨 + enabled 토글 + 삭제.
 */

"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useParticipantStore } from "@/stores/participant-store";
import { useScheduleStore } from "./schedule-store";
import {
  type ScheduleFrequency,
  ALLOWED_EVERY_MINUTES,
  describeFrequency,
} from "./schedule-types";

interface ScheduleModalProps {
  onClose: () => void;
}

type FormKind = "every-minutes" | "hourly-at" | "daily-at";

function buildFrequency(
  kind: FormKind,
  values: { everyMinutes: number; hourlyMinute: number; dailyHour: number; dailyMinute: number },
): ScheduleFrequency | null {
  if (kind === "every-minutes") {
    return { kind, minutes: values.everyMinutes };
  }
  if (kind === "hourly-at") {
    return { kind, minute: values.hourlyMinute };
  }
  if (kind === "daily-at") {
    return { kind, hour: values.dailyHour, minute: values.dailyMinute };
  }
  return null;
}

export function ScheduleModal({ onClose }: ScheduleModalProps) {
  const dialogId = useId();
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const participants = useParticipantStore((s) => s.participants);
  const aiParticipants = participants.filter((p) => p.kind === "ai");

  const hydrated = useScheduleStore((s) => s.hydrated);
  const hydrate = useScheduleStore((s) => s.hydrate);
  const rules = useScheduleStore((s) => s.rules);
  const addRule = useScheduleStore((s) => s.addRule);
  const removeRule = useScheduleStore((s) => s.removeRule);
  const toggleRule = useScheduleStore((s) => s.toggleRule);

  // 부트 시 1회 hydrate.
  useEffect(() => {
    if (!hydrated) {
      void hydrate();
    }
  }, [hydrated, hydrate]);

  // body scroll lock + Esc 닫기 + 첫 포커스를 닫기 버튼으로.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${dialogId}-title`}
      data-test="schedule-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-lg bg-robusta-canvas shadow-xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-robusta-divider px-5 py-3">
          <h2 id={`${dialogId}-title`} className="text-base font-semibold text-robusta-ink">
            ⏰ 자동 발언 스케줄
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="스케줄 모달 닫기"
            data-test="schedule-modal-close"
            className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded border border-robusta-divider text-robusta-ink hover:border-robusta-accent focus:outline-none focus:ring-2 focus:ring-robusta-accent focus:ring-offset-2"
          >
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        </div>

        {/* "비활성 안내" 배너 — 트리거 D11+ 명시. 본 슬롯은 UI + IndexedDB 영구화만. */}
        <div
          data-test="schedule-inactive-banner"
          className="border-b border-robusta-divider bg-robusta-accent/10 px-5 py-3 text-xs text-robusta-ink"
        >
          <strong className="font-semibold">D11+ 활성화 예정 —</strong> 현재는 룰을 저장만 하고 자동 발언은 등록하지 않습니다.
          영구화는 즉시 동작하며, Vercel Cron 트리거가 등록된 후 자동 발언이 시작됩니다.
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!hydrated ? (
            <p className="text-sm text-robusta-inkDim" data-test="schedule-loading">스케줄 불러오는 중…</p>
          ) : aiParticipants.length === 0 ? (
            <p className="text-sm text-robusta-inkDim" data-test="schedule-no-ai">
              AI 참여자가 없습니다. 먼저 좌측 패널에서 AI를 추가해주세요.
            </p>
          ) : (
            <ul className="flex flex-col gap-4" data-test="schedule-participant-list">
              {aiParticipants.map((p) => {
                const myRules = rules.filter((r) => r.participantId === p.id);
                return (
                  <li
                    key={p.id}
                    data-test={`schedule-participant-${p.id}`}
                    className="rounded border border-robusta-divider px-4 py-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-robusta-ink">{p.name}</span>
                      <span className="text-xs text-robusta-inkDim">{myRules.length}개 룰</span>
                    </div>
                    {myRules.length > 0 && (
                      <ul className="mt-2 flex flex-col gap-1" data-test={`schedule-rules-${p.id}`}>
                        {myRules.map((r) => (
                          <li
                            key={r.id}
                            data-test={`schedule-rule-${r.id}`}
                            className="flex items-center justify-between rounded bg-robusta-accent/10 px-3 py-2 text-sm"
                          >
                            <span className={r.enabled ? "text-robusta-ink" : "text-robusta-inkDim line-through"}>
                              {describeFrequency(r.frequency)}
                            </span>
                            <span className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => void toggleRule(r.id)}
                                data-test={`schedule-rule-toggle-${r.id}`}
                                aria-label={r.enabled ? "룰 비활성화" : "룰 활성화"}
                                className="rounded border border-robusta-divider px-2 py-1 text-xs text-robusta-ink hover:border-robusta-accent focus:outline-none focus:ring-2 focus:ring-robusta-accent focus:ring-offset-2"
                              >
                                {r.enabled ? "비활성화" : "활성화"}
                              </button>
                              <button
                                type="button"
                                onClick={() => void removeRule(r.id)}
                                data-test={`schedule-rule-remove-${r.id}`}
                                aria-label="룰 삭제"
                                className="rounded border border-robusta-divider px-2 py-1 text-xs text-robusta-ink hover:border-red-500 hover:text-red-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                              >
                                삭제
                              </button>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <AddRuleForm
                      participantId={p.id}
                      onAdd={async (freq) => {
                        await addRule({ participantId: p.id, frequency: freq });
                      }}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-robusta-divider px-5 py-3 text-right">
          <button
            type="button"
            onClick={onClose}
            data-test="schedule-modal-done"
            className="rounded bg-robusta-accent px-4 py-2 text-sm font-semibold text-robusta-ink hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-robusta-accent focus:ring-offset-2"
          >
            완료
          </button>
        </div>
      </div>
    </div>
  );
}

interface AddRuleFormProps {
  participantId: string;
  onAdd: (freq: ScheduleFrequency) => Promise<void>;
}

function AddRuleForm({ participantId, onAdd }: AddRuleFormProps) {
  const [kind, setKind] = useState<FormKind>("hourly-at");
  const [everyMinutes, setEveryMinutes] = useState<number>(30);
  const [hourlyMinute, setHourlyMinute] = useState<number>(0);
  const [dailyHour, setDailyHour] = useState<number>(9);
  const [dailyMinute, setDailyMinute] = useState<number>(0);
  const [busy, setBusy] = useState(false);

  return (
    <form
      data-test={`schedule-add-form-${participantId}`}
      className="mt-3 flex flex-wrap items-center gap-2 border-t border-robusta-divider pt-3"
      onSubmit={async (ev) => {
        ev.preventDefault();
        if (busy) return;
        const freq = buildFrequency(kind, { everyMinutes, hourlyMinute, dailyHour, dailyMinute });
        if (!freq) return;
        setBusy(true);
        try {
          await onAdd(freq);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="text-xs text-robusta-inkDim">
        주기
        <select
          value={kind}
          onChange={(ev) => setKind(ev.target.value as FormKind)}
          data-test={`schedule-add-kind-${participantId}`}
          className="ml-1 rounded border border-robusta-divider bg-transparent px-2 py-1 text-sm text-robusta-ink focus:outline-none focus:ring-2 focus:ring-robusta-accent"
        >
          <option value="every-minutes">매 N분마다</option>
          <option value="hourly-at">매 시간 :MM</option>
          <option value="daily-at">매일 HH:MM</option>
        </select>
      </label>

      {kind === "every-minutes" && (
        <label className="text-xs text-robusta-inkDim">
          분
          <select
            value={everyMinutes}
            onChange={(ev) => setEveryMinutes(Number(ev.target.value))}
            data-test={`schedule-add-every-${participantId}`}
            className="ml-1 rounded border border-robusta-divider bg-transparent px-2 py-1 text-sm text-robusta-ink focus:outline-none focus:ring-2 focus:ring-robusta-accent"
          >
            {ALLOWED_EVERY_MINUTES.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
      )}

      {kind === "hourly-at" && (
        <label className="text-xs text-robusta-inkDim">
          분
          <input
            type="number"
            min={0}
            max={59}
            step={1}
            value={hourlyMinute}
            onChange={(ev) => {
              const n = Number(ev.target.value);
              if (Number.isInteger(n) && n >= 0 && n <= 59) setHourlyMinute(n);
            }}
            data-test={`schedule-add-hourly-${participantId}`}
            className="ml-1 w-16 rounded border border-robusta-divider bg-transparent px-2 py-1 text-sm text-robusta-ink focus:outline-none focus:ring-2 focus:ring-robusta-accent"
          />
        </label>
      )}

      {kind === "daily-at" && (
        <>
          <label className="text-xs text-robusta-inkDim">
            시
            <input
              type="number"
              min={0}
              max={23}
              step={1}
              value={dailyHour}
              onChange={(ev) => {
                const n = Number(ev.target.value);
                if (Number.isInteger(n) && n >= 0 && n <= 23) setDailyHour(n);
              }}
              data-test={`schedule-add-daily-hour-${participantId}`}
              className="ml-1 w-16 rounded border border-robusta-divider bg-transparent px-2 py-1 text-sm text-robusta-ink focus:outline-none focus:ring-2 focus:ring-robusta-accent"
            />
          </label>
          <label className="text-xs text-robusta-inkDim">
            분
            <input
              type="number"
              min={0}
              max={59}
              step={1}
              value={dailyMinute}
              onChange={(ev) => {
                const n = Number(ev.target.value);
                if (Number.isInteger(n) && n >= 0 && n <= 59) setDailyMinute(n);
              }}
              data-test={`schedule-add-daily-minute-${participantId}`}
              className="ml-1 w-16 rounded border border-robusta-divider bg-transparent px-2 py-1 text-sm text-robusta-ink focus:outline-none focus:ring-2 focus:ring-robusta-accent"
            />
          </label>
        </>
      )}

      <button
        type="submit"
        disabled={busy}
        data-test={`schedule-add-submit-${participantId}`}
        className="ml-auto rounded border border-robusta-accent px-3 py-1 text-xs text-robusta-ink hover:bg-robusta-accent/15 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-robusta-accent focus:ring-offset-2"
      >
        + 룰 추가
      </button>
    </form>
  );
}
