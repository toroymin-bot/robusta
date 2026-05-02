/**
 * catalog-i18n.ts
 *   - C-D27-1 (D6 15시 슬롯, 2026-05-02) — Tori spec C-D27-1 (B-66/F-66/D-66).
 *
 * Why: catalog 5 namespace 전용 t() — messages.ts 본체 t() 와 분리.
 *   본 파일 자체가 messages-catalog-{ko,en}.ts 를 정적 import → catalog chunk 의 일부.
 *   호출자(persona-catalog-card 등 6 모듈)는 모두 lazy 모듈 또는 lazy 의존성 → 본 파일도 lazy chunk.
 *
 * ⚠ 가이드라인 (메인 번들 차단):
 *   conversation-workspace / header-cluster / participants-panel 등 메인 번들 모듈에서
 *   본 파일 정적 import 금지. verify-d27 가 grep 으로 검증.
 *
 * locale: ko default. en parity 미스 fallback ko.
 * vars: {key} 치환은 messages.ts 의 t() 와 동일 규약.
 *
 * OCP: 외부 의존 0 (messages-catalog-{ko,en} 만). 호출자 시그니처 = t() 와 1:1.
 */

import { MESSAGES_CATALOG_KO } from "./messages-catalog-ko";
import { MESSAGES_CATALOG_EN } from "./messages-catalog-en";
import type { Locale } from "./messages";

export type CatalogKey = keyof typeof MESSAGES_CATALOG_KO;

const CATALOG: Record<Locale, Record<string, string>> = {
  ko: MESSAGES_CATALOG_KO as unknown as Record<string, string>,
  en: MESSAGES_CATALOG_EN as unknown as Record<string, string>,
};

/**
 * catalog 키 5 prefix 판정. messages.ts 본체에 catalog 키 잘못 호출 시 verify 가 grep 으로 검출.
 *   loadCatalog / isCatalogKey 둘 다 i18n.ts 에 정의 — 본 파일은 sync lookup 만.
 */
export function tc(
  key: CatalogKey,
  vars?: Record<string, string | number>,
  locale: Locale = "ko",
): string {
  const dict = CATALOG[locale] ?? CATALOG.ko;
  let out: string = dict[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      out = out.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return out;
}
