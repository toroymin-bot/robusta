/**
 * /schedules — C-D31-4 (D-5 11시 슬롯, 2026-05-03) — F-D31-2 / D-D31-1.
 *
 * Why: Robusta Main 사이드바 3 (방 / 참여자 / 스케줄) 중 "스케줄" 단독 라우트.
 *   - 헤더: i18n schedules.page.title + CostCapWidget (BYOK 비용 cap 가시화)
 *   - 본문: bridge.loadRules() 결과 카드 리스트 또는 빈 상태 (D-D31-1 (c))
 *   - FAB "+ 새 스케줄" → 기존 ScheduleModal 재사용 (보존 13 무수정)
 *
 * 자율 결정 (꼬미 §4 11시):
 *   - 똘이 명세는 /[lang]/schedules 였으나 현 코드베이스에 [lang] 라우팅 부재 (sample/qatest 도 root).
 *   - i18n 라우팅 도입은 별도 Spec 영역 → MVP 는 root /schedules 로 정의 후 t() locale 인자 활용.
 *   - 라우팅 도입 시 본 페이지를 [lang]/schedules 로 이전하는 마이그레이션은 Phase 2 검토.
 *
 * SSR/CSR: bridge.loadRules / ScheduleModal 모두 client-only → 본 페이지 'use client' + 마운트 후 hydrate.
 *
 * 168 HARD GATE: ScheduleModal / CostCapWidget 모두 next/dynamic ssr:false 로 lazy 분리 → 메인 +0 의무.
 */

"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { ScheduleRule } from "@/modules/schedule/schedule-types";
import { describeFrequency, frequencyToCron } from "@/modules/schedule/schedule-types";
import { loadRules } from "@/modules/schedules/schedule-store-bridge";
import { useToastStore } from "@/modules/ui/toast";
import { t } from "@/modules/i18n/messages";
// C-D33-2 (D-5 19시 슬롯, 2026-05-03) — Tori spec C-D33-2 (F-D33-2).
//   /schedules 룰 카드 우측에 chip 마운트 — cron 미리보기 + 다음 발화 시각 tooltip.
import { CronPreviewChip } from "@/modules/schedule/cron-preview-chip";

const CostCapWidget = dynamic(
  () =>
    import("@/modules/cost-cap/cost-cap-widget").then((m) => m.CostCapWidget),
  { ssr: false, loading: () => null },
);

const ScheduleModal = dynamic(
  () =>
    import("@/modules/schedule/schedule-modal").then((m) => m.ScheduleModal),
  { ssr: false, loading: () => null },
);

export default function SchedulesPage() {
  const [rules, setRules] = useState<ScheduleRule[] | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const loaded = await loadRules();
        if (!cancelled) setRules(loaded);
      } catch {
        if (!cancelled) setRules([]);
        useToastStore.getState().push({
          tone: "error",
          message: t("schedule.save.fail"),
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 모달이 닫힐 때 다시 loadRules 호출 — 새로 추가된 룰 즉시 반영.
  function handleModalClose() {
    setModalOpen(false);
    void (async () => {
      try {
        const loaded = await loadRules();
        setRules(loaded);
      } catch {
        // 실패 시 기존 list 유지 — Toast 는 이미 modal 내부에서 처리.
      }
    })();
  }

  return (
    <main
      data-test="schedules-page"
      className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-4 py-6"
    >
      <header className="flex flex-col gap-3">
        <h1
          data-test="schedules-page-title"
          className="text-xl font-semibold text-robusta-ink"
        >
          {t("schedules.page.title")}
        </h1>
        <CostCapWidget />
      </header>

      <section className="flex-1">
        {rules === null ? (
          <p
            data-test="schedules-loading"
            className="text-sm text-robusta-inkDim"
          >
            …
          </p>
        ) : rules.length === 0 ? (
          <div
            data-test="schedules-empty"
            className="flex flex-col items-center justify-center gap-3 rounded border border-dashed border-robusta-divider px-6 py-12 text-center"
          >
            {/* D-D31-1 (c) — 인라인 SVG 일러스트 (외부 자산 0). */}
            <svg
              aria-hidden="true"
              width="48"
              height="48"
              viewBox="0 0 48 48"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-robusta-inkDim"
            >
              <circle cx="24" cy="24" r="18" />
              <path d="M24 14v10l6 4" />
            </svg>
            <p className="text-sm text-robusta-ink">
              {t("schedules.empty.headline")}
            </p>
          </div>
        ) : (
          <ul
            data-test="schedules-rule-list"
            className="flex flex-col gap-2"
          >
            {rules.map((r) => (
              <li
                key={r.id}
                data-test={`schedules-rule-${r.id}`}
                className="rounded border border-robusta-divider px-4 py-3 text-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="text-robusta-ink">
                    {describeFrequency(r.frequency)}
                  </span>
                  {/* C-D33-2 (D-5 19시 슬롯) — chip 마운트. cron invalid 시 fallback chip 자체가 처리. */}
                  <span
                    data-test={`schedules-rule-cron-${r.id}`}
                    className="flex items-center gap-2"
                  >
                    <CronPreviewChip cron={frequencyToCron(r.frequency)} />
                    <span className="text-xs text-robusta-inkDim">
                      {r.enabled ? "✓" : "—"}
                    </span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <button
        type="button"
        onClick={() => setModalOpen(true)}
        data-test="schedules-fab-new"
        aria-label={t("schedules.cta.new")}
        className="
          fixed bottom-4 right-4 rounded-full bg-robusta-accent
          px-4 py-3 text-sm font-semibold text-robusta-ink shadow-lg
          hover:opacity-90
          focus:outline-none focus:ring-2 focus:ring-robusta-accent focus:ring-offset-2
        "
      >
        {t("schedules.cta.new")}
      </button>

      {modalOpen && <ScheduleModal onClose={handleModalClose} />}
    </main>
  );
}
