/**
 * useRoomExport.ts
 *   - C-D21-4 (D6 15시 슬롯, 2026-05-01) — F-24 룸 export UI 와이어업의 1차 훅 (모듈 분리).
 *
 * 책임 (Single Responsibility):
 *   - 호출자에게 `exportAs(format)` 콜백 1개 + `canExport` 플래그를 노출.
 *   - 모듈 dynamic import — 메인 번들 영향 0 보장 (170~210 LoC + Blob/URL 핸들링).
 *   - SSR 가드: 브라우저 외 호출 시 silently skip + console.warn.
 *
 * 비-책임:
 *   - UI 마크업 (버튼/메뉴) 은 호출자.
 *   - Room 객체 매핑 (storage → RoomLike) 은 호출자가 RoomProvider 함수 주입.
 *
 * 정책:
 *   - format='md' 또는 'json'. 미지원 값 → throw (TS 차원에서 차단).
 *   - 다운로드 파일명: `robusta-{roomId}-{YYYYMMDD}.{ext}`. 한글 룸 타이틀은 파일명에서 회피 — meta 본문엔 보존.
 *   - 메시지 0건이어도 export 허용 — roomExporter 가 빈 룸 안내 자동 포함.
 */

"use client";

import { useCallback } from "react";
import type { RoomLike } from "@/services/export/roomExporter";

export type ExportFormat = "md" | "json";

export interface UseRoomExportOptions {
  /** Room 매핑 함수 — 호출자가 storage → RoomLike 변환. SSR 가드 통과 후 호출. */
  getRoom: () => RoomLike | null;
}

export interface UseRoomExportReturn {
  /** 매핑 가능 + 브라우저 환경 → true. */
  canExport: boolean;
  /** format 별 다운로드 트리거. 실패 시 throw — 호출자가 toast 처리. */
  exportAs: (format: ExportFormat) => Promise<void>;
}

/** 'YYYYMMDD' (UTC 기준 — 파일명 충돌 회피). */
function ymdUTC(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}

/** roomId 안전 슬러그 — 파일명 안전 문자만 허용. */
function safeRoomSlug(id: string): string {
  return (id || "room").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 32);
}

export function useRoomExport(opts: UseRoomExportOptions): UseRoomExportReturn {
  const { getRoom } = opts;
  const isBrowser =
    typeof window !== "undefined" && typeof document !== "undefined";

  const exportAs = useCallback(
    async (format: ExportFormat): Promise<void> => {
      if (!isBrowser) {
        console.warn("useRoomExport: SSR 환경 — export skip");
        return;
      }
      const room = getRoom();
      if (!room) {
        console.warn("useRoomExport: getRoom() returned null — export skip");
        return;
      }
      // 다이내믹 import — 메인 번들 진입 차단.
      const mod = await import("@/services/export/roomExporter");
      const slug = safeRoomSlug(room.meta.id);
      const ymd = ymdUTC();
      if (format === "md") {
        const content = mod.exportToMarkdown(room);
        await mod.downloadAs(`robusta-${slug}-${ymd}.md`, content, "text/markdown");
      } else if (format === "json") {
        const content = mod.exportToJSON(room);
        await mod.downloadAs(
          `robusta-${slug}-${ymd}.json`,
          content,
          "application/json",
        );
      } else {
        const _exhaustive: never = format;
        void _exhaustive;
        throw new Error(`useRoomExport: 미지원 format=${format as string}`);
      }
    },
    [getRoom, isBrowser],
  );

  return { canExport: isBrowser, exportAs };
}

export const __room_export_internal = {
  ymdUTC,
  safeRoomSlug,
};
