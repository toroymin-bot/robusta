"use client";

/**
 * mcp/mcp-section.tsx
 *   C-D32-3 (D-5 15시 슬롯, 2026-05-03) — Tori spec C-D32-3 (F-D32-3).
 *   Settings 진입 시 disabled 표기 — Spec 005 MCP Phase 2 예정 안내.
 *
 *   Settings 모듈 부재 — Spec 010(설정) 미진입 — 본 컴포넌트는 standalone 으로 작성.
 *   moreItems 페이지 wiring 은 추후 Settings 페이지에서 import.
 *   메인 번들 영향 0 — 본 컴포넌트 자체는 lazy import 대상 (호출자 책임).
 */

import { t } from "@/modules/i18n/messages";

export function MCPSection() {
  return (
    <section
      aria-labelledby="mcp-section-title"
      className="rounded-md border border-robusta-divider p-4 opacity-60"
    >
      <h3
        id="mcp-section-title"
        className="text-sm font-medium text-robusta-ink"
      >
        {t("mcp.section.title")}
      </h3>
      <p className="mt-1 text-xs text-robusta-inkDim">
        {t("mcp.section.placeholder")}
      </p>
      <button
        type="button"
        disabled
        aria-disabled="true"
        className="mt-3 cursor-not-allowed rounded border border-robusta-divider px-3 py-1 text-xs text-robusta-inkDim"
      >
        {t("mcp.section.title")}
      </button>
    </section>
  );
}

export default MCPSection;
