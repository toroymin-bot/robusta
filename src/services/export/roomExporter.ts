/**
 * roomExporter.ts
 *   - C-D18-5 (D6 03시 슬롯, 2026-05-01) — 똘이 v1 §5 명세 (F-24 룸 export).
 *
 * 책임:
 *   - Room 객체를 Markdown / JSON 두 형식으로 직렬화.
 *   - Browser API 통한 다운로드 트리거 (downloadAs).
 *   - PDF 는 P1 분리 — 별도 슬롯에서 puppeteer/pdfkit 의존성 추가 후 구현.
 *
 * 안정성:
 *   - 메시지 0건 룸도 정상 다운로드(빈 룸 안내 텍스트 포함).
 *   - 파일명 한글 포함 시 안전 — Blob + URL.createObjectURL 흐름은 한글 그대로 OK.
 *     (encodeURIComponent 는 다운로드 시 자동 처리 영역 — 명시 호출은 URL 쿼리 파라미터에만.)
 *   - 1MB 초과 시 청크 — Blob 자체는 메모리 한계 내 (브라우저 평균 100MB 가능). 1MB 임계 청크는 P1.
 *
 * 의존성 분리:
 *   - StoredMessage/StoredConversation 직접 import 금지 — 최소 RoomLike 인터페이스 사용.
 *   - 호출자가 매핑 책임. modules/storage 결합도 0.
 */

export interface ExportParticipant {
  id: string;
  name: string;
  /** 'human' | 'ai' (외부 호출자가 매핑). */
  role: string;
}

export interface ExportMessage {
  id: string;
  participantId: string;
  /** 'system' | 'user' | 'assistant' (호출자가 결정). */
  role: "system" | "user" | "assistant";
  content: string;
  createdAt: number;
}

export interface ExportRoomMeta {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface RoomLike {
  meta: ExportRoomMeta;
  participants: ExportParticipant[];
  messages: ExportMessage[];
}

const EXPORT_FORMAT_VERSION = 1;

/** Markdown 한 줄 안전 escape — 표 셀 내부의 `|` 은 `\|` 로. */
function mdCell(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

/** ms → 'YYYY-MM-DD HH:MM' (UTC 기준 — 호출자가 locale 변환 가능). */
function fmtTime(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
  );
}

/**
 * Markdown 직렬화. 표 + 시간순 본문.
 *  - 헤더 (룸 메타)
 *  - 참여자 표
 *  - 빈 룸이면 안내 1줄
 *  - 메시지 본문 (시간순)
 */
export function exportToMarkdown(room: RoomLike): string {
  const lines: string[] = [];
  lines.push(`# ${room.meta.title || "(무제 룸)"}`);
  lines.push("");
  lines.push(`- Room ID: \`${room.meta.id}\``);
  lines.push(`- Created: ${fmtTime(room.meta.createdAt)} UTC`);
  lines.push(`- Updated: ${fmtTime(room.meta.updatedAt)} UTC`);
  lines.push(`- Format version: ${EXPORT_FORMAT_VERSION}`);
  lines.push("");

  lines.push("## 참여자");
  lines.push("");
  if (room.participants.length === 0) {
    lines.push("_참여자 없음_");
  } else {
    lines.push("| 이름 | 역할 | ID |");
    lines.push("| --- | --- | --- |");
    for (const p of room.participants) {
      lines.push(`| ${mdCell(p.name)} | ${mdCell(p.role)} | \`${p.id}\` |`);
    }
  }
  lines.push("");

  lines.push("## 대화");
  lines.push("");
  if (room.messages.length === 0) {
    lines.push("_빈 룸 — 메시지 0건_");
  } else {
    const sorted = [...room.messages].sort((a, b) => a.createdAt - b.createdAt);
    for (const m of sorted) {
      const speaker =
        room.participants.find((p) => p.id === m.participantId)?.name ??
        m.participantId;
      lines.push(`### ${speaker} · ${fmtTime(m.createdAt)} UTC`);
      lines.push("");
      lines.push(m.content);
      lines.push("");
    }
  }

  return lines.join("\n");
}

/**
 * JSON 직렬화. schema 버전 명시 — 외부 도구에서 호환 판정용.
 *  - room.id / version=1 / messages[].role 필수.
 *  - 들여쓰기 2 spaces — 가독성.
 */
export function exportToJSON(room: RoomLike): string {
  const payload = {
    version: EXPORT_FORMAT_VERSION,
    room: {
      id: room.meta.id,
      title: room.meta.title,
      createdAt: room.meta.createdAt,
      updatedAt: room.meta.updatedAt,
    },
    participants: room.participants.map((p) => ({
      id: p.id,
      name: p.name,
      role: p.role,
    })),
    messages: [...room.messages]
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((m) => ({
        id: m.id,
        participantId: m.participantId,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      })),
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * 브라우저 다운로드 트리거.
 *  - SSR/Node 환경 호출 시 throw — 호출자는 'use client' 컴포넌트에서만 사용.
 *  - 한글 파일명: Blob href 다운로드 흐름에서 a.download 속성에 그대로 전달 가능.
 */
export async function downloadAs(
  filename: string,
  content: string,
  mime: "text/markdown" | "application/json",
): Promise<void> {
  if (typeof document === "undefined" || typeof URL === "undefined") {
    throw new Error("roomExporter.downloadAs: browser-only API 호출 — SSR 금지");
  }
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  try {
    a.click();
  } finally {
    // microtask 후 정리 — 일부 브라우저에서 즉시 revoke 시 다운로드 실패 가능.
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
  }
}

export const __room_exporter_internal = {
  EXPORT_FORMAT_VERSION,
  fmtTime,
  mdCell,
};
