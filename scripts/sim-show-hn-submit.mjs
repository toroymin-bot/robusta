#!/usr/bin/env node
/**
 * sim-show-hn-submit.mjs
 *   - C-D55-1 (D-1 13시 슬롯, 2026-05-07) — Tori spec C-D55-1 (B-D52-3 §10 dry-run sim 흡수).
 *
 * Why: Show HN submit 5/7 22:00 KST 정각 dry-run sim — URL/title/body 정합 + length ratio 0.4 SoT 검증.
 *   B-D52-3 (5/7 20:00 KST T-2h dry-run sim) + B-D52-4 (§11 카피 final lock) 정합.
 *   D-53-자-1 (CLI .mjs ↔ .ts 산식 미러 SoT) 패턴 정합 — show-hn-submit-config.ts 와 1:1.
 *
 * 함수 시그니처:
 *   simShowHnSubmit({ now, releaseUrl, titleKo, titleEn, bodyKo, bodyEn })
 *     -> { ok: boolean, errors: string[], summary: { url, title, bodyLength, lengthRatio } }
 *
 * 검증 룰 (length ratio 0.4 SoT — D-D53-자-2 → §7 정식 승격):
 *   - URL: https:// 시작 + 호스트 'robusta.ai4min.com' OR '*.vercel.app' (KQ_23 fallback 정합).
 *   - title: ≤ 80 chars (HN limit), 이모지 0.
 *   - body: ≤ 800 chars.
 *   - length ratio: |titleKo.length - titleEn.length| / max(...) ≤ 0.4.
 *   - now < 22:00 KST → errors 에 T-${minutes}m 경고 (ok=true 유지).
 *   - now ≥ 22:00 KST → 정합 통과.
 *
 * 5 케이스 (5/5 PASS 의무):
 *   1) 정합 — robusta.ai4min.com + ko/en title/body (KQ_23 회복 후)
 *   2) KQ_23 fallback — *.vercel.app preview URL (잡음 0 의무)
 *   3) title 80자 초과 → ok=false (실패 정합)
 *   4) length ratio 0.5 초과 → ok=false (실패 정합)
 *   5) URL 프로토콜 누락 → ok=false (실패 정합)
 *
 * C-D56-1 (D-1 19시 슬롯, 2026-05-07) — case 6 OCP append (기존 5 변경 0):
 *   6) T-30m 사전 경고 — now=2026-05-07T21:30+09:00 → warn: prefix + ok=true 유지.
 *      'warn:' prefix 분기는 기존 line 122 단계 5 산식 그대로 (분기 추가 0).
 *
 * 외부 dev-deps +0 (node 표준만).
 */

const HN_TITLE_MAX = 80;
const HN_BODY_MAX = 800;
const LENGTH_RATIO_MAX = 0.4;
const SUBMIT_DEADLINE_KST = "2026-05-07T22:00:00+09:00";

// 이모지 검출 — Unicode emoji 범위 (저자 의도 0).
const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F600}-\u{1F64F}]/u;

/**
 * simShowHnSubmit — Show HN submit 정합 검증.
 *   순수 함수 (외부 부수효과 0).
 */
