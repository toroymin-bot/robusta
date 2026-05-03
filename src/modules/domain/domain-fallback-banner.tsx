"use client";

/**
 * domain/domain-fallback-banner.tsx
 *   C-D35-4 (D-4 03시 슬롯, 2026-05-04) — Tori spec C-D35-4 (KQ_23).
 *
 * Why: 5/5 18:00 KST 정각 자동 활성화. preview URL(*.vercel.app 등) 안내.
 *   robusta.ai4min.com 정상 연결 시 자동 미노출.
 *
 * 동작:
 *   - SSR 안전 — typeof window === 'undefined' 시 null
 *   - isFallbackActive() false → null
 *   - 호스트네임 === PRIMARY_DOMAIN → null (도메인 정상)
 *   - sessionStorage 'domain_banner_dismissed' 있음 → null (같은 탭 안 재노출 0)
 *   - 그 외 → banner 렌더 (title + body + dismiss CTA)
 *
 * 보존 13: conversation-workspace.tsx 1줄 import + 1줄 조건부 JSX 마운트.
 *   useEffect 0 / conditional render 1 추가 — 한도 4 미만.
 */

import { useState, type ReactElement } from "react";
import Link from "next/link";
import { isFallbackActive, PRIMARY_DOMAIN } from "./domain-fallback-config";
import { t } from "@/modules/i18n/messages";

const DISMISS_KEY = "robusta:domain_banner_dismissed";

function readDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function writeDismissed(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(DISMISS_KEY, "1");
  } catch {
    /* silent */
  }
}

export function DomainFallbackBanner(): ReactElement | null {
  // hooks rules — 조건부 호출 금지. 모든 분기는 hook 호출 후.
  const [dismissed, setDismissed] = useState<boolean>(() => readDismissed());
  // SSR 가드 — window 미참조 분기.
  if (typeof window === "undefined") return null;
  if (!isFallbackActive()) return null;
  if (window.location.hostname === PRIMARY_DOMAIN) return null;
  if (dismissed) return null;

  return (
    <div
      data-test="domain-fallback-banner"
      role="status"
      className="fixed inset-x-0 top-0 z-50 flex items-start gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900 shadow-sm"
    >
      <span className="font-semibold">{t("domain.fallback.title")}</span>
      <span className="flex-1">{t("domain.fallback.body")}</span>
      {/* C-D36-5 (D-4 07시 슬롯, 2026-05-04) — 자세히 CTA 링크 추가.
          target="_self" — 같은 탭, sessionStorage dismiss 보존 의도. */}
      <Link
        href="/about-domain"
        className="rounded border border-amber-400 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-900 hover:bg-amber-100"
      >
        {t("domain.fallback.cta_more")}
      </Link>
      <button
        type="button"
        onClick={() => {
          writeDismissed();
          setDismissed(true);
        }}
        className="rounded border border-amber-400 bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900 hover:bg-amber-200"
      >
        {t("domain.fallback.cta")}
      </button>
    </div>
  );
}

export default DomainFallbackBanner;
