import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Robusta",
  description: "Human + Web AI + Code AI — three-way collaboration",
};

export const viewport: Viewport = {
  themeColor: "#FFFCEB",
  width: "device-width",
  initialScale: 1,
};

/**
 * D-8.6 (P1, 2026-04-27) 깜빡임 방지 — 첫 페인트 직전에 ~~localStorage~~ → D-9.1: cookie 기반.
 *
 * D-9.1 변경:
 *   - 영구화 단일 진실 소스: IndexedDB(settings) — 비동기라 첫 페인트 read 불가.
 *   - 부트 hint: cookie 'robusta.theme.boot' 동기 read → <html data-theme> 즉시 적용.
 *   - 처음 방문자(쿠키 없음)는 시스템 prefers-color-scheme 폴백.
 *
 * 보안: 정적 텍스트 IIFE, 외부 입력 X → XSS 위험 없음.
 *   try/catch로 cookie 차단 환경(예: 일부 모바일 incognito)에서도 안전.
 */
const themeBootScript = `
(function() {
  try {
    var theme = "light";
    var cookies = document.cookie ? document.cookie.split(";") : [];
    for (var i = 0; i < cookies.length; i++) {
      var pair = cookies[i].split("=");
      var k = pair[0] && pair[0].trim();
      var v = pair[1] && pair[1].trim();
      if (k === "robusta.theme.boot" && (v === "light" || v === "dark")) {
        theme = v;
        break;
      }
    }
    if (theme === "light" && cookies.length === 0 || (theme === "light" && !document.cookie.match(/robusta\\.theme\\.boot=/))) {
      // cookie 미존재 → 시스템 prefers 폴백
      if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
        theme = "dark";
      }
    }
    document.documentElement.setAttribute("data-theme", theme);
    if (theme === "dark") document.documentElement.classList.add("dark");
  } catch (e) {
    document.documentElement.setAttribute("data-theme", "light");
  }
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        {/* 정적 텍스트, self-contained IIFE — XSS 안전 */}
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
