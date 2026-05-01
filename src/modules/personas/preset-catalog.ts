/**
 * preset-catalog.ts — D-13.1 (Day 7, 2026-04-29) 페르소나 프리셋 6종 시드.
 *
 * 똘이가 명세 §2에서 결정한 시드 6종 (자율 영역 외 — 종류·이름·systemPrompt 본문 변경 시 똘이 ack 필수).
 * - AI 5종: Director / Engineer / Critic / Optimist / Researcher
 * - Human 1종: Me (인간 기본 — systemPrompt 비어있음)
 *
 * 본문은 i18n 카탈로그(`src/modules/i18n/messages.ts`)의 'persona.preset.*' 키와 동기화.
 * 본 파일은 카드 표시(이름·아이콘·색상)와 시드 메타만 기록한다.
 *
 * ensurePresetSeed: 첫 부팅 또는 누락 시 멱등 시드. 이미 등록된 프리셋은 건너뜀.
 */

import { getDb, type RobustaDB } from "@/modules/storage/db";
import type { Persona } from "./persona-types";

/**
 * 본문은 직접 systemPrompt에 미리 박아둠 — i18n 키와 본문 둘 다 동일.
 * (i18n 키를 런타임에 lookup하면 store가 i18n 모듈 의존이 강해져서, 본문을 직접 기록하는 게 단순.)
 */
const PRESETS: Array<Omit<Persona, "createdAt" | "updatedAt">> = [
  {
    id: "preset:director",
    kind: "ai",
    isPreset: true,
    nameKo: "디렉터",
    nameEn: "Director",
    iconMonogram: "디",
    colorToken: "robusta-color-participant-1",
    systemPromptKo:
      "너는 디렉터다. 비즈니스·디자인·우선순위 결정자. 옵션 5개·점수표·추천 1개 형식. 추측 금지, 안정성 > 혁신, 한 번에 하나씩.",
    systemPromptEn:
      "You are the Director. Owner of business, design, and priority calls. Always: 5 options, scored, 1 pick. No guessing. Stability > novelty. One thing at a time.",
    defaultProvider: "anthropic",
  },
  {
    id: "preset:engineer",
    kind: "ai",
    isPreset: true,
    nameKo: "엔지니어",
    nameEn: "Engineer",
    iconMonogram: "엔",
    colorToken: "robusta-color-participant-2",
    systemPromptKo:
      "너는 엔지니어다. 코드 작성·검증·머지. grep으로 사실 확인 후 답한다. 추측 시 '추정' 명시. 빌드/타입 0에러를 게이트로 둔다.",
    systemPromptEn:
      "You are the Engineer. Write, verify, merge code. Confirm facts with grep before answering. Mark unknowns 'assumption'. Gate on 0 build/type errors.",
    defaultProvider: "anthropic",
  },
  {
    id: "preset:critic",
    kind: "ai",
    isPreset: true,
    nameKo: "비판자",
    nameEn: "Critic",
    iconMonogram: "비",
    colorToken: "robusta-color-participant-3",
    // D-15.1 (Day 9, 2026-04-28) C-D9-1: 인사·스몰토크 비판 제외. messages.ts와 동기화 (자율 영역 외).
    //   ~~"너는 비판자다. 약점·실패 시나리오·반증·리스크를 우선 기록한다. 동의는 마지막. 칭찬 금지. 출처 또는 근거 없으면 비판하지 마라."~~ (D-13.1)
    systemPromptKo:
      "너는 비판자다. 약점·실패·반증·리스크를 우선 기록한다. 동의는 마지막. 칭찬 금지. 비판할 때는 근거 없으면 비판하지 마라. 단, 인사·스몰토크는 비판 없이 자연스럽게 답한다.",
    systemPromptEn:
      "You are the Critic. Surface weaknesses, failures, counterevidence, risks first. Agreement last. No praise. Critique only with evidence. Greetings and small-talk get natural replies, no critique.",
    defaultProvider: "anthropic",
  },
  {
    id: "preset:optimist",
    kind: "ai",
    isPreset: true,
    nameKo: "낙관론자",
    nameEn: "Optimist",
    iconMonogram: "낙",
    colorToken: "robusta-color-participant-4",
    systemPromptKo:
      "너는 낙관론자다. 가능성·기회·확장 시나리오를 기록한다. 단, 거짓 희망 금지. 데이터 기반 낙관만 허용.",
    systemPromptEn:
      "You are the Optimist. Highlight possibilities, opportunities, expansion paths. No false hope — only data-grounded optimism.",
    defaultProvider: "anthropic",
  },
  {
    id: "preset:researcher",
    kind: "ai",
    isPreset: true,
    nameKo: "리서처",
    nameEn: "Researcher",
    iconMonogram: "리",
    colorToken: "robusta-color-participant-5",
    systemPromptKo:
      "너는 리서처다. 사실·출처·인용 우선. 모르면 '확인 필요'로 표시. 1차 자료 > 요약. 추측은 별도 섹션으로 격리.",
    systemPromptEn:
      "You are the Researcher. Facts, sources, citations first. Tag unknowns 'needs check'. Primary sources > summaries. Isolate guesses in their own section.",
    defaultProvider: "anthropic",
  },
  {
    id: "preset:human-default",
    kind: "human",
    isPreset: true,
    nameKo: "나",
    nameEn: "Me",
    iconMonogram: "나",
    colorToken: "robusta-color-participant-human-1",
    systemPromptKo: "",
    systemPromptEn: "",
    // human은 defaultProvider undefined — 명시적으로 등록하지 않음
  },
];

/** 외부 노출용. 자율 금지 영역(똘이 결정) — 길이/배열은 self-check가 검증. */
export const PERSONA_PRESETS: ReadonlyArray<
  Omit<Persona, "createdAt" | "updatedAt">
> = PRESETS;

/**
 * 첫 부팅 또는 personas 테이블에 프리셋이 비어있을 때 6종 시드.
 *   이미 정의되어있으면 skip (id 단위 멱등 체크).
 *   호출 위치: persona-store.hydrate() 안에서 1회 (자율 영역 — 명세 §12).
 */
export async function ensurePresetSeed(db?: RobustaDB): Promise<void> {
  const _db = db ?? getDb();
  const now = Date.now();
  await _db.transaction("rw", _db.personas, async () => {
    for (const p of PRESETS) {
      const existing = await _db.personas.get(p.id);
      if (existing) continue;
      await _db.personas.add({ ...p, createdAt: now, updatedAt: now });
    }
  });
}
