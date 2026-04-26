"use client";

import { useEffect, useState } from "react";
import { ApiKeysView } from "@/modules/api-keys/api-keys-view";
import { maskApiKey } from "@/modules/api-keys/api-key-mask";
import { ParticipantsPanel } from "@/modules/participants/participants-panel";
import { useApiKeyStore } from "@/stores/api-key-store";
import { useParticipantStore } from "@/stores/participant-store";

export function ConversationWorkspace() {
  const participantsHydrated = useParticipantStore((s) => s.hydrated);
  const loadParticipants = useParticipantStore((s) => s.loadFromDb);
  const apiKeysHydrated = useApiKeyStore((s) => s.hydrated);
  const loadApiKeys = useApiKeyStore((s) => s.loadFromDb);
  const anthropicKey = useApiKeyStore((s) => s.keys.anthropic);

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

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-robusta-canvas text-robusta-ink">
      <ParticipantsPanel />
      <main className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-robusta-divider px-6 py-3">
          <h1 className="text-base font-semibold tracking-tight">Robusta</h1>
          <div className="flex items-center gap-3">
            <span className="text-xs uppercase tracking-widest text-robusta-inkDim">
              Day 2 · 3-way Conversation
            </span>
            <button
              type="button"
              onClick={() => setKeysOpen(true)}
              className="rounded border border-robusta-divider px-3 py-1 text-xs text-robusta-ink hover:border-robusta-accent"
              aria-label="API 키 관리"
            >
              {anthropicKey
                ? `⚙ Keys · ${maskApiKey(anthropicKey)}`
                : "⚙ Keys"}
            </button>
          </div>
        </header>

        <section className="flex flex-1 items-center justify-center px-6 py-12 text-center">
          <div className="max-w-md">
            <p className="text-sm text-robusta-inkDim">
              {participantsHydrated ? (
                <>참여자 패널이 준비되었습니다. 메시지 모듈은 다음 슬롯에서 추가됩니다.</>
              ) : (
                <>참여자 정보를 불러오는 중…</>
              )}
            </p>
          </div>
        </section>
      </main>

      {keysOpen && <ApiKeysView onClose={() => setKeysOpen(false)} />}
    </div>
  );
}
