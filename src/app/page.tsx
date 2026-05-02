/**
 * page.tsx
 *   - C-D27-3 (D6 15시 슬롯, 2026-05-02) — Tori spec C-D27-3 (B-68/F-68/D-68).
 *   - C-D28-5 (D6 23시 슬롯, 2026-05-02) — Tori spec C-D28-5 (B-D28+/F-D28-2).
 *     · pickScenario deps 4종을 conversation-store 액션으로 wiring.
 *     · onPick 분기는 store.pickScenario(preset.id) → 4 deps 내부 호출.
 *     · welcomePhase 'workspace' 전환은 store 가 책임 — page 는 구독만.
 *
 * 첫 진입 (visitedAt 0건) → WelcomeView. 재진입 → ConversationWorkspace.
 *
 * SSR/CSR:
 *   - useState 초기값 'visiting' → useEffect 마운트 후 hasVisited() + welcomePhase 분기.
 *   - WelcomeView / ConversationWorkspace 모두 'use client' — page 자체도 client.
 */

"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { hasVisited, markVisited } from "@/modules/visit/visited-store";
import { useConversationStore } from "@/stores/conversation-store";

const WelcomeView = dynamic(
  () =>
    import("@/modules/scenarios/welcome-view").then((m) => m.WelcomeView),
  { ssr: false, loading: () => null },
);
const ConversationWorkspace = dynamic(
  () =>
    import("@/modules/conversation/conversation-workspace").then(
      (m) => m.ConversationWorkspace,
    ),
  { ssr: false, loading: () => null },
);

type Phase = "loading" | "welcome" | "workspace";

export default function HomePage() {
  // SSR/CSR mismatch 회피 — 첫 렌더 = loading. useEffect 직후 hasVisited 결과로 분기.
  const [phase, setPhase] = useState<Phase>("loading");
  // C-D28-5: store 의 welcomePhase 구독 — pickScenario 호출 시 'workspace' 전환 즉시 반영.
  const welcomePhase = useConversationStore((s) => s.welcomePhase);
  const pickScenario = useConversationStore((s) => s.pickScenario);

  useEffect(() => {
    setPhase(hasVisited() ? "workspace" : "welcome");
  }, []);

  // C-D28-5: store welcomePhase 가 'workspace' 로 전환되면 본 page 도 'workspace' 로 sync.
  useEffect(() => {
    if (welcomePhase === "workspace" && phase === "welcome") {
      setPhase("workspace");
    }
  }, [welcomePhase, phase]);

  if (phase === "loading") return null;

  if (phase === "welcome") {
    return (
      <WelcomeView
        onPick={(preset) => {
          // C-D28-5: 4 deps 모두 store 내부 wiring — markVisited / setSeedPlaceholder /
          //   registerPersona (3종) / switchToWorkspace 모두 호출됨.
          //   본 page 도 markVisited() 안전망 호출 — pickScenario 실패 경로 보강 (idempotent).
          markVisited();
          void pickScenario(preset.id);
        }}
      />
    );
  }

  return <ConversationWorkspace />;
}
