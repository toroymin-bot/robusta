/**
 * header-cluster.tsx
 *   - C-D17-13 (Day 5 15시 슬롯, 2026-04-30) — F-12 + D-12.
 *     · 데스크탑 ≥ 768px (Tailwind md:): 헤더 4도구 인라인 (mode 라벨, turn-mode 라벨, 다크 토글, ⚙ Keys).
 *     · 모바일 < 768px: 햄버거 버튼만 노출 → 클릭 시 풀스크린 오버레이 안에 4도구 모두 등록.
 *   - 접근성: role="dialog" + aria-modal="true" + aria-expanded + aria-controls + Esc 닫기 + backdrop 클릭 닫기.
 *   - body scroll lock: 오버레이 오픈 시 document.body.style.overflow="hidden", 닫힘 시 복구.
 *   - 데스크탑 회전(viewport ≥ 768px) 시 자동 닫기 — matchMedia listener.
 *   - iOS Safari 100vh ≠ 실 viewport 회피: min-h-[100svh] 적용.
 *   - OCP: 기존 헤더의 4도구 마크업/className은 그대로 유지(데스크탑 슬롯 + 모바일 슬롯 양쪽에 동일 레이아웃).
 *
 *   - C-D20-1 (D6 11시 슬롯, 2026-05-01) — 꼬미 §3 권장 ① 흡수.
 *     · feature flag NEXT_PUBLIC_ROBUSTA_SIDE_SHEET 분기 — flag ON 시 풀스크린 오버레이 → SideSheet 좌측 60% 슬라이드 인.
 *     · flag OFF (기본) → 기존 풀스크린 오버레이 유지 (회귀 0). dual-track 검증.
 *     · 30분 검증 후 다음 슬롯에서 풀스크린 OCP 정합 후 제거 명세 별도 등록.
 *   - C-D20-3 (D6 11시 슬롯, 2026-05-01) — useHeaderClusterStore 동기화. 외부(EmptyIntent) 에서 openMenu 호출 가능.
 *
 * Roy id-19 (Do v30 2026-04-30) 직접 대응:
 *   "모바일에서 메뉴버튼을 클릭하면 메인 화면을 가리는 현상등을 없애기"
 *   → 풀스크린 오버레이는 메인 화면 위에 표시되지만 body scroll lock + Esc/backdrop 닫기 + 명확한 X 버튼으로
 *      사용자가 언제든 즉시 닫을 수 있어 가림이 마찰이 되지 X.
 *   → C-D20-1 SideSheet flag ON 시 좌측 60% 만 차지 → 메인 콘텐츠 40% 가시성 유지로 가림 완전 해결.
 */

"use client";

import { useEffect, useId, useRef } from "react";
import { maskApiKey } from "@/modules/api-keys/api-key-mask";
// C-D17-17 (Day 5 15시) F-16 토큰 카운터 뱃지 — 헤더에 등록. 누적 0건이면 자체적으로 마운트 X.
import { TokenCounterBadge } from "./token-counter-badge";
// C-D20-1 (D6 11시) — SideSheet flag dual-track. flag ON 시 마운트.
import { SideSheet } from "@/components/SideSheet/SideSheet";
// C-D20-3 (D6 11시) — 글로벌 메뉴 open 상태. 외부(EmptyIntent) 에서 openMenu 호출 가능.
import { useHeaderClusterStore } from "@/stores/header-cluster-store";
// C-D22-1 (D6 19시) — F-24 Export 메뉴 (SideSheet 내부 "도구" 섹션). KQ_15 자율 결정.
import { ExportMenu } from "./export-menu";

// C-D20-1: feature flag — env 미설정 또는 'on' 외 값이면 OFF (기본 풀스크린 오버레이 유지, 회귀 0).
//   빌드 타임 상수 — hydration mismatch 회피.
const SIDE_SHEET_FLAG_ON =
  typeof process !== "undefined" &&
  process.env.NEXT_PUBLIC_ROBUSTA_SIDE_SHEET === "on";

