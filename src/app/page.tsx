/**
 * page.tsx
 *   - C-D27-3 (D6 15시 슬롯, 2026-05-02) — Tori spec C-D27-3 (B-68/F-68/D-68).
 *
 * 첫 진입 (visitedAt 0건) → WelcomeView. 재진입 → ConversationWorkspace.
 *   Welcome 카드 클릭 → markVisited + switchToWorkspace → workspace 노출.
 *
 * SSR/CSR:
 *   - useState 초기값 'visiting' → useEffect 마운트 후 hasVisited() 분기 (SSR mismatch 회피).
 *   - WelcomeView / ConversationWorkspace 모두 'use client' — page 자체도 client.
 */

"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { hasVisited, markVisited } from "@/modules/visit/visited-store";

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

  useEffect(() => {
    setPhase(hasVisited() ? "workspace" : "welcome");
  }, []);

  if (phase === "loading") return null;

  if (phase === "welcome") {
    return (
      <WelcomeView
        onPick={() => {
          // 시나리오→페르소나 사전 등록은 ConversationWorkspace 마운트 후 store/router 접근.
          //   본 슬롯에서는 markVisited + workspace 전환만 — 사전 등록 store 통합은 D-D28 후보.
          markVisited();
          setPhase("workspace");
        }}
      />
    );
  }

  return <ConversationWorkspace />;
}