export function simShowHnSubmit(input) {
  const { now, releaseUrl, titleKo, titleEn, bodyKo, bodyEn } = input;
  const errors = [];

  // 1) URL: https:// + 호스트 화이트리스트.
  let urlOk = false;
  try {
    if (typeof releaseUrl !== "string" || !releaseUrl.startsWith("https://")) {
      errors.push(`url: missing https:// protocol (got '${releaseUrl}')`);
    } else {
      const u = new URL(releaseUrl);
      if (
        u.host === "robusta.ai4min.com" ||
        /\.vercel\.app$/.test(u.host)
      ) {
        urlOk = true;
      } else {
        errors.push(`url: unexpected host '${u.host}'`);
      }
    }
  } catch {
    errors.push(`url: invalid URL '${releaseUrl}'`);
  }

  // 2) title 정합 (en 본체 + ko 운영 백업).
  if (typeof titleEn !== "string" || titleEn.length === 0) {
    errors.push("titleEn: missing");
  } else if (titleEn.length > HN_TITLE_MAX) {
    errors.push(`titleEn: ${titleEn.length} > ${HN_TITLE_MAX}`);
  } else if (EMOJI_RE.test(titleEn)) {
    errors.push("titleEn: emoji forbidden");
  } else if (!titleEn.startsWith("Show HN:")) {
    errors.push("titleEn: must start with 'Show HN:'");
  }
  if (typeof titleKo !== "string" || titleKo.length === 0) {
    errors.push("titleKo: missing");
  } else if (titleKo.length > HN_TITLE_MAX) {
    errors.push(`titleKo: ${titleKo.length} > ${HN_TITLE_MAX}`);
  } else if (EMOJI_RE.test(titleKo)) {
    errors.push("titleKo: emoji forbidden");
  }

  // 3) body 정합.
  if (typeof bodyEn !== "string" || bodyEn.length === 0) {
    errors.push("bodyEn: missing");
  } else if (bodyEn.length > HN_BODY_MAX) {
    errors.push(`bodyEn: ${bodyEn.length} > ${HN_BODY_MAX}`);
  }
  if (typeof bodyKo !== "string" || bodyKo.length === 0) {
    errors.push("bodyKo: missing");
  } else if (bodyKo.length > HN_BODY_MAX) {
    errors.push(`bodyKo: ${bodyKo.length} > ${HN_BODY_MAX}`);
  }

  // 4) length ratio 0.4 SoT (titleKo / titleEn).
  let lengthRatio = 0;
  if (
    typeof titleKo === "string" &&
    typeof titleEn === "string" &&
    titleKo.length > 0 &&
    titleEn.length > 0
  ) {
    const maxLen = Math.max(titleKo.length, titleEn.length);
    lengthRatio = Math.abs(titleKo.length - titleEn.length) / maxLen;
    if (lengthRatio > LENGTH_RATIO_MAX) {
      errors.push(
        `lengthRatio: ${lengthRatio.toFixed(3)} > ${LENGTH_RATIO_MAX}`,
      );
    }
  }

  // 5) now < 22:00 KST → T-${minutes}m 경고 (ok=true 유지).
  if (typeof now === "string" && now.length > 0) {
    const nowMs = new Date(now).getTime();
    const deadlineMs = new Date(SUBMIT_DEADLINE_KST).getTime();
    if (Number.isFinite(nowMs) && Number.isFinite(deadlineMs)) {
      if (nowMs < deadlineMs) {
        const minutes = Math.ceil((deadlineMs - nowMs) / 60000);
        errors.push(`warn: T-${minutes}m before 22:00 KST submit deadline`);
      }
    }
  }

  // ok 판정 — 'warn:' prefix 는 실패 비유발.
  const hardErrors = errors.filter((e) => !e.startsWith("warn:"));
  const ok = hardErrors.length === 0 && urlOk;

  return {
    ok,
    errors,
    summary: {
      url: releaseUrl ?? "",
      title: titleEn ?? "",
      bodyLength: typeof bodyEn === "string" ? bodyEn.length : 0,
      lengthRatio,
    },
  };
}

function pass(label) {
  console.log(`  ✓ ${label}`);
}
function fail(label, msg) {
  console.error(`  ✗ ${label} — ${msg}`);
  process.exitCode = 1;
}

