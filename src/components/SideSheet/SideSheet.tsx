/**
 * SideSheet.tsx
 *   - C-D19-1 (D6 07시 슬롯, 2026-05-01) — D-26 / 꼬미 §1 ③ 발견사항 흡수.
 *   - C-D18-1 useResponsiveSheet 훅의 시각화 컴포넌트.
 *   - 책임: backdrop + sheet panel 마크업 + 포커스 트랩 + body scroll lock.
 *
 * 비-책임:
 *   - 폭/breakpoint 계산은 useResponsiveSheet 가 담당 (단일 책임).
 *   - 호출처(예: HeaderCluster) 가 open/onOpenChange 상태 제어.
 *
 * 정책 (똘이 §6 C-D19-1):
 *   - open=false 면 null 반환 (DOM 미렌더, 첫 렌더 비용 0).
 *   - open=true 면 backdrop + sheet panel 렌더 + transform translateX 슬라이드 인.
 *   - backdrop 클릭 → onOpenChange(false).
 *   - ESC 키 → useResponsiveSheet 가 이미 처리 (중복 등록 금지).
 *   - prefers-reduced-motion: reduce → CSS transition 제거 (CSS module 처리).
 *   - body scroll lock: sheet 열릴 때 document.body.style.overflow='hidden', 닫힐 때 복구.
 *   - SSR: open=false 첫 렌더는 null — hydration mismatch 회피.
 */

"use client";

import {
  useEffect,
  useRef,
  type RefObject,
  type ReactNode,
} from "react";
import { useResponsiveSheet } from "@/hooks/useResponsiveSheet";
import styles from "./SideSheet.module.css";

export interface SideSheetProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  /** 'left' (기본) | 'right' — 슬라이드 방향. */
  side?: "left" | "right";
  /** 스크린 리더용 dialog 라벨 (필수). */
  ariaLabel: string;
  /** sheet 첫 마운트 시 포커스를 정의할 요소 ref (선택). */
  initialFocusRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
  /** sheet 폭 비율(0~100) — 기본 60. ≤360px 단말은 useResponsiveSheet 가 80% 강제. */
  widthPct?: number;
  /** 모바일/데스크탑 분기 임계값(px) — 기본 768 (Tailwind md). */
  breakpoint?: number;
}

export function SideSheet(props: SideSheetProps) {
  const {
    open,
    onOpenChange,
    side = "left",
    ariaLabel,
    initialFocusRef,
    children,
    widthPct = 60,
    breakpoint = 768,
  } = props;

  // useResponsiveSheet 의 내부 state 와 본 컴포넌트 prop 을 양방향 동기화.
  // ESC 키 처리 + 폭 계산은 hook 측에서 일임.
  const { setOpen, widthPx } = useResponsiveSheet({
    defaultOpen: open,
    breakpoint,
    widthPct,
  });

  // 외부 prop open ↔ 내부 hook open 동기화.
  useEffect(() => {
    setOpen(open);
  }, [open, setOpen]);

  // body scroll lock — open 시 hidden, 닫힐 때 복구.
  // <html> overflow 는 건드리지 않음 (스크롤바 점프 방지).
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // 첫 마운트 포커스 트랩 시드 — initialFocusRef 우선, 없으면 dialog panel 자체.
  const panelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const el = initialFocusRef?.current ?? panelRef.current;
    el?.focus();
  }, [open, initialFocusRef]);

  // Tab/Shift+Tab 포커스 순환 — sheet 외부로 이탈 방지.
  useEffect(() => {
    if (!open) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (ev.shiftKey && active === first) {
        ev.preventDefault();
        last?.focus();
      } else if (!ev.shiftKey && active === last) {
        ev.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  // 폭 계산 — hook 가 0 반환(SSR 직후) 시 폭 미적용 → 클라이언트 마운트 후 자동 갱신.
  const styleWidth: React.CSSProperties = {
    width: widthPx > 0 ? `${widthPx}px` : undefined,
    maxWidth: "100vw",
  };

  // side 별 transform 시작점 — left: translateX(-100%), right: translateX(100%).
  // 마운트 후 .open 클래스로 translateX(0) 적용.
  const sideClass = side === "left" ? styles.left : styles.right;

  return (
    <div
      className={styles.root}
      data-test="side-sheet-root"
      role="presentation"
    >
      <div
        className={styles.backdrop}
        data-test="side-sheet-backdrop"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        data-test="side-sheet-panel"
        data-side={side}
        tabIndex={-1}
        style={styleWidth}
        className={`${styles.panel} ${sideClass} ${styles.open}`}
      >
        {children}
      </aside>
    </div>
  );
}
