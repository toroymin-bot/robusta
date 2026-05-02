/**
 * i18n.ts
 *   - C-D27-1 (D6 15시 슬롯, 2026-05-02) — Tori spec C-D27-1.
 *
 * Why: catalog dynamic 진입점. 정적 catalog import 0 — 메인 번들 차단.
 *   호출자(lazy 모듈) 가 catalog-i18n.ts 의 sync `tc()` 를 사용한다.
 *   본 파일은 `loadCatalog(locale)` async + `isCatalogKey(key)` 만 노출 — 미래 lazy 분기 후크 + verify-d27 게이트.
 *
 * 사용처:
 *   - 미래 SSR 환경에서 catalog dynamic import 가 필요한 시점.
 *   - verify-d27 가 본 파일에서 loadCatalog / isCatalogKey export 존재 검증.
 *
 * OCP: messages.ts 본체 비파괴. catalog-i18n.ts 와 별도 — 호출자는 catalog-i18n.ts 의 tc() 사용.
 */

import type { Locale } from "./messages";

const CATALOG_PREFIXES = [
  "persona.catalog.",
  "persona.picker.tab.",
  "scenario.",
  "pdfExport.",
  "devMode.",
] as const;

/** catalog 키 prefix 판정 — verify-d27 가 grep 으로 별도 검증. */
export function isCatalogKey(key: string): boolean {
  for (const p of CATALOG_PREFIXES) {
    if (key.startsWith(p)) return true;
  }
  return false;
}

type CatalogModule = Record<string, string>;
const cache: { ko?: CatalogModule; en?: CatalogModule } = {};
const loading: { ko?: Promise<CatalogModule>; en?: Promise<CatalogModule> } = {};

/**
 * catalog locale 본체를 dynamic import — 메인 번들 차단.
 *   캐시 + race 가드. import 실패 시 throw 가능 (호출자가 fallback 처리).
 */
export async function loadCatalog(locale: Locale): Promise<CatalogModule> {
  if (cache[locale]) return cache[locale]!;
  if (loading[locale]) return loading[locale]!;
  loading[locale] = (async () => {
    if (locale === "ko") {
      const mod = await import("./messages-catalog-ko");
      cache.ko = mod.MESSAGES_CATALOG_KO as unknown as CatalogModule;
      return cache.ko;
    }
    const mod = await import("./messages-catalog-en");
    cache.en = mod.MESSAGES_CATALOG_EN as unknown as CatalogModule;
    return cache.en;
  })();
  return loading[locale]!;
}