interface HeaderClusterProps {
  /** Day N · Live|Manual 라벨. */
  roadmapLabel: string;
  /** 라벨 좌측 보더 색 (Day 티어 도출). */
  roadmapColor: string;
  /** turnMode 라벨 (i18n 적용된 문자열). */
  turnModeLabel: string;
  /** 다크 토글 hydration 완료 여부 — false면 disabled 유지 (FOUC 방지). */
  themeHydrated: boolean;
  /** 현재 적용 테마 ("light"|"dark"). */
  themeMode: "light" | "dark";
  /** 다크 토글 onClick (legacy 2-state). C-D17-15 이후 themeChoice 가 있으면 3-segment 사용. */
  onToggleTheme: () => void;
  /**
   * C-D17-15 (D6 03시 슬롯, 2026-05-01) — KQ_14 채택분.
   * 사용자 선택 3-state ("system"/"light"/"dark"). 미전달 시 legacy 2-state 토글 fallback.
   */
  themeChoice?: "system" | "light" | "dark";
  /** C-D17-15: 3-segment 클릭 핸들러 (themeChoice 와 짝). */
  onSetThemeChoice?: (choice: "system" | "light" | "dark") => void;
  /** ⚙ Keys 버튼 onClick. */
  onOpenApiKeyModal: () => void;
  /** Anthropic 키 (헤더 마스크 표시용). 빈 문자열이면 키 미등록. */
  anthropicKey: string;
  /** C-D17-16 (Day 5 23시) F-15: ⏰ 스케줄 모달 열기 onClick. */
  onOpenScheduleModal: () => void;
}

// C-D17-19 (Day 5 19시 슬롯, 2026-04-30) F-17: TokenCounterBadge placeholder 클릭 시 호출되는 핸들러를
//   ⚙ Keys 모달 open과 동일하게 정의. onOpenApiKeyModal을 그대로 token badge에 전달.

/** 데스크탑/모바일 양쪽에서 재사용되는 4도구 그룹.
 *  flexbox 컨테이너 + gap만 명시해 슬롯별로 다른 정렬을 허용. */
