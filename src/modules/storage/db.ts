"use client";

import Dexie, { type Table } from "dexie";
import type { Participant } from "@/modules/participants/participant-types";
import type { Persona } from "@/modules/personas/persona-types";
import type { InsightKind } from "@/modules/conversation/conversation-types";

export interface StoredApiKey {
  provider: string;
  key: string;
  savedAt: number;
}

export interface StoredMessageUsage {
  inputTokens?: number;
  outputTokens?: number;
}

export interface StoredMessage {
  id: string;
  conversationId: string;
  participantId: string;
  content: string;
  createdAt: number;
  status: "streaming" | "done" | "error" | "aborted";
  errorReason?: string;
  usage?: StoredMessageUsage;
  // D-12.1 (Day 6, 2026-04-28): status='streaming' 진입 시점. 부팅 잔재 정리 시
  // Date.now() - streamingStartedAt > STREAMING_STALE_MS → 'aborted' 마킹.
  // 그 이내는 멀티 탭에서 다른 탭이 진행 중일 가능성 → 보존.
  streamingStartedAt?: number;
}

export interface StoredConversation {
  id: string;
  title: string;
  participantIds: string[];
  createdAt: number;
  updatedAt: number;
}

/**
 * D-9.1 (Day 4, 2026-04-29): settings 테이블 신규.
 *   key/value 단순 영구 저장소. 호출자가 JSON.stringify/parse 책임.
 *   현재 사용처: 'theme' (D-9.1 마이그레이션) — 향후 'locale' / 'theme.userOverride' 등 확장.
 */
export interface SettingsRecord {
  key: string;
  value: string;
  updatedAt: number;
}

/**
 * D-12.2 (Day 6, 2026-04-28): BYOK 키 메타. provider+keyMask 합성 PK.
 *   keyMask = maskApiKey(stored) 결과 ("sk-ant-...XXXX" 형태) — 평문 키는 등록하지 않음.
 *   lastUnauthorizedAt 24h 이내 → BYOK 모달에서 ⚠ 배지 + 토스트 권장.
 *   markVerified로 lastUnauthorizedAt 클리어.
 */
export interface ApiKeyMetaRecord {
  // 합성키: `${provider}::${keyMask}`
  pk: string;
  provider: string;
  keyMask: string;
  lastUnauthorizedAt?: number;
  lastVerifiedAt?: number;
  updatedAt: number;
}

/**
 * C-D25-2 (D6 07시 슬롯, 2026-05-02) — Tori spec C-D25-2, B-57/F-57.
 *   Dexie v7 신규 테이블. 인사이트 영구화 — zustand 메모리(C-D24-4) → 새로고침 시 0 손실.
 *   PK 'id' (uuid). 인덱스: roomId / sourceMessageId / [roomId+createdAt] (룸별 최신순).
 *   markedBy = 사용자 수동 마크('user') vs 자동 마크('auto', C-D25-1).
 */
export interface InsightRow {
  id: string;
  roomId: string;
  sourceMessageId: string;
  text: string;
  personaId: string | null;
  insightKind: InsightKind | null;
  markedBy: "user" | "auto";
  createdAt: number;
}

export class RobustaDB extends Dexie {
  participants!: Table<Participant, string>;
  conversations!: Table<StoredConversation, string>;
  messages!: Table<StoredMessage, string>;
  apiKeys!: Table<StoredApiKey, string>;
  // D-9.1 신규 테이블
  settings!: Table<SettingsRecord, string>;
  // D-12.2 (Day 6) 신규 테이블 — BYOK 키 만료/검증 메타.
  apiKeyMeta!: Table<ApiKeyMetaRecord, string>;
  // D-13.0 (Day 7, 2026-04-29) 신규 테이블 — 페르소나 카탈로그(프리셋 + 사용자 커스텀).
  personas!: Table<Persona, string>;
  // C-D25-2 (D6 07시 슬롯, 2026-05-02) — 인사이트 영구화 (B-57/F-57).
  insights!: Table<InsightRow, string>;

