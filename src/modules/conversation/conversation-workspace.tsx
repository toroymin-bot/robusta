"use client";

import { useEffect } from "react";
import { ParticipantsPanel } from "@/modules/participants/participants-panel";
import { useParticipantStore } from "@/stores/participant-store";

export function ConversationWorkspace() {
  const hydrated = useParticipantStore((s) => s.hydrated);
  const loadFromDb = useParticipantStore((s) => s.loadFromDb);

  useEffect(() => {
    if (!hydrated) {
      void loadFromDb().catch((err) => {
        console.error("[robusta] participant load failed", err);
      });
    }
  }, [hydrated, loadFromDb]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-robusta-canvas text-robusta-ink">
      <ParticipantsPanel />
      <main className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-robusta-divider px-6 py-3">
          <h1 className="text-base font-semibold tracking-tight">Robusta</h1>
          <span className="text-xs uppercase tracking-widest text-robusta-inkDim">
            Day 2 · 3-way Conversation
          </span>
        </header>

        <section className="flex flex-1 items-center justify-center px-6 py-12 text-center">
          <div className="max-w-md">
            <p className="text-sm text-robusta-inkDim">
              {hydrated ? (
                <>참여자 패널이 준비되었습니다. 메시지 모듈은 다음 슬롯에서 추가됩니다.</>
              ) : (
                <>참여자 정보를 불러오는 중…</>
              )}
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