function HeaderTools(props: HeaderClusterProps & { compact?: boolean }) {
  const {
    roadmapLabel,
    roadmapColor,
    turnModeLabel,
    themeHydrated,
    themeMode,
    onToggleTheme,
    themeChoice,
    onSetThemeChoice,
    onOpenApiKeyModal,
    onOpenScheduleModal,
    anthropicKey,
    compact,
  } = props;
  // C-D17-15 KQ_14: 3-state segment 모드 활성 — themeChoice/onSetThemeChoice 양쪽 모두 전달된 경우만.
  const useSegment = themeChoice !== undefined && onSetThemeChoice !== undefined;

  // 모바일 오버레이에서는 세로 정렬 + 큰 tap target. 데스크탑은 가로 인라인.
  const containerClass = compact
    ? "flex flex-col gap-3 p-4"
    : "flex items-center gap-3";

  return (
    <div className={containerClass}>
      {/* C-D17-17 (Day 5 15시) F-16: 토큰/비용 누적 뱃지.
          C-D17-19 (Day 5 19시) F-17: 누적 0건 시 placeholder 등록 — 클릭 시 ⚙ Keys 모달 open. */}
      <TokenCounterBadge onRequestApiKeyModal={onOpenApiKeyModal} />
      <span
        className="whitespace-nowrap border-l-2 pl-2 text-xs font-semibold uppercase tracking-widest text-robusta-ink"
        style={{ borderLeftColor: roadmapColor }}
        data-test="header-mode-label"
      >
        {roadmapLabel}
      </span>
      <span
        className="whitespace-nowrap text-xs uppercase tracking-widest text-robusta-inkDim"
        data-test="header-turn-mode-label"
      >
        {turnModeLabel}
      </span>
      {useSegment ? (
        // C-D17-15 KQ_14: 3-segment 그룹 (☀ Light / ☾ Dark / ⌬ System).
        // ARIA: role="group" + aria-label + 각 버튼 aria-pressed.
        // 모바일 compact 모드에서도 nowrap + 44px 터치 타깃 보장.
        <div
          role="group"
          aria-label="테마 선택"
          className={`flex items-center rounded border border-robusta-divider ${compact ? "" : "h-7"}`}
          data-test="theme-segment-group"
        >
          {(
            [
              { v: "light", label: "라이트 모드", icon: "☀" },
              { v: "dark", label: "다크 모드", icon: "☾" },
              { v: "system", label: "시스템 자동", icon: "⌬" },
            ] as const
          ).map((seg, idx) => {
            const active = themeChoice === seg.v;
            const radiusClass =
              idx === 0
                ? "rounded-l"
                : idx === 2
                  ? "rounded-r"
                  : "border-l border-robusta-divider";
            return (
              <button
                key={seg.v}
                type="button"
                onClick={() => onSetThemeChoice?.(seg.v)}
                disabled={!themeHydrated}
                aria-pressed={active}
                aria-label={seg.label}
                title={seg.label}
                data-test={`theme-segment-${seg.v}`}
                className={`whitespace-nowrap px-2 py-1 text-xs ${radiusClass} ${active ? "bg-robusta-accent text-robusta-ink" : "text-robusta-ink hover:bg-robusta-accentSoft"} focus:outline-none focus:ring-2 focus:ring-robusta-accent focus:ring-offset-2 disabled:opacity-50 ${compact ? "min-h-[44px] min-w-[44px]" : ""}`}
              >
                {seg.icon}
              </button>
            );
          })}
        </div>
      ) : (
        <button
          type="button"
          onClick={onToggleTheme}
          disabled={!themeHydrated}
          // C-D17-22 (Day 5 19시) D-20: WCAG 2.4.7 Focus Visible — Tab 키보드 사용자 시각 피드백 등록.
          //   기존 hover:border-robusta-accent만 정의되어 있던 것에 focus ring 추가.
          className={`rounded border border-robusta-divider px-2 py-1 text-xs text-robusta-ink hover:border-robusta-accent focus:outline-none focus:ring-2 focus:ring-robusta-accent focus:ring-offset-2 disabled:opacity-50 ${compact ? "min-h-[44px]" : ""}`}
          data-test="theme-toggle-button"
          aria-label={
            !themeHydrated
              ? "테마 토글 로딩 중"
              : themeMode === "dark"
                ? "라이트 모드로 전환"
                : "다크 모드로 전환"
          }
          title={themeMode === "dark" ? "라이트 모드" : "다크 모드"}
        >
          {themeMode === "dark" ? "☀" : "🌙"}
        </button>
      )}
      {/* C-D17-16 (Day 5 23시) F-15: ⏰ 자동 발언 스케줄 진입 — 모달 열기. 트리거는 D11+에서 정의. */}
      <button
        type="button"
        onClick={onOpenScheduleModal}
        className={`flex items-center gap-1 rounded border border-robusta-divider px-2 py-1 text-xs text-robusta-ink hover:border-robusta-accent focus:outline-none focus:ring-2 focus:ring-robusta-accent focus:ring-offset-2 ${compact ? "min-h-[44px]" : ""}`}
        data-test="schedule-button"
        aria-label="자동 발언 스케줄 열기"
        title="자동 발언 스케줄"
      >
        <span aria-hidden>⏰</span>
        <span className="sr-only md:not-sr-only md:inline">스케줄</span>
      </button>
      <button
        type="button"
        onClick={onOpenApiKeyModal}
        className={`flex items-center gap-2 rounded border border-robusta-divider px-3 py-1 text-xs text-robusta-ink hover:border-robusta-accent ${compact ? "min-h-[44px] justify-between" : ""}`}
        aria-label="API 키 관리"
      >
        {anthropicKey ? (
          <>
            <span className="font-mono">⚙ Keys · {maskApiKey(anthropicKey)}</span>
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </>
        ) : (
          <span>⚙ Keys</span>
        )}
      </button>
    </div>
  );
}

