import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
// C-D36-1 (D-4 07시 슬롯, 2026-05-04) — Tori spec C-D36-1 (F-D36-1).
//   Hero LIVE indicator — D-Day(5/8) 자정 KST 정각 자동 노출. LIVE 미진입 시 null 렌더 (DOM 0).
import { HeroLiveBanner } from "@/modules/header/hero-live-banner";
// A-D54-자-1 (D-1 11시 슬롯, 2026-05-07) — Komi 자율 (§5 명세 미수신 / hero* 4 wiring 본체 큐 회복).
//   sr-only aria-live 영역 — SR 사용자가 LIVE 1h 안에 1회 alert. hero* 4 직접 변경 0.
//   release freeze 5/7 23:00 KST 정합 + 보존 13 v3 무손상.
import { HeroAriaLiveSlot } from "@/modules/launch/hero-aria-live-slot";
// C-D36-3 (D-4 07시 슬롯, 2026-05-04) — Tori spec C-D36-3 (F-D36-3).
//   visit funnel — 첫 마운트 sessionStorage 가드 1회 ping. PII 0.
import { VisitTracker } from "@/modules/funnel/visit-tracker";
// C-D40-2 (D-3 03시 슬롯, 2026-05-05) — Tori spec C-D40-2 (V-D40-2 + D-D40-1).
//   다크모드 토글 우상단 fixed — 'system'/'light'/'dark' 3-way cycle.
//   자율 정정 D-40-자-1/2: ui 모듈 + useThemeStore SoT (보존 13 v3 무손상).
import { DarkModeToggle } from "@/modules/ui/dark-mode-toggle";

/**
 * D-15.x (Day 4 19시 슬롯, 2026-04-29) C-D15-1: Open Graph + Twitter Card 메타 태그.
 *   B32-A 명세 §21.4.1 채택 — 정적 OG 메타 + og.png 1장.
 *   metadataBase 박아서 절대 URL 자동 생성. og.png는 public/og.png (1200×630, 노란 톤 #FFFCEB).
 *   회귀 위험 0 — 빌드 artifact <head>에만 영향, 1st Load JS 변경 0.
 *   추정 #88 — [locale] 라우트 미존재 (현재 단일 lang="ko") → ogLocale은 ko_KR 단정.
 */
export const metadata: Metadata = {
  metadataBase: new URL("https://robusta.ai4min.com"),
  title: "Robusta",
  description: "Human + Web AI + Code AI — three-way collaboration",
  // C-D17-7 (Day 5 07시, 2026-04-30): canonical 정의 — robots.ts/sitemap.ts와 묶음 SEO 시드.
  //   metadataBase 기준 절대 URL 자동 합성 ("/" → "https://robusta.ai4min.com/").
  alternates: { canonical: "/" },
  openGraph: {
    title: "Robusta — 인간 + AI 둘과 함께하는 협업",
    description:
      "BYOK + 인격/R&R + AI 자율 대화 스케줄. Blend의 80% 본질 + 차별화.",
    url: "https://robusta.ai4min.com",
    siteName: "Robusta",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Robusta — Roy + Tori + Komi",
      },
    ],
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Robusta — 인간 + AI 둘과 함께하는 협업",
    description: "BYOK + 인격/R&R + AI 자율 대화 스케줄.",
    images: ["/og.png"],
  },
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
 * C-D17-20 (Day 5 19시 슬롯, 2026-04-30) F-19 강화:
 *   - 우선순위 명시 — cookie > prefers-color-scheme > 'light'.
 *   - id-22 정합 — 사용자 명시(cookie) > 시스템 자동(prefers).
 *   - 기존 분기 로직 (`theme === "light" && cookies.length === 0 || ...`) 가독성 약함 → cookieFound 플래그로 정정.
 *   - matchMedia 미지원 (구형) → 'light' fallback.
 *   - theme.ts의 getInitialTheme()와 1:1 동일 로직 — 단위 검증은 TS 측에서 (#181~#183).
 *
 * 보안: 정적 텍스트 IIFE, 외부 입력 X → XSS 위험 없음.
 *   try/catch로 cookie 차단 환경(예: 일부 모바일 incognito)에서도 안전.
 */
const themeBootScript = `
(function() {
  try {
    var theme = null;
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
    if (theme === null) {
      // cookie 미등록 → prefers-color-scheme 폴백 (matchMedia 미지원이면 'light').
      if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
        theme = "dark";
      } else {
        theme = "light";
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
      <body>
        {/* C-D36-1 — Hero LIVE indicator. RELEASE_ISO 도달 시점부터 자동 노출, 그 전엔 null. */}
        <HeroLiveBanner />
        {/* A-D54-자-1 — sr-only aria-live region. LIVE 1h 안에 1회 SR alert. UI 시각 hidden. */}
        <HeroAriaLiveSlot />
        {/* C-D36-3 — visit funnel ping. 첫 마운트 1회. UI 미렌더 (null). */}
        <VisitTracker />
        {/* C-D40-2 — 다크모드 토글 우상단 fixed (3-way cycle). */}
        <DarkModeToggle />
        {children}
        {/* C-D17-8 (Day 5 07시 슬롯, 2026-04-30) — 똘이 v1 §16.3 B-12 채택:
            Vercel Web Analytics 페이지뷰만 (custom track() 호출 0 — BYOK 키·메시지 본문 누출 가드).
            Hobby 무료, no cookie, 24h 폐기. ad-blocker 차단 시 silent fail.
            정적 export(`output: "export"`) 모드에서도 클라 컴포넌트로 자동 hydrate. */}
        <Analytics />
      </body>
    </html>
  );
}
