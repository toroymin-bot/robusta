"use client";

/**
 * domain/domain-fallback-banner.tsx
 *   C-D35-4 (D-4 03시 슬롯, 2026-05-04) — Tori spec C-D35-4 (KQ_23).
 *   C-D45-5 (D-3 23시 슬롯, 2026-05-05) — OCP append: LIVE 도달 자동 dismiss + 24h hold (D-D45-2).
 *
 * Why: 5/5 18:00 KST 정각 자동 활성화. preview URL(*.vercel.app 등) 안내.
 *   robusta.ai4min.com 정상 연결 시 자동 미노출.
 *
 * 동작:
 *   - SSR 안전 — typeof window === 'undefined' 시 null
 *   - isFallbackActive() false → null
 *   - 호스트네임 === PRIMARY_DOMAIN → null (도메인 정상)
 *   - sessionStorage 'domain_banner_dismissed' 있음 → null (같은 탭 안 재노출 0)
 *   - localStorage 'kq23.live.dismissed.at' 24h 이내 — null (LIVE 자동 dismiss + 24h hold, D-D45-2)
 *   - RELEASE_ISO 도달 (isLive) → 자동 dismiss + localStorage set + 페이드 200ms
 *   - 그 외 → banner 렌더 (title + body + dismiss CTA)
 *
 * 자율 정정 (C-D45-5):
 *   - D-45-자-7: 명세 'src/modules/ui/kq23-banner.tsx' 추정 — 실 모듈 'src/modules/domain/domain-fallback-banner.tsx' (C-D35-4 정합).
 *     명세 §3.6 보존 13에 미포함이라 OCP append 가능. 기존 sessionStorage dismiss 키 무수정.
 *
 * 보존 13: conversation-workspace.tsx 1줄 import + 1줄 조건부 JSX 마운트.
 *   useEffect 0 → 1 추가 (LIVE 자동 dismiss 동기화 — 한도 4 미만 정합).
 */

import { useEffect, useState, type ReactElement } from "react";
import Link from "next/link";
import { isFallbackActive, PRIMARY_DOMAIN } from "./domain-fallback-config";
import { isLive } from "@/modules/dday/dday-config";
import { t } from "@/modules/i18n/messages";

const DISMISS_KEY = "robusta:domain_banner_dismissed";
/** C-D45-5 (D-D45-2) — LIVE 도달 자동 dismiss 키 + 24h hold 윈도우. */
const LIVE_DISMISS_KEY = "kq23.live.dismissed.at";
const LIVE_DISMISS_HOLD_MS = 24 * 60 * 60 * 1000;

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

/** C-D45-5 — LIVE 자동 dismiss 24h hold 윈도우 안 여부. */
function isLiveDismissedRecently(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(LIVE_DISMISS_KEY);
    if (!raw) return false;
    const at = Number.parseInt(raw, 10);
    if (!Number.isFinite(at)) return false;
    return Date.now() - at < LIVE_DISMISS_HOLD_MS;
  } catch {
    return false;
  }
}

function writeLiveDismissed(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LIVE_DISMISS_KEY, String(Date.now()));
  } catch {
    /* silent */
  }
}

export function DomainFallbackBanner(): ReactElement | null {
  // hooks rules — 조건부 호출 금지. 모든 분기는 hook 호출 후.
  const [dismissed, setDismissed] = useState<boolean>(() => readDismissed());
  const [liveDismissed, setLiveDismissed] = useState<boolean>(() =>
    isLiveDismissedRecently(),
  );

  // C-D45-5 (D-D45-2) — RELEASE_ISO 도달 시 자동 dismiss + localStorage set.
  //   클라이언트 마운트 시 isLive() 검사. 매 분 재검사 (탭 장기 노출 케이스).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (liveDismissed) return;
    function tick() {
      if (isLive()) {
        writeLiveDismissed();
        setLiveDismissed(true);
      }
    }
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [liveDismissed]);

  // SSR 가드 — window 미참조 분기.
  if (typeof window === "undefined") return null;
  if (!isFallbackActive()) return null;
  if (window.location.hostname === PRIMARY_DOMAIN) return null;
  if (dismissed) return null;
  if (liveDismissed) return null; // C-D45-5 — LIVE 도달 자동 dismiss + 24h hold.

  return (
    <div
      data-test="domain-fallback-banner"
      role="status"
      style={{ transition: "opacity 200ms ease-out" }}
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