export function HeaderCluster(props: HeaderClusterProps) {
  // C-D20-3: open 상태를 글로벌 store 로 lift. 외부(EmptyIntent) 에서 openMenu 호출 가능.
  const open = useHeaderClusterStore((s) => s.menuOpen);
  const setOpen = useHeaderClusterStore((s) => s.setMenuOpen);
  const overlayId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  // viewport ≥ 768px (Tailwind md:) 진입 시 자동 닫기 — orientation/resize 회귀 가드.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia("(min-width: 768px)");
    const handler = (ev: MediaQueryListEvent) => {
      if (ev.matches) setOpen(false);
    };
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", handler);
      return () => mql.removeEventListener("change", handler);
    }
    return undefined;
  }, [setOpen]);

  // body scroll lock + Esc keydown listener — open 상태에서만.
  // C-D20-1: SideSheet flag ON 시 SideSheet 자체가 body lock + Esc 처리 → 본 effect skip.
  useEffect(() => {
    if (SIDE_SHEET_FLAG_ON) return;
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    // 오버레이 진입 시 첫 포커스를 닫기 버튼에 (포커스 트랩 시드).
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen]);

  return (
    <>
      {/* 데스크탑 ≥ md: 인라인 4도구 (기존 동작 보존). */}
      <div className="hidden md:flex" data-test="desktop-cluster">
        <HeaderTools {...props} />
      </div>

      {/* 모바일 < md: 햄버거 트리거 버튼만 노출. */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="메뉴 열기"
        aria-expanded={open}
        aria-controls={overlayId}
        data-test="mobile-menu-trigger"
        className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded border border-robusta-divider px-2 py-1 text-base text-robusta-ink hover:border-robusta-accent md:hidden"
      >
        {/* 햄버거 글리프 (3줄) — 폰트/이모지 의존 X, 순수 SVG. */}
        <svg
          aria-hidden="true"
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M3 5h14M3 10h14M3 15h14" />
        </svg>
      </button>

      {/* C-D20-1: SideSheet flag ON 시 — SideSheet 좌측 60% 슬라이드 인. 메인 콘텐츠 40% 가시성 유지. */}
      {SIDE_SHEET_FLAG_ON ? (
        <SideSheet
          open={open}
          onOpenChange={setOpen}
          side="left"
          ariaLabel="메뉴"
          widthPct={60}
          breakpoint={768}
        >
          <div
            data-test="side-sheet-mobile-menu"
            className="flex h-full min-h-[100svh] flex-col bg-robusta-canvas md:hidden"
          >
            <div className="flex items-center justify-between border-b border-robusta-divider px-4 py-3">
              <span className="text-sm font-semibold text-robusta-ink">
                메뉴
              </span>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="메뉴 닫기"
                data-test="side-sheet-mobile-close"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded border border-robusta-divider text-robusta-ink hover:border-robusta-accent"
              >
                <svg
                  aria-hidden="true"
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M5 5l10 10M15 5L5 15" />
                </svg>
              </button>
            </div>
            <HeaderTools {...props} compact />
            {/* C-D22-1 (D6 19시) — Export 메뉴를 SideSheet 하단 "도구" 섹션에 등록.
                KQ_15 자율 결정: 헤더 4도구 + 토큰 카운터로 포화 → 사이드 시트 진입.
                풀스크린 오버레이(deprecated) 분기에는 미연결 — flag ON dual-track 만 노출. */}
            <ExportMenu />
          </div>
        </SideSheet>
      ) : (
        // 풀스크린 오버레이 — flag OFF 기본 동작 (기존 동작 보존, 회귀 0).
        // ~~deprecated 2026-05-01 — see C-D20-1, kept for dual-track verification, removed in next slot~~
        open && (
          <div
            id={overlayId}
            role="dialog"
            aria-modal="true"
            aria-label="메뉴"
            data-test="mobile-menu-overlay"
            className="fixed inset-0 z-50 flex min-h-[100svh] flex-col bg-robusta-canvas md:hidden"
          >
            <div className="flex items-center justify-between border-b border-robusta-divider px-4 py-3">
              <span className="text-sm font-semibold text-robusta-ink">
                메뉴
              </span>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="메뉴 닫기"
                data-test="mobile-menu-close"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded border border-robusta-divider text-robusta-ink hover:border-robusta-accent"
              >
                <svg
                  aria-hidden="true"
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M5 5l10 10M15 5L5 15" />
                </svg>
              </button>
            </div>
            <HeaderTools {...props} compact />
            <button
              type="button"
              aria-hidden="true"
              tabIndex={-1}
              onClick={() => setOpen(false)}
              data-test="mobile-menu-backdrop"
              className="flex-1 cursor-default"
            />
          </div>
        )
      )}
    </>
  );
}
