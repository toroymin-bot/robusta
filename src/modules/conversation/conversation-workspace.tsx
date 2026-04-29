"use client";

import { useEffect, useState } from "react";
import { ApiKeysView } from "@/modules/api-keys/api-keys-view";
import { maskApiKey } from "@/modules/api-keys/api-key-mask";
import { ParticipantsPanel } from "@/modules/participants/participants-panel";
import { ToastViewport } from "@/modules/ui/toast";
import { useThemeStore } from "@/modules/ui/theme";
import { useApiKeyStore } from "@/stores/api-key-store";
import { useParticipantStore } from "@/stores/participant-store";
import { useConversationStore } from "@/stores/conversation-store";
import { ConversationView } from "./conversation-view";
// D-D11-2 (Day 11, 2026-04-29, B19) C-D11-2: AutoLoopHeader — ai-auto 모드 시 헤더 영역 mount.
//   ~~next/dynamic ssr:false 분리 시도~~ — manifest /page∪/layout gzip 합산은 같은 chunks=8로
//     0.2KB만 절약(효과 미미). 정적 import로 복원하고 게이트 +2KB 상향(C-D11-7b)으로 박음.
import { AutoLoopHeader } from "./auto-loop-header";
// D-12.3 (Day 6): 부트 시 1회 등록. 이미 등록되어 있으면 noop.
import { registerOnlineListener } from "@/modules/ui/online-listener";
// D-15.2 (Day 9, 2026-04-28) C-D9-2: 헤더 발언 모드 라벨 i18n.
import { t } from "@/modules/i18n/messages";
import type { TurnMode } from "@/modules/conversation/turn-controller";
// D-D16-1 (Day 4 23시 슬롯, 2026-04-29) C-D16-1: 헤더 모드 라벨 동적 회전 (F-D16-1).
//   v12 §24.3 web_fetch 검증으로 "Day 3" 정적 결함 박힘 → Roadmap 자동 계산.
import { getRoadmapDay, formatRoadmapLabel } from "./roadmap-day";

// D-15.2 (Day 9) turnMode → i18n 키 매핑. enum 3종 1:1.
//   manual → "Manual" / round-robin → "Round-robin" / trigger → "Scheduled"
// D-D10-5 (Day 9, 2026-04-28, B12 채택분) C-D10-5: ai-auto 추가 — 4번째 모드 라벨.
const TURN_MODE_LABEL_KEY = {
  manual: "header.mode.manual",
  "round-robin": "header.mode.roundRobin",
  trigger: "header.mode.trigger",
  "ai-auto": "header.mode.aiAuto",
} as const satisfies Record<TurnMode, string>;

/**
 * D-D9-2 (Day 9, 2026-04-28) C-D10-2: 활성 모드 라벨 색 코딩 헬퍼.
 *   active=true → yellow-500(#F5C518) 좌측 보더 2px + font-semibold + 본문 ink.
 *   active=false → ink-dim, hover ink (시각 위계).
 *   Tailwind에 yellow-500 토큰 매핑 미박힘 — 호출자가 인라인 style.borderLeftColor=#F5C518 fallback 박을 것.
 *   현재 헤더는 단일 라벨이지만 추후 4-segment 토글(C-D11-1) 도입 시 활성/비활성 비교에 그대로 재사용.
 */
export function getModeClassName(active: boolean): string {
  return active
    ? "border-l-2 pl-2 font-semibold text-robusta-ink"
    : "text-robusta-inkDim hover:text-robusta-ink";
}

