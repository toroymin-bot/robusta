/**
 * pdf-export-dialog.tsx
 *   - C-D26-3 (D6 11시 슬롯, 2026-05-02) — Tori spec C-D26-3 (D-63).
 *
 * 다이얼로그 3단계:
 *   (1) start: 옵션 체크박스 + 시작 버튼
 *   (2) progress: spinner + 진행률 카피
 *   (3) done: 다운로드 + 닫기
 *
 * 모달 wrapper — Esc 닫기 + click outside 닫기.
 *
 * 메인 번들 +0 — 부모(header-cluster) 가 dynamic import.
 */

"use client";

import { useEffect, useState } from "react";
import { t } from "@/modules/i18n/messages";
import {
  exportRoomToPdf,
  downloadBlob,
  type PdfExportProgress,
} from "./pdf-export";

export interface PdfExportDialogProps {
  roomId: string;
  onClose: () => void;
}

type Phase = "start" | "progress" | "done";

export function PdfExportDialog({ roomId, onClose }: PdfExportDialogProps) {
  const [phase, setPhase] = useState<Phase>("start");
  const [includeInsights, setIncludeInsights] = useState(true);
  const [includeSystem, setIncludeSystem] = useState(false);
  const [progress, setProgress] = useState<PdfExportProgress>({
    phase: "loading-font",
    percent: 0,
  });
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleStart() {
    setPhase("progress");
    setError(null);
    try {
      const out = await exportRoomToPdf(
        roomId,
        { includeInsights, includeSystem, locale: "ko" },
        (p) => setProgress(p),
      );
      setBlob(out);
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("start");
    }
  }

  function handleDownload() {
    if (!blob) return;
    downloadBlob(blob, `robusta-${roomId}.pdf`);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdf-export-title"
      data-test="pdf-export-dialog"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-lg border border-robusta-divider bg-robusta-canvas p-6 shadow-xl">
        <h2
          id="pdf-export-title"
          className="mb-4 text-lg font-semibold text-robusta-ink"
        >
          {t("pdfExport.dialog.title")}
        </h2>

        {phase === "start" && (
          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-2 text-sm text-robusta-ink">
              <input
                type="checkbox"
                checked={includeInsights}
                onChange={(e) => setIncludeInsights(e.target.checked)}
                data-test="pdf-export-include-insights"
              />
              {t("pdfExport.dialog.option.includeInsights")}
            </label>
            <label className="flex items-center gap-2 text-sm text-robusta-ink">
              <input
                type="checkbox"
                checked={includeSystem}
                onChange={(e) => setIncludeSystem(e.target.checked)}
                data-test="pdf-export-include-system"
              />
              {t("pdfExport.dialog.option.includeSystem")}
            </label>
            {error && (
              <p className="text-xs text-red-600" data-test="pdf-export-error">
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={handleStart}
              data-test="pdf-export-start"
              className="mt-2 rounded bg-robusta-accent px-3 py-2 text-sm text-black hover:bg-robusta-accent/90"
            >
              {t("pdfExport.dialog.start")}
            </button>
          </div>
        )}

        {phase === "progress" && (
          <div
            className="flex flex-col items-center gap-2 py-4 text-sm text-robusta-inkDim"
            data-test="pdf-export-progress"
          >
            <span aria-hidden className="animate-spin text-2xl">
              ⏳
            </span>
            {progress.phase === "loading-font" ? (
              <p>{t("pdfExport.dialog.progress.font")}</p>
            ) : (
              <p>
                {t("pdfExport.dialog.progress.render", {
                  percent: String(progress.percent),
                })}
              </p>
            )}
          </div>
        )}

        {phase === "done" && blob && (
          <div className="flex flex-col items-center gap-3 py-4">
            <button
              type="button"
              onClick={handleDownload}
              data-test="pdf-export-download"
              className="rounded bg-robusta-accent px-4 py-2 text-sm text-black hover:bg-robusta-accent/90"
            >
              {t("pdfExport.dialog.download")}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-robusta-inkDim hover:text-robusta-ink"
            >
              {t("modal.action.cancel")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
