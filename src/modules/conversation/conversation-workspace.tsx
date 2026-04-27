"use client";

import { useEffect, useState } from "react";
import { ApiKeysView } from "@/modules/api-keys/api-keys-view";
import { maskApiKey } from "@/modules/api-keys/api-key-mask";
import { ParticipantsPanel } from "@/modules/participants/participants-panel";
import { ToastViewport } from "@/modules/ui/toast";
import { useApiKeyStore } from "@/stores/api-key-store";
import { useParticipantStore } from "@/stores/participant-store";
import { useConversationStore } from "@/stores/conversation-store";
import { ConversationView } from "./conversation-view";

export function ConversationWorkspace() {
  const participantsHydrated = useParticipantStore((s) => s.hydrated);
  const loadParticipants = useParticipantStore((s) => s.loadFromDb);
  const apiKeysHydrated = useApiKeyStore((s) => s.hydrated);
  const loadApiKeys = useApiKeyStore((s) => s.loadFromDb);
  const anthropicKey = useApiKeyStore((s) => s.keys.anthropic);
  const conversationsHydrated = useConversationStore((s) => s.hydrated);
  const loadConversations = useConversationStore((s) => s.loadFromDb);

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

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-robusta-canvas text-robusta-ink">
      <ParticipantsPanel />
      <main className="flex flex-1 flex-col">
        <header className="flex h-12 items-center justify-between border-b border-robusta-divider px-6 backdrop-blur">
          <h1 className="text-base font-semibold tracking-tight">Robusta</h1>
          <div className="flex items-center gap-3">
            <span className="text-xs uppercase tracking-widest text-robusta-inkDim">
              Day 2 · 3-way Conversation
            </span>
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
