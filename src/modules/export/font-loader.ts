/**
 * font-loader.ts
 *   - C-D29-3 (D-5 03시 슬롯, 2026-05-03) — Tori spec C-D29-3 (KQ_22 (1) 흡수).
 *     · KQ_22 (1) (e) 채택: NotoSansKR subset (KR 2350자 KSX1001 + Latin Basic) ≈ 350KB 정적
 *       + 풀폰트 lazy fallback (희귀자 발견 시).
 *     · 기존 pdf-font-loader.ts (C-D26-3) 풀폰트 직접 fetch 는 보존 — 본 파일은 어댑터 추가만.
 *
 * Why: BYOK·오프라인 컨셉(§ 1.1) 정합 + 첫 로드 350KB 만, 희귀자 만나면 풀폰트 lazy.
 *   PDF export Phase 2 본격 (Spec 005+) 이지만 호스팅·디렉토리 구조는 MVP 에 등록.
 *
 * subset 범위 (Tori spec C-D29-3):
 *   - U+0020-007E (ASCII printable 95자)
 *   - U+00A0-00FF (Latin-1 supplement 32자)
 *   - U+AC00-D7A3 (Hangul Syllables 11172자, KSX1001 2350자 포함)
 *   - U+3131-318E (Hangul Compatibility Jamo 94자)
 *
 * fallback chain:
 *   1) text 범위 검사 → subset 만 필요 → /fonts/NotoSansKR-Subset.ttf fetch
 *   2) 외부 문자 1자라도 있으면 → /fonts/NotoSansKR-Regular.ttf 풀폰트 fetch
 *   3) 풀폰트 fetch 실패 → subset fallback + console.warn (PDF 일부 글리프 사각형으로 대체)
 *
 * cache:
 *   - module-scope cache (subset / full 별도) — 첫 호출 후 재사용.
 *
 * OCP: 외부 의존 0 (fetch only). 기존 pdf-font-loader.ts 무수정.
 */

const FONT_SUBSET_URL = "/fonts/NotoSansKR-Subset.ttf";
const FONT_FULL_URL = "/fonts/NotoSansKR-Regular.ttf";

let subsetCache: ArrayBuffer | null = null;
let fullCache: ArrayBuffer | null = null;

/**
 * isInSubsetRange — 1 codepoint 가 subset 범위 안에 있는지 검사.
 *   범위 외 발견 시 false → 풀폰트 트리거.
 */
export function isInSubsetRange(codepoint: number): boolean {
  return (
    (codepoint >= 0x0020 && codepoint <= 0x007e) || // ASCII printable
    (codepoint >= 0x00a0 && codepoint <= 0x00ff) || // Latin-1 supplement
    (codepoint >= 0xac00 && codepoint <= 0xd7a3) || // Hangul Syllables
    (codepoint >= 0x3131 && codepoint <= 0x318e) || // Hangul Compatibility Jamo
    codepoint === 0x000a || // newline
    codepoint === 0x000d || // CR
    codepoint === 0x0009 // tab
  );
}

/**
 * needsFullFont — text 내 codepoint 1개라도 subset 범위 외이면 true.
 *   text 미공급(빈 문자열) → false (subset 충분).
 */
export function needsFullFont(text: string): boolean {
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (typeof cp !== "number") continue;
    if (!isInSubsetRange(cp)) return true;
  }
  return false;
}

/**
 * loadKoreanFont — text 분석 후 subset / full 자동 선택.
 *   text 미공급 → subset 반환.
 *   외부 문자 1자라도 있으면 풀폰트 lazy fetch.
 *   풀폰트 fetch 실패 → subset fallback + console.warn.
 */
export async function loadKoreanFont(text = ""): Promise<ArrayBuffer> {
  const useFullFont = text.length > 0 && needsFullFont(text);
  if (useFullFont) {
    try {
      return await loadFull();
    } catch (err) {
      if (typeof console !== "undefined") {
        console.warn(
          "[robusta] font-loader: full font fetch failed → subset fallback",
          err,
        );
      }
      // subset fallback
      return loadSubset();
    }
  }
  return loadSubset();
}

async function loadSubset(): Promise<ArrayBuffer> {
  if (subsetCache) return subsetCache;
  const res = await fetch(FONT_SUBSET_URL);
  if (!res.ok) {
    throw new Error(`subset font fetch failed: ${res.status}`);
  }
  const buf = await res.arrayBuffer();
  subsetCache = buf;
  return buf;
}

async function loadFull(): Promise<ArrayBuffer> {
  if (fullCache) return fullCache;
  const res = await fetch(FONT_FULL_URL);
  if (!res.ok) {
    throw new Error(`full font fetch failed: ${res.status}`);
  }
  const buf = await res.arrayBuffer();
  fullCache = buf;
  return buf;
}

/** 테스트용 — module cache 리셋. */
export function _resetCache(): void {
  subsetCache = null;
  fullCache = null;
}
