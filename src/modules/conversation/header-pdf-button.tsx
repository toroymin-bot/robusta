/**
 * header-pdf-button.tsx
 *   - C-D27-5 (D6 15시 슬롯, 2026-05-02) — Tori spec C-D27-5 (B-70/F-70/D-70).
 *
 * Why: 헤더 우측 📄 버튼 → pdf-export-dialog dynamic 마운트.
 *   pdf-export-dialog 자체가 lazy chunk — 메인 번들 +0.
 *
 * 마운트 위치: header-cluster 우측 도구 그룹.
 * a11y: aria-label "PDF로 저장" + Esc 닫기 (다이얼로그 자체에서 처리).
 *
 * OCP: 신규 컴포넌트. dialog import 는 본 파일이 dynamic — header-cluster 정적 import 영향 0.
 */

"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
// catalog-i18n 의존 — 본 컴포넌트 자체가 헤더에 정적 import 되면 catalog 가 메인 번들에 들어감.
//   따라서 본 파일은 헤더 (header-cluster) 에서 dynamic import 되어야 한다.
//   header-cluster 가 본 파일을 next/dynamic 으로 lazy import → catalog 함께 lazy chunk.
import { tc } from "@/modules/i18n/catalog-i18n";

const PdfExportDialog = dynamic(
  () =>
    import("@/modules/export/pdf-export-dialog").then(
      (m) => m.PdfExportDialog,
    ),
  { ssr: false, loading: () => null },
);

export interface HeaderPdfButtonProps {
  /** 내보낼 룸 id. */
  roomId: string;
  /** compact = 모바일 풀스크린 / SideSheet 슬롯에서 큰 터치 타깃. */
  compact?: boolean;
}

export function HeaderPdfButton({ roomId, compact }: HeaderPdfButtonProps) {
  const [open, setOpen] = useState(false);
  const label = tc("pdfExport.menu.label");
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex items-center gap-1 rounded border border-robusta-divider px-2 py-1 text-xs text-robusta-ink hover:border-robusta-accent focus:outline-none focus:ring-2 focus:ring-robusta-accent focus:ring-offset-2 ${compact ? "min-h-[44px]" : ""}`}
        data-test="header-pdf-button"
        aria-label={label}
        title={label}
      >
        <span aria-hidden>📄</span>
        <span className="sr-only md:not-sr-only md:inline">PDF</span>
      </button>
      {open && (
        <PdfExportDialog roomId={roomId} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
