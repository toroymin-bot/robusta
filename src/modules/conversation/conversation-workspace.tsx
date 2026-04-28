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
// D-12.3 (Day 6): 부트 시 1회 등록. 이미 등록되어 있으면 noop.
import { registerOnlineListener } from "@/modules/ui/online-listener";
// D-15.2 (Day 9, 2026-04-28) C-D9-2: 헤더 발언 모드 라벨 i18n.
import { t } from "@/modules/i18n/messages";
import type { TurnMode } from "@/modules/conversation/turn-controller";

// D-15.2 (Day 9) turnMode → i18n 키 매핑. enum 3종 1:1.
//   manual → "Manual" / round-robin → "Round-robin" / trigger → "Scheduled"
const TURN_MODE_LABEL_KEY = {
  manual: "header.mode.manual",
  "round-robin": "header.mode.roundRobin",
  trigger: "header.mode.trigger",
} as const satisfies Record<TurnMode, string>;

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
            {/* D-15.2 (Day 9, 2026-04-28) C-D9-2: 발언 모드는 동적 (turnMode subscribe). Day 라벨은 정적(빌드 시점). */}
            <span
              className="text-xs uppercase tracking-widest text-robusta-inkDim"
              data-test="header-mode-label"
            >
              Day 3 · {t(TURN_MODE_LABEL_KEY[turnMode])}
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

        <ConversationView onRequestApiKeyModal={() => setKeysOpen(true)} />
      </main>

      {keysOpen && <ApiKeysView onClose={() => setKeysOpen(false)} />}
      <ToastViewport />
    </div>
  );
}
