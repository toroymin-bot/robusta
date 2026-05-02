"use client";

import dynamic from "next/dynamic";
import { lazy, Suspense, useEffect, useState } from "react";
// C-D24-4 (D6 03시 슬롯, 2026-05-02) — B-52 인사이트 라이브러리 진입점 + 사이드 시트.
//   InsightLibrarySheet 는 dynamic import — 메인 번들 +0 의무 (168 kB 게이트 유지).
//   C-D25-5 (D6 07시 슬롯, 2026-05-02) — F-59 168 회복: insight-store 정적 import 제거,
//     useEffect 비동기 dynamic import 로 메인 번들 분리. 첫 페인트는 placeholder "(...)".
//   ~~import { useInsightStore } from "@/modules/insights/insight-store";~~ — C-D25-5 lazy 분리.
import { DEFAULT_CONVERSATION_ID } from "./conversation-types";
const InsightLibrarySheet = dynamic(
  () =>
    import("@/modules/insights/insight-library-sheet").then(
      (m) => m.InsightLibrarySheet,
    ),
  { ssr: false, loading: () => null },
);
// C-D27-5 (D6 15시 슬롯, 2026-05-02) — dev-mode-strip 마운트. #dev hash 가드는 컴포넌트 자체에서 처리.
//   dynamic + ssr:false → 메인 번들 +0 (catalog-i18n / sample-store 함께 lazy chunk).
const DevModeStrip = dynamic(
  () => import("./dev-mode-strip").then((m) => m.DevModeStrip),
  { ssr: false, loading: () => null },
);
import { ApiKeysView } from "@/modules/api-keys/api-keys-view";
// ~~maskApiKey~~ — C-D17-13 (Day 5 15시) HeaderCluster로 이관, 본 파일에서 직접 호출 X.
import { ParticipantsPanel } from "@/modules/participants/participants-panel";
import { ToastViewport } from "@/modules/ui/toast";
import { useThemeStore } from "@/modules/ui/theme";
import { useApiKeyStore } from "@/stores/api-key-store";
import { useParticipantStore } from "@/stores/participant-store";
import { useConversationStore } from "@/stores/conversation-store";
import { ConversationView } from "./conversation-view";
// D-D11-2 (Day 11, 2026-04-29, B19) C-D11-2: AutoLoopHeader — ai-auto 모드 시 헤더 영역 mount.
//   ~~next/dynamic ssr:false 분리 시도~~ — manifest /page∪/layout gzip 합산은 같은 chunks=8로
//     0.2KB만 절약(효과 미미). 정적 import로 복원하고 게이트 +2KB 상향(C-D11-7b)으로 적용.
import { AutoLoopHeader } from "./auto-loop-header";
// C-D17-13 (Day 5 15시 슬롯, 2026-04-30) F-12+D-12: 모바일 햄버거 메뉴 분기.
//   ~~기존 인라인 4도구 div~~ → HeaderCluster (데스크탑 인라인 + 모바일 풀스크린 오버레이).
import { HeaderCluster } from "./header-cluster";
// C-D17-16 (Day 5 23시 슬롯, 2026-04-30) F-15: 자동 발언 스케줄 모달 — 트리거 X, UI 골격 + IndexedDB 영구화만.
//   React.lazy + 조건 mount로 분리 — 모달 코드는 클릭 시점에만 fetch (/page∪/layout 게이트 영향 최소).
//   ~~next/dynamic~~ 도입했다가 helper 오버헤드로 게이트 0.4KB 초과 → React.lazy로 교체.
const ScheduleModal = lazy(() =>
  import("@/modules/schedule/schedule-modal").then((m) => ({ default: m.ScheduleModal })),
);
// D-12.3 (Day 6): 부트 시 1회 등록. 이미 등록되어 있으면 noop.
import { registerOnlineListener } from "@/modules/ui/online-listener";
// D-15.2 (Day 9, 2026-04-28) C-D9-2: 헤더 발언 모드 라벨 i18n.
import { t } from "@/modules/i18n/messages";
import type { TurnMode } from "@/modules/conversation/turn-controller";
// D-D16-1 (Day 4 23시 슬롯, 2026-04-29) C-D16-1: 헤더 모드 라벨 동적 회전 (F-D16-1).
//   v12 §24.3 web_fetch 검증으로 "Day 3" 정적 결함 발견 → Roadmap 자동 계산.
// D-D17-4 (Day 5 03시 슬롯, 2026-04-30) C-D17-4: 색상 티어 import 추가 — Day별 헤더 라벨 색상 분기.
import {
  getRoadmapDay,
  formatRoadmapLabel,
  getRoadmapColorTier,
  ROADMAP_COLOR_HEX,
} from "./roadmap-day";

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
 *   Tailwind에 yellow-500 토큰 매핑 미정의 — 호출자가 인라인 style.borderLeftColor=#F5C518 fallback 적용할 것.
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
  // C-D17-15 (D6 03시) KQ_14: 3-state segment 활성. choice/setChoice 양쪽 prop 으로 HeaderCluster 에 전달.
  const themeChoice = useThemeStore((s) => s.choice);
  const setThemeChoice = useThemeStore((s) => s.setChoice);

  const [keysOpen, setKeysOpen] = useState(false);
  // C-D17-16 (Day 5 23시 슬롯, 2026-04-30) F-15: 스케줄 모달 open state.
  const [scheduleOpen, setScheduleOpen] = useState(false);
  // C-D24-4 (D6 03시 슬롯, 2026-05-02) — 인사이트 라이브러리 사이드 시트 open state.
  const [insightLibraryOpen, setInsightLibraryOpen] = useState(false);
  // C-D25-5 (D6 07시 슬롯, 2026-05-02) — F-59 168 회복: insight count 비동기 dynamic 로드.
  //   첫 페인트 = null → placeholder "(...)". useEffect 마운트 직후 dynamic import + subscribe.
  const [insightCount, setInsightCount] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | undefined;
    void import("@/modules/insights/insight-store").then((mod) => {
      if (cancelled) return;
      const store = mod.useInsightStore;
      // 룸 진입 1회 hydrate (Dexie → 메모리). C-D25-2 영구화.
      void store.getState().hydrate(DEFAULT_CONVERSATION_ID).catch(() => {});
      const sync = () =>
        setInsightCount(store.getState().count(DEFAULT_CONVERSATION_ID));
      sync();
      unsub = store.subscribe(sync);
    });
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);
  // D-D16-1 (Day 4 23시 슬롯, 2026-04-29) C-D16-1: D-Day 라벨 클라 시점 계산.
  //   SSR/CSR hydration mismatch 회피를 위해 SSR 폴백 = Day 5 (라이브 시점 정합).
  //   useEffect로 클라 시점 1회 set → 렌더 직후 실제 D-Day로 회전.
  // D-D17-4 (Day 5 03시 슬롯, 2026-04-30) C-D17-4: 라벨/색상 모두 day 기반 도출하도록 day state로 통합.
  //   ~~roadmapLabel: string state~~ → roadmapDay: number state. 라벨은 매 렌더 도출.
  const [roadmapDay, setRoadmapDay] = useState<number>(5);
  useEffect(() => {
    setRoadmapDay(getRoadmapDay().day);
  }, []);
  const roadmapInfo = { day: roadmapDay, mode: roadmapDay >= 5 ? "Live" : "Manual" } as const;
  const roadmapLabel = formatRoadmapLabel(roadmapInfo);
  const roadmapColor = ROADMAP_COLOR_HEX[getRoadmapColorTier(roadmapDay)];

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
          {/* C-D17-13 (Day 5 15시 슬롯, 2026-04-30) F-12+D-12 / Roy id-19 직접 대응:
              ~~기존 인라인 4도구 div (mode-label, turn-mode-label, theme-toggle, ⚙ Keys)~~
              → HeaderCluster: 데스크탑 ≥ md 인라인 동일 / 모바일 < md 햄버거 + 풀스크린 오버레이.
              data-test 셀렉터(header-mode-label, header-turn-mode-label)는 HeaderCluster 내부에 그대로 정의됨 → 회귀 0. */}
          <div className="flex items-center gap-2">
            {/* C-D24-4 (D6 03시 슬롯, 2026-05-02) — F-52 인사이트 라이브러리 진입 버튼.
                HeaderCluster 좌측 고정 — 헤더 4도구는 그대로 유지 (회귀 0). 모바일 시 햄버거 옆 노출. */}
            <button
              type="button"
              onClick={() => setInsightLibraryOpen(true)}
              data-test="insight-library-entry"
              aria-label={t("insightLibrary.entry.button")}
              title={t("insightLibrary.entry.button")}
              className="
                inline-flex items-center gap-1
                rounded border border-robusta-divider px-2 py-1
                text-[12px] text-robusta-inkDim hover:text-robusta-ink hover:border-robusta-accent
              "
            >
              {t("insightLibrary.entry.label").replace(
                "{count}",
                insightCount === null ? "..." : String(insightCount),
              )}
            </button>
            <HeaderCluster
              roadmapLabel={roadmapLabel}
              roadmapColor={roadmapColor}
              turnModeLabel={t(TURN_MODE_LABEL_KEY[turnMode])}
              themeHydrated={themeHydrated}
              themeMode={themeMode}
              onToggleTheme={toggleTheme}
              themeChoice={themeChoice}
              onSetThemeChoice={setThemeChoice}
              onOpenApiKeyModal={() => setKeysOpen(true)}
              onOpenScheduleModal={() => setScheduleOpen(true)}
              anthropicKey={anthropicKey ?? ""}
            />
          </div>
        </header>

        {/* D-D11-2 (Day 11) C-D11-2: AI-Auto 컨트롤 헤더 — 컴포넌트 자체가 turnMode==='ai-auto' 가드. */}
        <AutoLoopHeader />

        {/* C-D27-5 (D6 15시 슬롯, 2026-05-02) — dev-mode-strip dynamic 마운트.
            #dev hash 활성 시만 노출 (컴포넌트 내부 가드). 일반 사용자 노출 0. */}
        <DevModeStrip />

        <ConversationView onRequestApiKeyModal={() => setKeysOpen(true)} />
      </main>

      {keysOpen && <ApiKeysView onClose={() => setKeysOpen(false)} />}
      {/* C-D17-16 (Day 5 23시 슬롯) F-15: 스케줄 모달. open=true 시만 mount + lazy import → 초기 번들 영향 0. */}
      {scheduleOpen && (
        <Suspense fallback={null}>
          <ScheduleModal onClose={() => setScheduleOpen(false)} />
        </Suspense>
      )}
      {/* C-D24-4 (D6 03시 슬롯, 2026-05-02) — 인사이트 라이브러리 사이드 시트 (dynamic, 클릭 시점 로드). */}
      {insightLibraryOpen && (
        <InsightLibrarySheet
          roomId={DEFAULT_CONVERSATION_ID}
          open={insightLibraryOpen}
          onClose={() => setInsightLibraryOpen(false)}
        />
      )}
      <ToastViewport />
    </div>
  );
}
