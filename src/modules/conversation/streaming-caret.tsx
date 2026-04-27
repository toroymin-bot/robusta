"use client";

export function StreamingCaret() {
  return (
    <span
      aria-hidden
      className="ml-0.5 inline-block animate-pulse text-robusta-accent"
      style={{ animationDuration: "700ms" }}
    >
      ▍
    </span>
  );
}
