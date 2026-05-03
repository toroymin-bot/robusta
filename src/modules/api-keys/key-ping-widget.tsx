/**
 * key-ping-widget.tsx — C-D31-5 (D-5 11시 슬롯, 2026-05-03) — F-D31-5 / D-D31-?.
 *
 * Why: BYOK 키 회전·만료 인지 가시화. provider 라벨 + 상태 dot + 마지막 ping 시각 + 재확인 버튼.
 *   - status="ok" → green dot
 *   - status="fail" → red dot
 *   - status="unknown" → gray dot
 *   - lastPingedAt 미정 → "—" 표시
 *   - onRePing throw → Toast.error + status 유지 (호출자 onRePing 책임)
 *
 * 마운트 위치 (꼬미 자율 결정 권장):
 *   - MVP: /schedules 헤더 또는 ScheduleModal Advanced. 본 위젯은 위치 독립 — props 만 받음.
 *   - Phase 2: Settings → BYOK 섹션 본격 통합.
 *
 * 168 HARD GATE: 호출자가 next/dynamic ssr:false 로 lazy 분리 권장. 본 컴포넌트 자체는 정적 export.
 *
 * OCP: api-key-ping (보존 13) / api-key-store / messages 무수정. UI shell 만 신설.
 */

"use client";

import type { JSX } from "react";
import { useState } from "react";
import { useToastStore } from "@/modules/ui/toast";
import { t } from "@/modules/i18n/messages";

export type KeyPingStatus = "ok" | "fail" | "unknown";

const DOT_COLOR: Record<KeyPingStatus, string> = {
  ok: "#22C55E", // green-500 — insight-footer agreement 와 동일 hue 토큰
  fail: "#EF4444", // red-500
  unknown: "#9CA3AF", // gray-400
};

export interface KeyPingWidgetProps {
  /** 라벨용 provider 표시명 (e.g. "Anthropic"). */
  provider: string;
  /** 마지막 ping 시각 (ms epoch). 미정 → "—" 표시. */
  lastPingedAt?: number;
  /** 현재 상태 — 호출자가 store/IndexedDB 에서 hydrate 후 전달. */
  status: KeyPingStatus;
  /** 재확인 클릭 시 호출. throw 시 본 위젯이 Toast.error 노출. */
  onRePing: () => Promise<void>;
}

function formatLastPinged(ms?: number): string {
  if (typeof ms !== "number" || ms <= 0) return "—";
  try {
    return new Date(ms).toLocaleString("ko-KR", {
      timeZone: "Asia/Seoul",
      hour12: false,
    });
  } catch {
    return "—";
  }
}

export function KeyPingWidget(props: KeyPingWidgetProps): JSX.Element {
  const [pending, setPending] = useState(false);
  const dotColor = DOT_COLOR[props.status];
  const lastLabel = formatLastPinged(props.lastPingedAt);

  async function handleRePing() {
    if (pending) return;
    setPending(true);
    try {
      await props.onRePing();
    } catch {
      useToastStore.getState().push({
        tone: "error",
        message: t("schedule.save.fail"),
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      data-test="key-ping-widget"
      data-status={props.status}
      aria-label={t("keyping.label")}
      className="flex items-center gap-3 rounded border border-robusta-divider px-3 py-2 text-sm"
    >
      <span
        data-test="key-ping-dot"
        aria-hidden="true"
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: dotColor }}
      />
      <span className="font-medium text-robusta-ink">{props.provider}</span>
      <span
        data-test="key-ping-status-label"
        className="text-xs text-robusta-inkDim"
      >
        {props.status === "ok"
          ? t("keyping.status.ok")
          : props.status === "fail"
            ? t("keyping.status.fail")
            : "—"}
      </span>
      <span
        data-test="key-ping-last"
        className="ml-auto text-xs text-robusta-inkDim"
      >
        {lastLabel}
      </span>
      <button
        type="button"
        onClick={handleRePing}
        disabled={pending}
        data-test="key-ping-reping"
        aria-label={t("keyping.action.reping")}
        className="
          rounded border border-robusta-divider px-2 py-1 text-xs
          text-robusta-ink hover:border-robusta-accent
          disabled:cursor-not-allowed disabled:opacity-50
          focus:outline-none focus:ring-2 focus:ring-robusta-accent focus:ring-offset-2
        "
      >
        {pending ? "…" : t("keyping.action.reping")}
      </button>
    </section>
  );
}
