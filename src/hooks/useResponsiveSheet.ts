/**
 * useResponsiveSheet.ts
 *   - C-D18-1 (D6 03시 슬롯, 2026-05-01) — 똘이 v1 §5 명세 채택분 (D-21).
 *
 * 책임 (Single Responsibility):
 *   - 모바일 사이드 시트의 open/close 상태 + 반응형 폭(px) 계산만 담당.
 *   - DOM 마크업·backdrop·portal 은 호출자(SideSheet 컴포넌트)가 담당 — hook 은 상태/계산만.
 *
 * 정책 (똘이 §5 C-D18-1 + KQ_13 디자인 토큰 일관성):
 *   - breakpoint(기본 768px) 미만에서만 isMobile=true.
 *   - 시트 폭 = window.innerWidth × widthPct/100.
 *   - 폭 ≤ 360px 단말 → widthPct 강제 80% (좁은 폰에서 60%는 작음).
 *   - SSR 안전: window 미존재 시 widthPx=0, isMobile=false.
 *   - resize 이벤트 listener — 폭 변동 시 재렌더 (회전 대응).
 *   - ESC 키 → setOpen(false). open=true 일 때만 listener 등록.
 *
 * 사용처(권장):
 *   - 모바일 햄버거 → 사이드 시트 마이그레이션 (현재는 풀스크린 오버레이 — D-21 후속 슬롯에서 교체).
 *   - 참여자 패널, 설정 패널 등 폭 60%/80% sheet 일반화.
 *
 * 비-책임 (안 함):
 *   - 포커스 트랩 / aria-modal — 컴포넌트 측에서 (header-cluster 패턴 참조).
 *   - 스와이프 닫기 제스처 — 별도 hook 권장 (C-D18-* 후속).
 */

"use client";

import { useCallback, useEffect, useState } from "react";

export interface UseResponsiveSheetOptions {
  /** 마운트 시 열림 상태 — 기본 false. */
  defaultOpen?: boolean;
  /** 모바일/데스크탑 분기 임계값(px) — 기본 768 (Tailwind md). */
  breakpoint?: number;
  /** 시트 폭 비율(0~100) — 기본 60. 폭 ≤360px 단말에서는 80 강제. */
  widthPct?: number;
}

export interface UseResponsiveSheetReturn {
  open: boolean;
  setOpen: (v: boolean) => void;
  /** 계산된 시트 폭(px) — SSR/구형 환경 0. */
  widthPx: number;
  /** 현재 viewport 가 모바일(< breakpoint) 인지. */
  isMobile: boolean;
}

const NARROW_PHONE_THRESHOLD = 360;
const NARROW_PHONE_WIDTH_PCT = 80;

function getViewportWidth(): number {
  if (typeof window === "undefined") return 0;
  return window.innerWidth;
}

/**
 * 반응형 사이드 시트 상태/폭 계산 hook.
 * (입력) defaultOpen / breakpoint / widthPct
 * (출력) { open, setOpen, widthPx, isMobile }
 */
export function useResponsiveSheet(
  opts: UseResponsiveSheetOptions = {},
): UseResponsiveSheetReturn {
  const { defaultOpen = false, breakpoint = 768, widthPct = 60 } = opts;

  const [open, setOpenState] = useState<boolean>(defaultOpen);
  // SSR 일관성을 위해 0으로 시작하고, 마운트 후 클라이언트 폭으로 교체.
  const [vw, setVw] = useState<number>(0);

  useEffect(() => {
    const update = () => setVw(getViewportWidth());
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // ESC 키 → close. open=true 일 때만 listener 등록.
  useEffect(() => {
    if (!open) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setOpenState(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // setOpen 안정화 — 외부 dependency array 안전.
  const setOpen = useCallback((v: boolean) => setOpenState(v), []);

  const isMobile = vw > 0 && vw < breakpoint;

  // 폭 계산 — 좁은 폰(≤360px)에서는 widthPct 무시하고 80% 강제.
  const effectivePct =
    vw > 0 && vw <= NARROW_PHONE_THRESHOLD ? NARROW_PHONE_WIDTH_PCT : widthPct;
  const widthPx = vw > 0 ? Math.round((vw * effectivePct) / 100) : 0;

  return { open, setOpen, widthPx, isMobile };
}

export const __responsive_sheet_internal = {
  NARROW_PHONE_THRESHOLD,
  NARROW_PHONE_WIDTH_PCT,
};
