/**
 * pdf-export.ts
 *   - C-D26-3 (D6 11시 슬롯, 2026-05-02) — Tori spec C-D26-3 (B-63/F-63/D-63).
 *
 * Why: 룸 메시지 → pdfkit doc → Blob → download.
 *   pdfkit 본체는 dynamic import (메인 번들 +0).
 *   한글 폰트 NotoSansKR Regular 도 lazy fetch (pdf-font-loader).
 *
 * 사용:
 *   const blob = await exportRoomToPdf(roomId, { includeInsights, includeSystem, locale }, onProgress);
 *   downloadBlob(blob, 'robusta-room.pdf');
 *
 * OCP: 외부 의존 = pdfkit (dynamic) + pdf-font-loader (dynamic).
 *   pdfkit 은 타입 정의 0 — runtime 만. 호출처에서 unknown 으로 받아 메서드 캐스팅.
 */

export interface PdfExportOptions {
  includeInsights: boolean;
  includeSystem: boolean;
  locale: "ko" | "en";
}

export type PdfExportPhase = "loading-font" | "rendering" | "finalizing";

export interface PdfExportProgress {
  phase: PdfExportPhase;
  percent: number;
}

interface MinimalMessage {
  id: string;
  participantId: string;
  content: string;
  kind?: "system" | undefined;
}

type PdfDocLike = {
  registerFont: (name: string, buf: Uint8Array) => void;
  font: (name: string) => PdfDocLike;
  fontSize: (n: number) => PdfDocLike;
  fillColor: (c: string) => PdfDocLike;
  text: (s: string, opts?: Record<string, unknown>) => PdfDocLike;
  moveDown: (n: number) => PdfDocLike;
  end: () => void;
  on: (ev: string, fn: (c: Uint8Array) => void) => PdfDocLike;
};

/**
 * 룸 메시지를 PDF Blob 으로 변환.
 *   pdfkit + 한글 폰트는 dynamic import — 첫 호출 시점에만 fetch.
 */
export async function exportRoomToPdf(
  roomId: string,
  options: PdfExportOptions,
  onProgress?: (p: PdfExportProgress) => void,
): Promise<Blob> {
  // 1) pdfkit dynamic import — 타입 미존재로 모듈 식별자를 변수로 wrap (tsc resolveJsonModule X).
  onProgress?.({ phase: "loading-font", percent: 0 });
  const moduleId: string = "pdfkit";
  const pdfkitMod = (await import(/* webpackChunkName: "pdfkit" */ moduleId)) as unknown as {
    default?: new (opts: Record<string, unknown>) => PdfDocLike;
  };
  const PDFDocumentCtor =
    (pdfkitMod.default as unknown) ??
    (pdfkitMod as unknown as new (opts: Record<string, unknown>) => PdfDocLike);

  // 2) 한글 폰트 fetch (cache hit 시 0 latency)
  const fontLoader = await import("./pdf-font-loader");
  const fontBuffer = await fontLoader.loadNotoSansKR((pct) =>
    onProgress?.({ phase: "loading-font", percent: pct }),
  );

  // 3) doc 생성
  const Ctor = PDFDocumentCtor as new (
    opts: Record<string, unknown>,
  ) => PdfDocLike;
  const doc = new Ctor({ size: "A4", margin: 40 });
  doc.registerFont("NotoSansKR", new Uint8Array(fontBuffer));
  doc.font("NotoSansKR").fontSize(11);

  // 4) 메시지 로드 + 렌더 (실측 시점 conversation-store 가 SSR-unsafe라 dynamic).
  const messages = await fetchRoomMessages(roomId);
  const filtered = messages.filter((m) => {
    if (m.kind === "system" && !options.includeSystem) return false;
    return true;
  });
  for (let i = 0; i < filtered.length; i += 1) {
    const m = filtered[i]!;
    renderMessageLine(doc, m, options);
    onProgress?.({
      phase: "rendering",
      percent: Math.round(((i + 1) / Math.max(filtered.length, 1)) * 100),
    });
  }

  // 5) 종료 + Blob 변환
  onProgress?.({ phase: "finalizing", percent: 100 });
  const chunks: BlobPart[] = [];
  doc.on("data", (c: Uint8Array) => {
    const ab = c.buffer.slice(
      c.byteOffset,
      c.byteOffset + c.byteLength,
    ) as ArrayBuffer;
    chunks.push(ab);
  });
  const endPromise = new Promise<void>((resolve) => {
    doc.on("end", () => resolve());
  });
  doc.end();
  await endPromise;
  return new Blob(chunks, { type: "application/pdf" });
}

async function fetchRoomMessages(roomId: string): Promise<MinimalMessage[]> {
  // SSR 가드 — Dexie 가 typeof window === 'undefined' 시 메모리 only.
  if (typeof window === "undefined") return [];
  const dbMod = await import("@/modules/storage/db");
  const db = dbMod.getDb();
  const rows = await db.messages
    .where("conversationId")
    .equals(roomId)
    .sortBy("createdAt");
  return rows.map((r) => ({
    id: r.id,
    participantId: r.participantId,
    content: r.content ?? "",
    kind: r.participantId.startsWith("system") ? ("system" as const) : undefined,
  }));
}

function renderMessageLine(
  doc: PdfDocLike,
  m: MinimalMessage,
  options: PdfExportOptions,
): void {
  const speaker = m.participantId || "?";
  doc.fontSize(9).fillColor("#5C5849").text(`[${speaker}]`);
  doc
    .fontSize(11)
    .fillColor("#15140E")
    .text(m.content || "", { paragraphGap: 4 });
  if (options.includeInsights) {
    // StoredMessage 에 insight 필드 미정의 — 향후 D-D27 Dexie v8 에서 노출 시 활성.
    doc.moveDown(0.3);
  } else {
    doc.moveDown(0.5);
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  if (typeof window === "undefined") return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
