/**
 * insight-library-sheet.tsx
 *   - C-D24-4 (D6 03시 슬롯, 2026-05-02) — B-52 / D-52 / F-52 인사이트 라이브러리 사이드 시트 v0.
 *
 * 동작:
 *   - 룸별 캡처 카드 리스트 (최신순). 각 카드 = 미리보기 3줄 + 색명 인디케이터 + 작성 시각.
 *   - 빈 상태: t("insightLibrary.empty") + 가이드 1줄.
 *   - limit 50 + "더 보기" 버튼 (실제 로드 P2 분리, 본 슬롯은 stub).
 *
 * dynamic import:
 *   - 호출자 (header-cluster) 가 next/dynamic 으로 lazy 로드. 메인 번들 +0 의무.
 *
 * OCP:
 *   - 신규 모듈. 기존 SideSheet 마크업과 분리 — 자체 fixed-position 오버레이로 마운트.
 *   - 사이드 시트 너비 60% (D-21 패턴 계승).
 */

"use client";

import { useEffect, useState } from "react";
import { useInsightStore } from "./insight-store";
import { t } from "@/modules/i18n/messages";

export interface InsightLibrarySheetProps {
  roomId: string;
  open: boolean;
  onClose: () => void;
}

const PAGE_LIMIT = 50;

export function InsightLibrarySheet({
  roomId,
  open,
  onClose,
}: InsightLibrarySheetProps) {
  const insights = useInsightStore((s) => s.byRoom(roomId, PAGE_LIMIT));
  const remove = useInsightStore((s) => s.remove);
  const [showLoadMore, setShowLoadMore] = useState(false);

  // ESC 닫기 + body scroll lock (open 상태에서만).
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  // PAGE_LIMIT 도달 시 더보기 stub 노출 (P2 페이지네이션 분리).
  useEffect(() => {
    setShowLoadMore(insights.length >= PAGE_LIMIT);
  }, [insights.length]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex"
      role="dialog"
      aria-modal="true"
      aria-label={t("insightLibrary.title")}
      data-test="insight-library-sheet"
    >
      {/* 좌측 60% 사이드 시트 + 우측 40% backdrop. D-21 패턴. */}
      <aside
        className="
          flex h-full w-[60%] flex-col
          border-r border-robusta-divider bg-robusta-canvas
          shadow-xl
        "
      >
        <header className="flex items-center justify-between border-b border-robusta-divider px-4 py-3">
          <h2 className="text-base font-semibold text-robusta-ink">
            {t("insightLibrary.title")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("modal.action.cancel")}
            data-test="insight-library-close"
            className="rounded p-1 text-robusta-inkDim hover:text-robusta-ink"
          >
            ×
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          {insights.length === 0 ? (
            <div
              className="flex flex-col items-start gap-1 text-sm text-robusta-inkDim"
              data-test="insight-library-empty"
            >
              <p>{t("insightLibrary.empty")}</p>
              <p className="text-[12px]">{t("insightLibrary.capture.guide")}</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {insights.map((ins) => {
                const preview = ins.text.split("\n").slice(0, 3).join("\n");
                const ts = new Date(ins.createdAt).toLocaleString();
                return (
                  <li
                    key={ins.id}
                    data-test={`insight-card-${ins.id}`}
                    className="
                      rounded-md border border-robusta-divider
                      bg-robusta-canvas p-3 text-sm text-robusta-ink
                    "
                  >
                    <p className="whitespace-pre-line">{preview}</p>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-robusta-inkDim">
                      <span>{ts}</span>
                      <button
                        type="button"
                        onClick={() => remove(ins.id)}
                        data-test={`insight-card-remove-${ins.id}`}
                        className="rounded px-1.5 py-0.5 hover:text-robusta-ink"
                      >
                        삭제
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {showLoadMore && (
            <button
              type="button"
              data-test="insight-library-load-more"
              className="
                mt-4 w-full rounded border border-robusta-divider
                px-3 py-2 text-sm text-robusta-inkDim hover:text-robusta-ink
              "
              onClick={() => {
                /* P2: 페이지네이션 분리 — 본 슬롯은 stub */
              }}
            >
              더 보기
            </button>
          )}
        </div>
      </aside>

      {/* backdrop */}
      <button
        type="button"
        aria-label={t("modal.action.cancel")}
        onClick={onClose}
        className="h-full flex-1 bg-black/40"
      />
    </div>
  );
}

export default InsightLibrarySheet;