  constructor() {
    super("robusta");
    this.version(1).stores({
      participants: "id, kind, name",
      conversations: "id, updatedAt",
      messages: "id, conversationId, createdAt",
      apiKeys: "provider",
    });
    // v2 — D-7: messages 스키마는 동일 인덱스(필드 추가만, 인덱스 변경 없음)지만
    // 안전한 마이그레이션 포인트로 명시. 잔재 streaming 메시지를 aborted 로 리커버.
    this.version(2)
      .stores({
        participants: "id, kind, name",
        conversations: "id, updatedAt",
        messages: "id, conversationId, createdAt, status",
        apiKeys: "provider",
      })
      .upgrade(async (tx) => {
        const messages = tx.table<StoredMessage, string>("messages");
        await messages.toCollection().modify((m) => {
          if (m.status === "streaming") {
            m.status = "aborted";
            m.errorReason = m.errorReason ?? "interrupted by reload";
          }
        });
      });
    // v3 — D-9.1 (D4): settings 테이블 신규 + theme localStorage 1회 이관.
    //   기존 v2 테이블(participants/conversations/messages/apiKeys)은 Dexie auto-carry — 데이터 보존.
    //   participants 인덱스에 'name' 유지 (재선언 불필요지만 명시 원칙).
    this.version(3).stores({
      participants: "id, kind, name",
      conversations: "id, updatedAt",
      messages: "id, conversationId, createdAt, status",
      apiKeys: "provider",
      settings: "key", // 신규
    });
    // v4 — D-12 (Day 6, 2026-04-28): messages.streamingStartedAt 인덱스 + apiKeyMeta 테이블 신규.
    //   명세 Komi_Spec_Day6 §3 D-12.1은 v3로 등록됐으나 v3는 settings 테이블이 점유.
    //   꼬미 정정: 실제 다음 버전 v4로 정의. 데이터 보존(Dexie auto-carry).
    //   v3 → v4 사용자 환경에서 무손실 동작 (추정 27 검증 대상).
    //   streamingStartedAt 인덱스 추가는 기존 row를 재 작성하지 않으며, undefined 인덱스만 NULL.
    this.version(4)
      .stores({
        participants: "id, kind, name",
        conversations: "id, updatedAt",
        messages:
          "id, conversationId, createdAt, status, streamingStartedAt", // streamingStartedAt 인덱스 추가
        apiKeys: "provider",
        settings: "key",
        apiKeyMeta: "pk, provider, lastUnauthorizedAt", // 신규 테이블
      })
      .upgrade(async (tx) => {
        // 옛 v2/v3 시점에 등록된 status='streaming' 잔재는 streamingStartedAt 미등록.
        // → 즉시 'aborted'로 리커버 (D-12.1 5분 임계 평가에 streamingStartedAt이 필요한데 없으므로).
        const messages = tx.table<StoredMessage, string>("messages");
        await messages.where("status").equals("streaming").modify((m) => {
          if (m.streamingStartedAt === undefined) {
            m.status = "aborted";
            m.errorReason = m.errorReason ?? "interrupted by reload (pre-v4)";
          }
        });
      });
    // v5 — D-13.0 (Day 7, 2026-04-29): personas 테이블 신규.
    //   기존 v4 테이블(participants/conversations/messages/apiKeys/settings/apiKeyMeta) Dexie auto-carry.
    //   isPreset은 boolean이지만 IndexedDB 인덱스에 boolean 직접 사용 불가 — Dexie에서 falsy 무시 이슈가 있어
    //   numeric 0/1로 기록하는 게 표준이지만, 본 명세는 멱등 시드 + 'isPreset+kind' 합성 인덱스를 boolean 그대로 사용.
    //   실 쿼리는 store에서 isPreset === true 필터로 in-memory 처리 → 인덱스는 문서화 의미만.
    this.version(5).stores({
      participants: "id, kind, name",
      conversations: "id, updatedAt",
      messages:
        "id, conversationId, createdAt, status, streamingStartedAt",
      apiKeys: "provider",
      settings: "key",
      apiKeyMeta: "pk, provider, lastUnauthorizedAt",
      personas: "&id, kind, isPreset, createdAt, [kind+isPreset]", // 신규 테이블
    });
    // v6 — D-15.1 (Day 9, 2026-04-28) C-D9-1: 기존 critic preset row 강제 갱신.
    //   ensurePresetSeed는 멱등 시드(이미 등록된 항목 skip)라 D-13.1 본문이 그대로 남아 라이브 회귀(B-1) fix 미반영.
    //   v6 upgrade로 id='preset:critic'이고 isPreset=true인 row만 systemPromptKo/En을 D-15.1 본문으로 덮어쓴다.
    //   사용자 정의 critic(id != 'preset:critic')은 영향 없음. updatedAt도 갱신.
    //   본 마이그레이션은 1회성 — v6 등록된 후 재실행되지 않음.
    this.version(6)
      .stores({
        participants: "id, kind, name",
        conversations: "id, updatedAt",
        messages:
          "id, conversationId, createdAt, status, streamingStartedAt",
        apiKeys: "provider",
        settings: "key",
        apiKeyMeta: "pk, provider, lastUnauthorizedAt",
        personas: "&id, kind, isPreset, createdAt, [kind+isPreset]",
      })
      .upgrade(async (tx) => {
        const personas = tx.table<Persona, string>("personas");
        const existing = await personas.get("preset:critic");
        if (!existing || existing.isPreset !== true) return;
        // D-15.1 (Day 9) 새 본문 — preset-catalog.ts / messages.ts와 1:1 동기화.
        await personas.update("preset:critic", {
          systemPromptKo:
            "너는 비판자다. 약점·실패·반증·리스크를 우선 기록한다. 동의는 마지막. 칭찬 금지. 비판할 때는 근거 없으면 비판하지 마라. 단, 인사·스몰토크는 비판 없이 자연스럽게 답한다.",
          systemPromptEn:
            "You are the Critic. Surface weaknesses, failures, counterevidence, risks first. Agreement last. No praise. Critique only with evidence. Greetings and small-talk get natural replies, no critique.",
          updatedAt: Date.now(),
        });
      });
    // v7 — C-D25-2 (D6 07시 슬롯, 2026-05-02) — Tori spec B-57/F-57: insights 테이블 신규.
    //   기존 v6 테이블(participants/conversations/messages/apiKeys/settings/apiKeyMeta/personas) Dexie auto-carry — 0 손실.
    //   인덱스: PK id / roomId(룸별 카운트) / sourceMessageId(메시지 ↔ 인사이트 역참조) / [roomId+createdAt](룸별 최신순).
    //   upgrade 함수 없음 — 신규 테이블만 추가, 기존 row 변경 0.
    this.version(7).stores({
      participants: "id, kind, name",
      conversations: "id, updatedAt",
      messages:
        "id, conversationId, createdAt, status, streamingStartedAt",
      apiKeys: "provider",
      settings: "key",
      apiKeyMeta: "pk, provider, lastUnauthorizedAt",
      personas: "&id, kind, isPreset, createdAt, [kind+isPreset]",
      insights: "id, roomId, sourceMessageId, [roomId+createdAt]", // 신규
    });
  }
}

