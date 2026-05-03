/**
 * /qatest — QA 테스트 모드 (개발 단계 한정).
 *
 * 목적:
 *   - Robusta 메인(`/`)은 BYOK only — 사용자가 자기 키 모달 입력.
 *   - 이 라우트만 trial 키(NEXT_PUBLIC_ANTHROPIC_API_KEY)를 사용해
 *     꼬미·똘이의 자동 슬롯이 라이브 API 동작을 검증할 수 있게 함.
 *
 * 격리 보장:
 *   - process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY는 이 파일에서만 참조.
 *   - Next.js webpack이 빌드 시 리터럴을 이 라우트의 chunk에만 인라인.
 *   - 메인 `/` 라우트 chunk에는 키 값 미포함 (`grep "sk-ant-" out/...` 으로 매 빌드 검증).
 *   - 메인 api-key-store에 키 주입 X — 이 페이지가 끝나면 자동 폐기.
 *
 * launch 직전 정리:
 *   1. `src/app/qatest/` 디렉토리 통째로 제거.
 *   2. Vercel env에서 `NEXT_PUBLIC_ANTHROPIC_API_KEY` 삭제.
 *   3. `grep "sk-ant-" out/` 0건 검증.
 */

"use client";

import { useState } from "react";
// C-D34-5 (D-5 23시 슬롯, 2026-05-03) — D-Day launch checklist 섹션 (B-D34-3 + D-D34-4 (c)).
//   /qatest 페이지 본체는 D-Day(5/8) 라이브 시 통째로 제거 — 본 섹션도 함께 폐기.
import { DDayChecklist } from "@/modules/qatest/d-day-checklist";

const TRIAL_KEY = process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY ?? "";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

function maskKey(k: string): string {
  if (k.length < 12) return "(too short)";
  return `${k.slice(0, 7)}...${k.slice(-4)}`;
}

type PingState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "ok"; status: number; modelEcho: string }
  | { kind: "fail"; status: number; reason: string };

export default function QaTestPage() {
  const [ping, setPing] = useState<PingState>({ kind: "idle" });

  const keyPresent = TRIAL_KEY.startsWith("sk-ant-") && TRIAL_KEY.length >= 30;

  async function runPing() {
    if (!keyPresent) {
      setPing({
        kind: "fail",
        status: 0,
        reason: "trial key 미설정 또는 형식 오류",
      });
      return;
    }
    setPing({ kind: "running" });
    try {
      // 1-token ping — 비용 ≈ $0.000003.
      // 2026-04-29: claude-3-5-haiku-latest는 deprecated (404 not_found_error).
      // 4.5 haiku로 교체. ping 비용 ~$0.000003 동일.
      const res = await fetch(ANTHROPIC_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": TRIAL_KEY,
          "anthropic-version": ANTHROPIC_VERSION,
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5",
          max_tokens: 1,
          messages: [{ role: "user", content: "ping" }],
        }),
      });
      const text = await res.text();
      if (res.ok) {
        let modelEcho = "(unknown)";
        try {
          const j = JSON.parse(text);
          modelEcho = j.model ?? modelEcho;
        } catch {
          /* ignore parse */
        }
        setPing({ kind: "ok", status: res.status, modelEcho });
      } else {
        setPing({
          kind: "fail",
          status: res.status,
          reason: text.slice(0, 240),
        });
      }
    } catch (e) {
      setPing({
        kind: "fail",
        status: 0,
        reason: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return (
    <main className="mx-auto max-w-xl p-6 font-sans">
      <div
        className="mb-6 rounded border-l-4 px-3 py-2 text-sm"
        style={{
          background: "#FFF4E0",
          borderColor: "#FF9F43",
          color: "#603A00",
        }}
      >
        <strong>⚠ QA Test Mode (Dev only)</strong>
        <br />
        이 페이지는 개발 단계 trial 키 검증 전용. 메인 <code>/</code>은 BYOK only.
        production launch 직전 이 라우트는 통째로 제거됩니다.
      </div>

      <h1 className="mb-3 text-xl font-semibold">Robusta · QA Test</h1>

      <section className="mb-5 space-y-1 text-sm">
        <div>
          <span className="font-medium">Trial key 상태:</span>{" "}
          {keyPresent ? (
            <span style={{ color: "#0A7B3F" }}>
              ✅ 로드됨 ({maskKey(TRIAL_KEY)})
            </span>
          ) : (
            <span style={{ color: "#B33A1F" }}>
              ❌ 미설정 (Vercel env <code>NEXT_PUBLIC_ANTHROPIC_API_KEY</code>{" "}
              필요)
            </span>
          )}
        </div>
        <div>
          <span className="font-medium">메인 라우트 영향:</span> 없음 (이 키는{" "}
          <code>/qatest</code> chunk에만 인라인됨)
        </div>
      </section>

      <button
        type="button"
        onClick={runPing}
        disabled={ping.kind === "running"}
        className="rounded px-4 py-2 text-sm font-medium"
        style={{
          background: ping.kind === "running" ? "#CCCCCC" : "#222222",
          color: "white",
          cursor: ping.kind === "running" ? "wait" : "pointer",
        }}
      >
        {ping.kind === "running" ? "Pinging..." : "Run 1-token ping"}
      </button>

      {ping.kind !== "idle" && (
        <div
          className="mt-4 rounded border p-3 text-sm"
          style={{
            background:
              ping.kind === "ok"
                ? "#E6F4EA"
                : ping.kind === "fail"
                  ? "#FCE4E4"
                  : "#F2F2F2",
            borderColor:
              ping.kind === "ok"
                ? "#0A7B3F"
                : ping.kind === "fail"
                  ? "#B33A1F"
                  : "#999",
          }}
        >
          {ping.kind === "running" && <span>요청 중...</span>}
          {ping.kind === "ok" && (
            <>
              <strong>✅ {ping.status} OK</strong>
              <br />
              model echo: <code>{ping.modelEcho}</code>
              <br />
              비용: 약 $0.000003 (max_tokens=1)
            </>
          )}
          {ping.kind === "fail" && (
            <>
              <strong>❌ {ping.status || "ERROR"}</strong>
              <br />
              <code style={{ wordBreak: "break-all" }}>{ping.reason}</code>
            </>
          )}
        </div>
      )}

      <hr className="my-6" />

      <section className="text-xs text-gray-600">
        <p>
          <strong>다음 똘이 슬롯 큐:</strong> 이 페이지를 풀 QA 시나리오로 확장
          (다자 대화 자동 시퀀스 / SSE 검증 / round-robin 라이브 캡처).
          현재는 ping만으로 trial 키 wiring·CORS·격리 검증.
        </p>
      </section>

      {/* C-D34-5 (D-5 23시 슬롯, 2026-05-03) — D-Day launch checklist 섹션. */}
      <DDayChecklist />
    </main>
  );
}
