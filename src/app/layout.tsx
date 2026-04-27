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
 * D-8.6 (P1) 깜빡임 방지 — 첫 페인트 직전에 localStorage / 시스템 prefers 기반
 * data-theme 속성을 <html>에 박는다. React hydration 전에 실행.
 *
 * 보안: 정적 텍스트만 박는 self-contained IIFE. 외부 입력 X → XSS 위험 없음.
 *   try/catch로 localStorage 차단(private browsing) 시에도 안전.
 */
const themeBootScript = `
(function() {
  try {
    var k = "robusta:theme";
    var stored = window.localStorage.getItem(k);
    var theme = (stored === "light" || stored === "dark") ? stored :
      (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
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
