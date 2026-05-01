/**
 * C-D17-7 (Day 5 07시 슬롯, 2026-04-30) — sitemap.xml 정적 export.
 *   똘이 v1 §16.2 B-14 채택 — robots.txt + sitemap.xml + canonical 묶음 SEO 시드.
 *   Next.js 15 app router 파일 컨벤션: src/app/sitemap.ts → /sitemap.xml로 빌드 시점 정적 export.
 *   `output: "export"` 모드 호환 — out/sitemap.xml 산출.
 *
 *   라우트는 src/app 트리 enumerate 결과:
 *     /            (layout.tsx + page.tsx)
 *     /sample      (sample/page.tsx)
 *     /getting-started/byok  (getting-started/byok/page.tsx)
 *     /qatest      (qatest/page.tsx) — 검증용 내부 페이지, sitemap 제외 (검색 노출 의도 없음)
 *
 *   추정 #93 검증 결과: [locale] 라우트 미존재 → 단일 경로만 정의.
 *   추정 #94 검증 결과: src/app/api/ 미존재 → 별도 disallow 불요 (robots.ts에서 미래 가드).
 *
 *   회귀 위험 0 — 신규 정적 메타 라우트, 1st Load JS 영향 0 (RSC 빌드 타임 only).
 */

import type { MetadataRoute } from "next";

// `output: "export"` 정적 모드 호환 — Next.js 15 메타 라우트 정적 평가 명시.
export const dynamic = "force-static";

const BASE = "https://robusta.ai4min.com";

export default function sitemap(): MetadataRoute.Sitemap {
  // 빌드 시점 1회 evaluate — `output: "export"`에서 정적 XML 산출. 동적 갱신 X.
  const lastModified = new Date();
  return [
    {
      url: `${BASE}/`,
      lastModified,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${BASE}/sample`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${BASE}/getting-started/byok`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];
}