export function ConversationWorkspace() {
  const participantsHydrated = useParticipantStore((s) => s.hydrated);
  const loadParticipants = useParticipantStore((s) => s.loadFromDb);
  const apiKeysHydrated = useApiKeyStore((s) => s.hydrated);
  const loadApiKeys = useApiKeyStore((s) => s.loadFromDb);
  const anthropicKey = useApiKeyStore((s) => s.keys.anthropic);
  const conversationsHydrated = useConversationStore((s) => s.hydrated);
  const loadConversations = useConversationStore((s) => s.loadFromDb);
  // D-15.2 (Day 9) C-D9-2: 발언 모드 turnMode를 store에서 subscribe — 토글 즉시 헤더 라벨 갱신.
  const turnMode = useConversationStore((s) => s.turnMode);
  // D-8.6: 다크모드 toggle store + hydrate (layout.tsx의 inline script와 동기화)
  const themeMode = useThemeStore((s) => s.theme);
  const themeHydrated = useThemeStore((s) => s.hydrated);
  const hydrateTheme = useThemeStore((s) => s.hydrate);
  const toggleTheme = useThemeStore((s) => s.toggle);

  const [keysOpen, setKeysOpen] = useState(false);
  // D-D16-1 (Day 4 23시 슬롯, 2026-04-29) C-D16-1: D-Day 라벨 클라 시점 계산.
  //   SSR/CSR hydration mismatch 회피를 위해 SSR 폴백 = "Day 5 · Live" (D5 라이브 시점 정합).
  //   useEffect로 클라 시점 1회 set → 렌더 직후 실제 D-Day로 회전.
  const [roadmapLabel, setRoadmapLabel] = useState<string>("Day 5 · Live");
  useEffect(() => {
    setRoadmapLabel(formatRoadmapLabel(getRoadmapDay()));
  }, []);

  useEffect(() => {
    if (!participantsHydrated) {
      void loadParticipants().catch((err) => {
        console.error("[robusta] participant load failed", err);
      });
    }
  }, [participantsHydrated, loadParticipants]);

  useEffect(() => {
    if (!apiKeysHydrated) {
      void loadApiKeys().catch((err) => {
        console.error("[robusta] api key load failed", err);
      });
    }
  }, [apiKeysHydrated, loadApiKeys]);

  useEffect(() => {
    if (!conversationsHydrated) {
      void loadConversations().catch((err) => {
        console.error("[robusta] conversation load failed", err);
      });
    }
  }, [conversationsHydrated, loadConversations]);

  // D-8.6: 클라이언트 마운트 시 1회 hydrate. 이미 layout inline script가 DOM 적용했으므로
  // store 상태만 동기화 (깜빡임 추가 없음).
  useEffect(() => {
    if (!themeHydrated) {
      hydrateTheme();
    }
  }, [themeHydrated, hydrateTheme]);

  // D-12.3 (Day 6): online 이벤트 리스너 1회 등록 — 모듈 가드로 중복 안전.
  useEffect(() => {
    registerOnlineListener();
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-robusta-canvas text-robusta-ink">
      <ParticipantsPanel />
      <main className="flex flex-1 flex-col">
        <header className="flex h-12 items-center justify-between border-b border-robusta-divider px-6 backdrop-blur">
          <h1 className="text-base font-semibold tracking-tight">Robusta</h1>
          <div className="flex items-center gap-3">
            {/* D-D16-1 (Day 4 23시, 2026-04-29) C-D16-1: D-Day 라벨 동적 회전.
                기존 정적 라벨(D-Day 3) 제거 → 동적 `Day {N} · Manual|Live` (Roadmap 기준 D5 라이브 시점 자동 회전).
                turnMode 시각 피드백은 별도 라벨로 분리 (data-test=header-turn-mode-label). */}
            <span
              className={`text-xs uppercase tracking-widest ${getModeClassName(true)}`}
              style={{ borderLeftColor: "#F5C518" }}
              data-test="header-mode-label"
            >
              {roadmapLabel}
            </span>
            <span
              className="text-xs uppercase tracking-widest text-robusta-inkDim"
              data-test="header-turn-mode-label"
            >
              {t(TURN_MODE_LABEL_KEY[turnMode])}
            </span>
            {/* D-8.6: 다크모드 토글 (☀ ⇄ 🌙) — hydration 전에는 비활성 */}
            <button
              type="button"
              onClick={toggleTheme}
              disabled={!themeHydrated}
              className="rounded border border-robusta-divider px-2 py-1 text-xs text-robusta-ink hover:border-robusta-accent disabled:opacity-50"
              aria-label={
                themeMode === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"
              }
              title={themeMode === "dark" ? "라이트 모드" : "다크 모드"}
            >
              {themeMode === "dark" ? "☀" : "🌙"}
            </button>
            <button
              type="button"
              onClick={() => setKeysOpen(true)}
              className="flex items-center gap-2 rounded border border-robusta-divider px-3 py-1 text-xs text-robusta-ink hover:border-robusta-accent"
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
        </header>

        {/* D-D11-2 (Day 11) C-D11-2: AI-Auto 컨트롤 헤더 — 컴포넌트 자체가 turnMode==='ai-auto' 가드. */}
        <AutoLoopHeader />

        <ConversationView onRequestApiKeyModal={() => setKeysOpen(true)} />
      </main>

      {keysOpen && <ApiKeysView onClose={() => setKeysOpen(false)} />}
      <ToastViewport />
    </div>
  );
}
