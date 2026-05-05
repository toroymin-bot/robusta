"use client";

/**
 * launch-monitor-view.tsx
 *   - C-D43-4 (D-3 15시 슬롯, 2026-05-05) — Tori spec C-D43-4 (F-D43-5 / B-D43-3).
 *
 * Why: D-Day 라이브 후 24h Roy 모니터 — Show HN ranking + comments + funnel 12 events 카운트.
 *   D-Day 전 (2026-05-08 KST 이전) → placeholder. 30초 간격 자동 갱신.
 *
 * 정책:
 *   - 외부 API 호출 0 (BYOK 정합) — HN ranking/comments 는 Roy 수동 입력.
 *   - 라이브 데이터는 IndexedDB funnelEvents (launch:* prefix) 만.
 *
 * 자율 정정 D-43-자-2: db.ts Dexie v3→v4 마이그레이션 불필요 — funnelEvents 이미 v10 존재.
 *   db.ts 무수정 (보존 13 v3 무손상).
 */

import { useEffect, useState } from "react";
import { t } from "@/modules/i18n/messages";
import { isLive } from "@/modules/dday/dday-config";
import {
  FUNNEL_EVENTS,
  getFunnelCounts,
  type LaunchFunnelEvent,
} from "./funnel-events";

const ACQUISITION: readonly LaunchFunnelEvent[] = [
  "page_view",
  "show_hn_arrival",
  "direct_visit",
];
const ACTIVATION: readonly LaunchFunnelEvent[] = [
  "chip_click",
  "byok_input",
  "first_message",
];
const AHA: readonly LaunchFunnelEvent[] = [
  "ai_response",
  "fifth_turn",
  "meeting_record_download",
];
const SHARE: readonly LaunchFunnelEvent[] = [
  "share_link_copy",
  "twitter_share",
  "show_hn_comment",
];

const DEFAULT_COUNTS: Record<LaunchFunnelEvent, number> = Object.fromEntries(
  FUNNEL_EVENTS.map((e) => [e, 0]),
) as Record<LaunchFunnelEvent, number>;

function Section(props: {
  title: string;
  events: readonly LaunchFunnelEvent[];
  counts: Record<LaunchFunnelEvent, number>;
}) {
  return (
    <section className="rounded border border-robusta-divider p-3">
      <h3 className="mb-2 text-sm font-semibold text-robusta-ink">
        {props.title}
      </h3>
      <ul className="space-y-1 text-xs text-robusta-inkDim">
        {props.events.map((ev) => (
          <li key={ev} className="flex justify-between">
            <span className="font-mono">{ev}</span>
            <span className="font-semibold tabular-nums text-robusta-ink">
              {props.counts[ev] ?? 0}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function LaunchMonitorView() {
  const [counts, setCounts] = useState<Record<LaunchFunnelEvent, number>>(
    DEFAULT_COUNTS,
  );
  const [hnRank, setHnRank] = useState("");
  const [hnComments, setHnComments] = useState("");
  const [now, setNow] = useState<number>(() => Date.now());
  const live = isLive();

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      const next = await getFunnelCounts();
      if (cancelled) return;
      setCounts(next);
      setNow(Date.now());
    }
    void refresh();
    const id = setInterval(() => {
      void refresh();
    }, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hnRank && !hnComments) return;
    void (async () => {
      try {
        const { getDb } = await import("@/modules/storage/db");
        const db = getDb();
        await db.funnelEvents.add({
          type: "launch:show_hn_arrival",
          timestamp: Date.now(),
          payload: {
            manual: true,
            hnRank: hnRank ? Number(hnRank) : undefined,
            hnComments: hnComments ? Number(hnComments) : undefined,
          },
        } as never);
        setHnRank("");
        setHnComments("");
      } catch (err) {
        console.warn("[launch-monitor] manual submit failed", err);
      }
    })();
  };

  return (
    <main
      className="mx-auto max-w-3xl px-4 py-8"
      data-test="launch-monitor-view"
    >
      <header className="mb-6 flex items-baseline justify-between">
        <h1 className="text-xl font-semibold text-robusta-ink">
          {t("launch.title")}
        </h1>
        <time className="text-xs text-robusta-inkDim tabular-nums">
          {new Date(now).toISOString()}
        </time>
      </header>

      {!live && (
        <div
          data-test="launch-predday"
          className="mb-6 rounded border border-robusta-divider bg-stone-50 p-3 text-sm text-robusta-inkDim dark:bg-stone-900"
        >
          {t("launch.predday.placeholder")}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Section
          title={t("launch.section.acquisition")}
          events={ACQUISITION}
          counts={counts}
        />
        <Section
          title={t("launch.section.activation")}
          events={ACTIVATION}
          counts={counts}
        />
        <Section
          title={t("launch.section.aha")}
          events={AHA}
          counts={counts}
        />
        <Section
          title={t("launch.section.share")}
          events={SHARE}
          counts={counts}
        />
      </div>

      <form
        onSubmit={handleManualSubmit}
        className="mt-6 flex flex-wrap items-end gap-3 rounded border border-robusta-divider p-3"
      >
        <label className="flex flex-col text-xs text-robusta-inkDim">
          {t("launch.manual.hn.rank")}
          <input
            type="number"
            min={0}
            value={hnRank}
            onChange={(e) => setHnRank(e.target.value)}
            className="mt-1 w-24 rounded border border-robusta-divider px-2 py-1 text-sm tabular-nums"
          />
        </label>
        <label className="flex flex-col text-xs text-robusta-inkDim">
          {t("launch.manual.hn.comments")}
          <input
            type="number"
            min={0}
            value={hnComments}
            onChange={(e) => setHnComments(e.target.value)}
            className="mt-1 w-24 rounded border border-robusta-divider px-2 py-1 text-sm tabular-nums"
          />
        </label>
        <button
          type="submit"
          className="rounded bg-robusta-accent px-3 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
          disabled={!hnRank && !hnComments}
        >
          Submit
        </button>
      </form>
    </main>
  );
}
