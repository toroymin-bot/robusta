/**
 * auto-mark-vocab.ts
 *   - C-D26-1 (D6 11시 슬롯, 2026-05-02) — Tori spec C-D26-1 (B-61/F-61/D-61).
 *
 * Why 분리: vocab 사전을 dynamic chunk 로 분리 → auto-mark.ts 메인 번들 영향 0.
 *   v0 (C-D25-1) 은 ko/en 각 5단어 = 30. v1 은 각 8단어 = 48 으로 확장.
 *   의미 강도: newView > counter > augment.
 *
 * 호출자: auto-mark.ts inferInsightKind 내부에서 await import("./auto-mark-vocab").
 */

/** 반대 근거 vocab — 각 8단어. */
export const COUNTER_VOCAB_KO = [
  "하지만",
  "그러나",
  "반면",
  "오히려",
  "반대로",
  "그럼에도",
  "달리 보면",
  "다만",
] as const;
export const COUNTER_VOCAB_EN = [
  "however",
  "but ",
  "on the other hand",
  "instead",
  "rather",
  "whereas",
  "although",
  "yet ",
] as const;

/** 보완 vocab — 각 8단어. */
export const AUGMENT_VOCAB_KO = [
  "덧붙여",
  "추가로",
  "또한",
  "거기에",
  "게다가",
  "나아가",
  "더불어",
  "아울러",
] as const;
export const AUGMENT_VOCAB_EN = [
  "also",
  "in addition",
  "moreover",
  "furthermore",
  "on top of",
  "additionally",
  "besides",
  "plus",
] as const;

/** 다른 시각 vocab — 각 8단어. (counter 보다 우선 — 의미 강도 최상). */
export const NEWVIEW_VOCAB_KO = [
  "다르게 보면",
  "다른 시각",
  "관점을 바꾸면",
  "한편",
  "시각을 달리하면",
  "뒤집어보면",
  "한 발 물러서서",
  "근본적으로",
] as const;
export const NEWVIEW_VOCAB_EN = [
  "another view",
  "differently",
  "from another angle",
  "alternatively",
  "another perspective",
  "stepping back",
  "fundamentally",
  "reframing",
] as const;