function main() {
  console.log(
    "sim:show-hn-submit — Show HN submit 5/7 22:00 KST dry-run 5 케이스",
  );

  const validKoTitle =
    "Show HN: Robusta — BYOK 다자(多者) AI 라운드테이블, 통찰을 길어 올리는 회의실";
  const validEnTitle =
    "Show HN: Robusta — BYOK roundtable to brainstorm with multiple AIs at once";
  const validKoBody = "한국어 본문 — 길이 충분 (≥1).".repeat(5);
  const validEnBody = "Robusta is a roundtable for AIs.".repeat(5);

  // 1) 정합 — robusta.ai4min.com + ko/en (KQ_23 회복 후, 22:00 KST 정각).
  {
    const r = simShowHnSubmit({
      now: "2026-05-07T22:00:00+09:00",
      releaseUrl: "https://robusta.ai4min.com",
      titleKo: validKoTitle,
      titleEn: validEnTitle,
      bodyKo: validKoBody,
      bodyEn: validEnBody,
    });
    if (r.ok && r.errors.length === 0) {
      pass(`1. 정합 (robusta.ai4min.com, ratio=${r.summary.lengthRatio.toFixed(3)})`);
    } else {
      fail(
        "1. 정합",
        `ok=${r.ok}, errors=${JSON.stringify(r.errors)}`,
      );
    }
  }

  // 2) KQ_23 fallback — *.vercel.app preview URL.
  {
    const r = simShowHnSubmit({
      now: "2026-05-07T22:00:00+09:00",
      releaseUrl: "https://robusta-staging.vercel.app",
      titleKo: validKoTitle,
      titleEn: validEnTitle,
      bodyKo: validKoBody,
      bodyEn: validEnBody,
    });
    if (r.ok && r.errors.length === 0) {
      pass("2. KQ_23 fallback (*.vercel.app preview URL — 잡음 0)");
    } else {
      fail(
        "2. fallback",
        `ok=${r.ok}, errors=${JSON.stringify(r.errors)}`,
      );
    }
  }

  // 3) title 80자 초과 → ok=false.
  {
    const tooLong = "Show HN: " + "x".repeat(85);
    const r = simShowHnSubmit({
      now: "2026-05-07T22:00:00+09:00",
      releaseUrl: "https://robusta.ai4min.com",
      titleKo: validKoTitle,
      titleEn: tooLong,
      bodyKo: validKoBody,
      bodyEn: validEnBody,
    });
    if (!r.ok && r.errors.some((e) => /titleEn:/.test(e))) {
      pass(
        `3. title 80자 초과 → ok=false (titleEn=${tooLong.length} > 80)`,
      );
    } else {
      fail(
        "3. title 초과",
        `expected ok=false, got ok=${r.ok}, errors=${JSON.stringify(r.errors)}`,
      );
    }
  }

  // 4) length ratio 0.5 초과 → ok=false.
  {
    const shortKo = "Show HN: 짧음"; // 12 chars
    const longEn = "Show HN: " + "y".repeat(60); // 69 chars → ratio = (69-12)/69 = 0.826 > 0.4
    const r = simShowHnSubmit({
      now: "2026-05-07T22:00:00+09:00",
      releaseUrl: "https://robusta.ai4min.com",
      titleKo: shortKo,
      titleEn: longEn,
      bodyKo: validKoBody,
      bodyEn: validEnBody,
    });
    if (!r.ok && r.errors.some((e) => /lengthRatio:/.test(e))) {
      pass(
        `4. length ratio 0.4 초과 → ok=false (ratio=${r.summary.lengthRatio.toFixed(3)})`,
      );
    } else {
      fail(
        "4. ratio 초과",
        `expected ok=false, got ok=${r.ok}, errors=${JSON.stringify(r.errors)}`,
      );
    }
  }

  // 5) URL 프로토콜 누락 → ok=false.
  {
    const r = simShowHnSubmit({
      now: "2026-05-07T22:00:00+09:00",
      releaseUrl: "robusta.ai4min.com",
      titleKo: validKoTitle,
      titleEn: validEnTitle,
      bodyKo: validKoBody,
      bodyEn: validEnBody,
    });
    if (!r.ok && r.errors.some((e) => /url:/.test(e))) {
      pass("5. URL 프로토콜 누락 → ok=false");
    } else {
      fail(
        "5. URL 프로토콜",
        `expected ok=false, got ok=${r.ok}, errors=${JSON.stringify(r.errors)}`,
      );
    }
  }

  // 6) T-30m 사전 경고 → warn: prefix + ok=true 유지 (C-D56-1 OCP append).
  {
    const r = simShowHnSubmit({
      now: "2026-05-07T21:30:00+09:00",
      releaseUrl: "https://robusta.ai4min.com",
      titleKo: validKoTitle,
      titleEn: validEnTitle,
      bodyKo: validKoBody,
      bodyEn: validEnBody,
    });
    const warnFound = r.errors.some((e) => /^warn: T-30m/.test(e));
    if (r.ok && warnFound) {
      pass("6. T-30m 사전 경고 → warn: prefix + ok=true (C-D56-1)");
    } else {
      fail(
        "6. T-30m warning",
        `expected ok=true with 'warn: T-30m' prefix, got ok=${r.ok}, errors=${JSON.stringify(r.errors)}`,
      );
    }
  }

  if (process.exitCode === 1) {
    console.error("sim:show-hn-submit — FAIL");
  } else {
    console.log("sim:show-hn-submit — 6/6 PASS");
  }
}

// 직접 실행 시에만 main (import 시에는 simShowHnSubmit export 만 사용).
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