let dbInstance: RobustaDB | null = null;

export function getDb(): RobustaDB {
  if (typeof window === "undefined") {
    throw new Error("RobustaDB is only available in the browser.");
  }
  if (!dbInstance) {
    dbInstance = new RobustaDB();
  }
  return dbInstance;
}

/**
 * D-12.1 (Day 6, 2026-04-28) streaming 잔재 5분 임계 정리.
 *   현재 부팅 시점에서 status='streaming' && streamingStartedAt 정의되어 있고
 *   Date.now() - streamingStartedAt > STREAMING_STALE_MS인 row만 'aborted' 마킹.
 *   5분 이내는 보존 (멀티 탭 안전).
 *   streamingStartedAt 미등록 row는 v4 upgrade에서 이미 처리됨 — 본 함수는 v4 이후 등록된 row만.
 *   호출자: conversation-store.loadFromDb 직후 1회.
 */
export const STREAMING_STALE_MS = 5 * 60 * 1000;

export async function cleanStaleStreamingMessages(
  now: number = Date.now(),
): Promise<{ recovered: number; preserved: number }> {
  if (typeof window === "undefined") return { recovered: 0, preserved: 0 };
  const db = getDb();
  const candidates = await db.messages.where("status").equals("streaming").toArray();
  let recovered = 0;
  let preserved = 0;
  for (const m of candidates) {
    if (typeof m.streamingStartedAt !== "number") {
      // v4 upgrade가 처리했어야 하지만 안전망 — undefined면 즉시 aborted.
      await db.messages.put({
        ...m,
        status: "aborted",
        errorReason: m.errorReason ?? "interrupted by reload (no timestamp)",
      });
      recovered++;
      continue;
    }
    if (now - m.streamingStartedAt > STREAMING_STALE_MS) {
      await db.messages.put({
        ...m,
        status: "aborted",
        errorReason: m.errorReason ?? "stale streaming (>5min)",
      });
      recovered++;
    } else {
      preserved++;
    }
  }
  return { recovered, preserved };
}

/**
 * D-9.1 (D4): theme localStorage → IndexedDB(settings) 1회 이관.
 *   부트 시 1회 호출 (useThemeStore.hydrate 안에서 실행).
 *   이미 settings.theme 존재 → noop. 없고 localStorage('robusta:theme')에 값이 있으면 이전 후 localStorage 제거.
 *   실패(privacy / IndexedDB 차단) → silent fallback. 호출자는 theme 자체 default('light')로 동작.
 */
export async function migrateThemeFromLocalStorage(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const db = getDb();
    const existing = await db.settings.get("theme");
    if (existing) return; // 이미 마이그레이션 완료
    let ls: string | null = null;
    try {
      // 기존 localStorage 키 (D-8.6 P1 명세에서 사용)
      ls = window.localStorage.getItem("robusta:theme");
    } catch {
      // private browsing 등 — silent
      return;
    }
    if (ls !== "light" && ls !== "dark") return; // 이전할 값 없음
    await db.settings.put({
      key: "theme",
      value: ls,
      updatedAt: Date.now(),
    });
    try {
      window.localStorage.removeItem("robusta:theme");
    } catch {
      // 제거 실패 — 다음 부트에 noop (이미 settings에 등록됨 → existing path)
    }
  } catch {
    // IndexedDB 차단 — silent
  }
}
