/**
 * D-15.x (Day 4 19시 슬롯, 2026-04-29) C-D15-3: BYOK 시작 가이드 페이지.
 *   B28-B v2 명세 §20.2.2 채택 — KQ7-2 정정 룰 적용:
 *     - 영어 t-r-i-a-l 단어 절대 사용 안 함 (사실 오기재 회피)
 *     - "$5 크레딧" 단정 X → "콘솔에서 확인" 추상화
 *     - 모델 가격은 시점 박제 (2026-04-29 기준)
 *   라우트: /getting-started/byok (단일 — [locale] 폴더 미존재 추정 #88)
 *   회귀 위험 0 — 정적 페이지 1개 추가, 기존 라우트/컴포넌트 변경 X.
 *   1st Load 영향 ≤ 1KB (정적 HTML).
 */
import type { Metadata } from "next";

// D-D17-3 (Day 5 03시 슬롯, 2026-04-30) C-D17-3: og:image / twitter 메타 누락 정정.
//   똘이 v1 §1.3 V-3 부수 검증 — /getting-started/byok는 og:image 자체 누락 + twitter:image도 없음.
//   홈 / 와 동일한 og.png 1200×630 박음 (소셜 카드 일관성).
export const metadata: Metadata = {
  title: "BYOK 시작 — Robusta",
  description:
    "Anthropic API 키 1분 발급 가이드. Robusta는 사용자 본인의 API 키로 동작합니다.",
  openGraph: {
    title: "BYOK 시작 — Robusta",
    description: "Anthropic API 키 1분 발급 가이드.",
    url: "https://robusta.ai4min.com/getting-started/byok",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Robusta — Roy + Tori + Komi",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "BYOK 시작 — Robusta",
    description: "Anthropic API 키 1분 발급 가이드.",
    images: ["/og.png"],
  },
};

export default function ByokGuidePage() {
  return (
    <main
      style={{
        maxWidth: "min(720px, 100% - 32px)",
        margin: "0 auto",
        padding: "48px 16px",
        lineHeight: 1.7,
        fontSize: 16,
      }}
    >
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 16 }}>
        Robusta 시작 — Anthropic API 키 발급 (BYOK)
      </h1>

      <p style={{ marginBottom: 24 }}>
        Robusta는 사용자 본인의 API 키로 동작합니다 (BYOK). 1분이면 됩니다.
      </p>

      <ol style={{ paddingLeft: 20, marginBottom: 32 }}>
        <li style={{ marginBottom: 8 }}>
          <a
            href="https://platform.claude.com/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#1f6feb", textDecoration: "underline" }}
          >
            https://platform.claude.com/
          </a>
          {" "}에 사인업
        </li>
        <li style={{ marginBottom: 8 }}>
          콘솔 → API Keys → &ldquo;Create Key&rdquo;
        </li>
        <li style={{ marginBottom: 8 }}>
          발급된 키(<code>sk-ant-…</code>)를 복사 → Robusta 설정 → API Key 입력
        </li>
      </ol>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>비용</h2>

      <p style={{ marginBottom: 16 }}>
        Anthropic 콘솔의 사용량 페이지에서 직접 확인. 무료 크레딧 정책은
        사인업 시점 콘솔에서 안내됩니다 (정책은 변동 가능 — Anthropic 자체 결정).
      </p>

      <p style={{ marginBottom: 8, fontWeight: 600 }}>
        모델 가격 (2026-04-29 기준):
      </p>
      <ul style={{ paddingLeft: 20, marginBottom: 16 }}>
        <li>Sonnet 4.6 — $3 / $15 per MTok</li>
        <li>Haiku 4.5 — $1 / $5 per MTok</li>
        <li>Opus 4.7 — $5 / $25 per MTok</li>
      </ul>
      <p style={{ marginBottom: 32, color: "#5a5040" }}>
        배치 모드 사용 시 50% 할인 가능 (Anthropic Batches API).
      </p>

      <p style={{ fontSize: 14, color: "#888" }}>
        ↩{" "}
        <a
          href="/"
          style={{ color: "#1f6feb", textDecoration: "underline" }}
        >
          Robusta 홈
        </a>
      </p>
    </main>
  );
}
