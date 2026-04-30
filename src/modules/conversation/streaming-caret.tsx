"use client";

// D-D17 (Day 5 11시 슬롯, 2026-04-30) C-D17-11: D-9 다크 모드 콘트라스트 정정.
// ~~text-robusta-accent~~ → text-robusta-ink-dim.
//   사유: 라이트 모드 accent(#C9A227) on canvas(#FFFCEB) 콘트라스트 = 2.35 (AA large 3.0 미달).
//         ink-dim(#5C5849) on canvas(#FFFCEB) = 6.91 (AA normal pass).
//         시각 신호는 animate-pulse 자체로 충분 — 색상 강도는 ink-dim으로 충분.
export function StreamingCaret() {
  return (
    <span
      aria-hidden
      className="ml-0.5 inline-block animate-pulse text-robusta-ink-dim"
      style={{ animationDuration: "700ms" }}
    >
      ▍
    </span>
  );
}
