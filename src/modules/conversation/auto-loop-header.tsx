"use client";

/**
 * AutoLoopHeader — D-D11-2 (Day 11, 2026-04-29, B19 채택분) C-D11-2.
 *
 *   AI-Auto 모드(turnMode === "ai-auto")일 때만 헤더 영역에 mount된다.
 *   다른 모드에서는 null 반환 — workspace 헤더 정합성 유지.
 *
 *   구성 (좌→우):
 *     1) 상태 점 — running(녹색 펄스)/paused(회색)/completed(파랑)/no-key(빨강)/idle(연회색)
 *     2) ▶/⏸ 토글 — 키 없으면 disabled, paused는 resume, idle/completed는 새로 시작
 *     3) 카운터 + 진행 바 — turnsCompleted/maxAutoTurns
 *     4) 인터벌 셀렉트 — 5/15/30/60초 (sm 이상에서만 노출)
 *     5) maxTurns 셀렉트 — 5/10/20/30 (sm 이상에서만 노출)
 *
 *   접근성: role="region" + aria-label 박음. 셀렉트는 native + label.
 *   회귀 게이트: self-check #115/#116 — export + workspace mount 검증.
 */

import { useApiKeyStore } from "@/stores/api-key-store";
import { useConversationStore } from "@/stores/conversation-store";
import { t } from "@/modules/i18n/messages";

export function AutoLoopHeader() {
  // store subscribe — 셀렉터 1개당 1회로 분리하여 불필요한 리렌더 방지.
  const turnMode = useConversationStore((s) => s.turnMode);
  const status = useConversationStore((s) => s.autoLoopStatus);
  const turnsCompleted = useConversationStore((s) => s.autoTurnsCompleted);
  const config = useConversationStore((s) => s.autoLoopConfig);
  const startAction = useConversationStore((s) => s.startAutoLoopAction);
  const stopAction = useConversationStore((s) => s.stopAutoLoopAction);
  const resumeAction = useConversationStore((s) => s.resumeAutoLoopAction);
  const setConfig = useConversationStore((s) => s.setAutoLoopConfig);

  // BYOK 키 — useApiKeyStore.keys.anthropic. (똘이 명세 §11.2 추정 63 정정 반영.)
  const apiKey = useApiKeyStore((s) => s.keys.anthropic);

  // ai-auto 모드가 아니면 렌더 X — workspace 헤더 사이즈/여백 회귀 방지(E16).
  if (turnMode !== "ai-auto") return null;

  const hasKey = !!apiKey;
  const isRunning = status === "running";
  const isPaused = status === "paused-human" || status === "paused-hidden";
  const isCompleted = status === "completed";

  const onPlayPause = () => {
    if (!hasKey) return;
    if (isRunning) {
      // running → ⏸ 클릭 시 manual stop (paused가 아닌 terminal로 전이).
      //   paused 상태에서만 resume 가능. running은 stop 후 새 ▶로 다시 시작.
      stopAction("manual");
    } else if (isPaused) {
      resumeAction();
    } else {
      // idle/completed/stopped-error → 새로 시작 (turnsCompleted 0 리셋은 startAutoLoopAction 내부).
      startAction();
    }
  };

  const dotClass = !hasKey
    ? "bg-red-500"
    : isRunning
      ? "bg-green-500 animate-pulse"
      : isPaused
        ? "bg-zinc-400"
        : isCompleted
          ? "bg-blue-500"
          : "bg-zinc-300";

  return (
    <div
      className="flex items-center gap-2 border-b border-robusta-divider bg-robusta-canvas/60 px-3 py-1.5"
      data-test="auto-loop-header"
      role="region"
      aria-label={t("autoLoop.header.region")}
    >
      <span
        className={`h-2 w-2 rounded-full ${dotClass}`}
        aria-hidden="true"
        title={!hasKey ? t("autoLoop.byokMissing") : undefined}
      />
      <button
        type="button"
        onClick={onPlayPause}
        disabled={!hasKey}
        aria-label={isRunning ? t("autoLoop.header.pause") : t("autoLoop.header.start")}
        data-test="auto-loop-toggle"
        className="rounded px-2 py-0.5 text-sm text-robusta-ink hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-zinc-800"
      >
        {isRunning ? "⏸" : "▶"}
      </button>
      <div className="flex items-center gap-1 text-xs tabular-nums text-robusta-inkDim">
        <span data-test="auto-loop-counter">
          {turnsCompleted}/{config.maxAutoTurns}
          {t("autoLoop.header.progress")}
        </span>
        <div
          className="hidden h-1 w-12 overflow-hidden rounded bg-zinc-200 sm:block dark:bg-zinc-800"
          aria-hidden="true"
        >
          <div
            className="h-full bg-green-500 transition-all"
            style={{
              width: `${Math.min(100, (turnsCompleted / config.maxAutoTurns) * 100)}%`,
            }}
          />
        </div>
      </div>
      <label className="hidden items-center gap-1 text-xs text-robusta-inkDim sm:flex">
        <span>{t("autoLoop.header.interval")}</span>
        <select
          value={config.intervalMs}
          onChange={(e) => setConfig({ intervalMs: Number(e.target.value) })}
          className="rounded border border-robusta-divider bg-transparent px-1 py-0.5 text-xs text-robusta-ink"
          data-test="auto-loop-interval"
          aria-label={t("autoLoop.header.interval")}
        >
          <option value={5000}>5s</option>
          <option value={15000}>15s</option>
          <option value={30000}>30s</option>
          <option value={60000}>60s</option>
        </select>
      </label>
      <label className="hidden items-center gap-1 text-xs text-robusta-inkDim sm:flex">
        <span>{t("autoLoop.header.maxTurns")}</span>
        <select
          value={config.maxAutoTurns}
          onChange={(e) => setConfig({ maxAutoTurns: Number(e.target.value) })}
          className="rounded border border-robusta-divider bg-transparent px-1 py-0.5 text-xs text-robusta-ink"
          data-test="auto-loop-max-turns"
          aria-label={t("autoLoop.header.maxTurns")}
        >
          <option value={5}>5</option>
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={30}>30</option>
        </select>
      </label>
    </div>
  );
}
