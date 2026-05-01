/**
 * header-cluster-store.ts
 *   - C-D20-3 (D6 11시 슬롯, 2026-05-01) — handleEmptyIntent → SideSheet open 진화 결합 store.
 *   - HeaderCluster 의 모바일 메뉴(SideSheet/풀스크린 오버레이) open/close 상태를 외부에서 트리거 가능하게 lift.
 *
 * 단일 책임:
 *   - 모바일 메뉴 open 상태만 보관. 활성 탭 등 추가 상태는 차후 슬롯에서 확장.
 *
 * 정책 (C-D20-3):
 *   - openMenu/closeMenu/setOpen API 노출.
 *   - HeaderCluster 가 store 를 subscribe 하여 자체 useState 와 동기화.
 *   - 외부(예: conversation-view 의 handleEmptyIntent) 에서 openMenu() 호출 가능.
 *   - SSR 안전 — Zustand 의 클라이언트 only API.
 *
 * 단순성 (잡스):
 *   - active tab/포커스 ref 등 추가 메타는 명세 §6 C-D20-3 의 컨텍스트 분리 권장보다 더 단순한
 *     글로벌 store 채택 — 호출처에서 openMenu() + (이후) 직접 포커스 제어.
 *     컨텍스트 lift state 패턴은 active tab 분기가 필요할 때 후속 슬롯에서 확장.
 */

import { create } from "zustand";

interface HeaderClusterState {
  menuOpen: boolean;
  setMenuOpen: (next: boolean) => void;
  openMenu: () => void;
  closeMenu: () => void;
}

export const useHeaderClusterStore = create<HeaderClusterState>((set) => ({
  menuOpen: false,
  setMenuOpen: (next: boolean) => set({ menuOpen: next }),
  openMenu: () => set({ menuOpen: true }),
  closeMenu: () => set({ menuOpen: false }),
}));
