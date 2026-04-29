/**
 * D-D16-2 (Day 4 23시 슬롯, 2026-04-29) C-D16-2: /sample 정적 데모 라우트 (F-D16-2).
 *   똘이 v12 §24.4.4 B-4 D1 자체 결정 정합 — 첫 방문자 BYOK 마찰 0 + 즉시 가치 체감.
 *   정적 prerender(SSG) — JSON build time embed, 외부 호출 0, 1st Load JS 가벼움.
 *   우상단 CTA "내 키로 시작하기" → /getting-started/byok (BYOK 페이지 정합).
 *
 *   회귀 위험 0 — 신규 라우트, 기존 라우트/컴포넌트 변경 0.
 *   초등학생 직관성 (Roy Do v24 id-15) 정합 — 메뉴 0, 본문만, 스크롤 1방향.
 */
import type { Metadata } from "next";
import Link from "next/link";
import sample from "@/data/sample-conversation.json";

export const metadata: Metadata = {
  title: "Robusta — 샘플 대화",
  description: "AI 둘과 함께한 브레인스토밍 1건 — Roy + Tori + Komi",
  openGraph: {
    title: "Robusta — 샘플 대화",
    description: "AI 둘과 함께한 브레인스토밍 1건",
    url: "https://robusta.ai4min.com/sample",
    images: ["/og.png"],
  },
};

interface Participant {
  id: string;
  name: string;
  role: "human" | "ai";
  model: string | null;
  color: string;
  avatarMonogram: string;
}

interface Message {
  speakerId: string;
  ts: string;
  body: string;
}

interface SampleData {
  title: string;
  subtitle: string;
  participants: Participant[];
  messages: Message[];
}

const data = sample as SampleData;

function formatTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export default function SamplePage() {
  const participantsById = new Map(
    data.participants.map((p) => [p.id, p] as const),
  );

  return (
    <main
      style={{
        maxWidth: "min(720px, 100% - 32px)",
        margin: "0 auto",
        padding: "32px 16px 96px",
        lineHeight: 1.6,
        fontSize: 15,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >
        <Link
          href="/"
          style={{ fontSize: 13, color: "#888", textDecoration: "none" }}
        >
          ← 홈으로
        </Link>
        <Link
          href="/getting-started/byok"
          data-test="sample-cta-byok"
          style={{
            fontSize: 13,
            padding: "8px 14px",
            borderRadius: 8,
            background: "#F5C518",
            color: "#1a1a1a",
            fontWeight: 600,
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          내 키로 시작하기 →
        </Link>
      </header>

      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
        {data.title}
      </h1>
      <p style={{ color: "#888", fontSize: 13, marginBottom: 32 }}>
        {data.subtitle}
      </p>

      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {data.messages.map((m, i) => {
          const p = participantsById.get(m.speakerId);
          if (!p) return null;
          return (
            <li
              key={i}
              data-test="sample-message"
              style={{
                display: "flex",
                gap: 12,
                marginBottom: 20,
                alignItems: "flex-start",
              }}
            >
              <div
                aria-hidden
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: `var(--${p.color}, #ccc)`,
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {p.avatarMonogram}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 8,
                    marginBottom: 4,
                    flexWrap: "wrap",
                  }}
                >
                  <strong style={{ fontSize: 14 }}>{p.name}</strong>
                  {p.role === "ai" && p.model && (
                    <span style={{ fontSize: 11, color: "#888" }}>
                      {p.model}
                    </span>
                  )}
                  <span style={{ fontSize: 11, color: "#888" }}>
                    {formatTime(m.ts)}
                  </span>
                </div>
                <p style={{ margin: 0, wordBreak: "keep-all" }}>{m.body}</p>
              </div>
            </li>
          );
        })}
      </ul>

      <footer
        style={{
          marginTop: 48,
          padding: "20px 0",
          borderTop: "1px solid #eee",
          textAlign: "center",
          fontSize: 13,
          color: "#888",
        }}
      >
        이 대화는 정적 샘플입니다.{" "}
        <Link
          href="/getting-started/byok"
          style={{ color: "#1a1a1a", fontWeight: 600 }}
        >
          내 키로 시작하기
        </Link>
        하면 실제 AI 둘과 대화할 수 있습니다.
      </footer>
    </main>
  );
}
