/**
 * pdf-font-loader.ts
 *   - C-D26-3 (D6 11시 슬롯, 2026-05-02) — Tori spec C-D26-3 (B-63/F-63/D-63).
 *
 * Why: NotoSansKR-Regular 한글 폰트 lazy fetch.
 *   public/fonts/NotoSansKR-Regular.ttf 정적 호스팅 (꼬미 자율, SIL OFL 라이선스).
 *   첫 호출 시점에만 fetch — 이후 module-scope cache 로 재사용.
 *
 * 진행률(onProgress): fetch 진행률을 0~100 으로 누적 콜백 (Content-Length 사용).
 *
 * OCP: 외부 의존 0 (fetch only). pdf-export.ts 가 dynamic import.
 */

const FONT_URL = "/fonts/NotoSansKR-Regular.ttf";

let cachedBuffer: ArrayBuffer | null = null;

export async function loadNotoSansKR(
  onProgress?: (percent: number) => void,
): Promise<ArrayBuffer> {
  if (cachedBuffer) {
    onProgress?.(100);
    return cachedBuffer;
  }
  const res = await fetch(FONT_URL);
  if (!res.ok) {
    throw new Error(`font fetch failed: ${res.status}`);
  }
  const total = Number(res.headers.get("content-length") || 0);
  if (!res.body || total === 0) {
    // Content-Length 미제공 — 한 번에 받기.
    const buf = await res.arrayBuffer();
    onProgress?.(100);
    cachedBuffer = buf;
    return buf;
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.length;
      onProgress?.(Math.round((received / total) * 100));
    }
  }
  const merged = new Uint8Array(received);
  let off = 0;
  for (const c of chunks) {
    merged.set(c, off);
    off += c.length;
  }
  cachedBuffer = merged.buffer;
  return cachedBuffer;
}

export function clearFontCache(): void {
  cachedBuffer = null;
}
