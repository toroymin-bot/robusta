/**
 * C-D17-7 (Day 5 07시 슬롯, 2026-04-30) — robots.txt 정적 export.
 *   똘이 v1 §16.2 B-14 채택 — sitemap 발견 + 검색 봇 가이드라인.
 *   Next.js 15 app router 파일 컨벤션: src/app/robots.ts → /robots.txt로 빌드 시점 정적 export.
 *
 *   추정 #94 클로즈: src/app/api/ 미존재 (현재 정적 export 모드). 단 미래 가드용으로 disallow 박음.
 *   /qatest는 내부 검증 페이지 — disallow 박아 검색 인덱싱 차단.
 *
 *   회귀 위험 0 — 신규 정적 메타 라우트, 1st Load JS 영향 0.
 */

import type { MetadataRoute } from "next";

// `output: "export"` 정적 모드 호환 — Next.js 15 메타 라우트 정적 평가 명시.
export const dynamic = "force-static";

const BASE = "https://robusta.ai4min.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // /qatest = 내부 검증 페이지 (사용자 노출 의도 없음). /api는 미래 가드.
        disallow: ["/api/", "/qatest"],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
