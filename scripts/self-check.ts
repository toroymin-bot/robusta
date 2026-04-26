import { composeSystemPrompt } from "../src/modules/conversation/system-prompt-composer";
import {
  hueToHsl,
  nextParticipantHue,
  parseHueFromColor,
} from "../src/modules/participants/participant-color";
import { DEFAULT_PARTICIPANTS } from "../src/modules/participants/participant-seed";
import type { Participant } from "../src/modules/participants/participant-types";

let failed = 0;
let passed = 0;

function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    passed += 1;
    process.stdout.write(`  PASS  ${label}\n`);
  } else {
    failed += 1;
    process.stdout.write(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}\n`);
  }
}

{
  const tori = DEFAULT_PARTICIPANTS.find((p) => p.id === "tori")!;
  const out = composeSystemPrompt({
    speaker: tori,
    participants: DEFAULT_PARTICIPANTS,
    locale: "ko",
  });
  check("composer: 자기 정체 카피", out.includes('너는 "똘이"이다'));
  check(
    "composer: 참여자 3명 모두 표시",
    out.includes("로이") && out.includes("똘이") && out.includes("꼬미"),
  );
  const markerMatches = out.match(/← 너/g) ?? [];
  check(
    "composer: 발언자 마커 정확히 1개",
    markerMatches.length === 1,
    `count=${markerMatches.length}`,
  );
  check("composer: [규칙] 섹션 포함", out.includes("[규칙]"));
}

{
  const tori = DEFAULT_PARTICIPANTS.find((p) => p.id === "tori")!;
  const out = composeSystemPrompt({
    speaker: { ...tori, systemPrompt: "" },
    participants: DEFAULT_PARTICIPANTS,
  });
  check("composer: 빈 systemPrompt → 추가 섹션 미포함", !out.includes("[너의 추가 인격/R&R]"));
}

{
  const roy = DEFAULT_PARTICIPANTS.find((p) => p.id === "roy")!;
  let threw = false;
  try {
    composeSystemPrompt({ speaker: roy, participants: DEFAULT_PARTICIPANTS });
  } catch {
    threw = true;
  }
  check("composer: human speaker → throw", threw);
}

{
  const tori = DEFAULT_PARTICIPANTS.find((p) => p.id === "tori")!;
  const out = composeSystemPrompt({
    speaker: tori,
    participants: DEFAULT_PARTICIPANTS,
    locale: "en",
  });
  check("composer: en locale → ko fallback", out.includes("[규칙]"));
}

{
  const seeds = [20, 200, 130];
  const fourth = nextParticipantHue(seeds);
  check("hue: 4번째 = 280", fourth === 280, `got ${fourth}`);
  const fifth = nextParticipantHue([...seeds, fourth]);
  check("hue: 5번째 = 50", fifth === 50, `got ${fifth}`);
  const sixth = nextParticipantHue([...seeds, fourth, fifth]);
  check("hue: 6번째 = 320", sixth === 320, `got ${sixth}`);
}

{
  const used = [20, 200, 130, 280, 50, 320];
  const seventh = nextParticipantHue(used);
  const minDelta = used.reduce((acc, h) => {
    const diff = Math.abs(h - seventh);
    return Math.min(acc, Math.min(diff, 360 - diff));
  }, 360);
  check("hue: 7번째 ≥ 30° 거리", minDelta >= 30, `delta=${minDelta} val=${seventh}`);
}

{
  const out: Participant = DEFAULT_PARTICIPANTS[1]!;
  check("color: tori 시드에서 hue 200 추출", parseHueFromColor(out.color) === 200);
  check("color: 잘못된 색은 null", parseHueFromColor("not-a-color") === null);
}

{
  check("color: hueToHsl(-30) → hsl 양수", hueToHsl(-30) === "hsl(330 65% 55%)");
  check("color: hueToHsl(390) → hsl(30 …)", hueToHsl(390) === "hsl(30 65% 55%)");
}

process.stdout.write(`\nPASSED ${passed} · FAILED ${failed}\n`);
if (failed > 0) process.exit(1);
