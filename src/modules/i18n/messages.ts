/**
 * messages.ts — F-copy-1 (Day 4, 2026-04-29) 한/영 카피 동기화.
 *   명세 Komi_Spec_Day4_Persona_2026-04-29 §6 표 기반 22+ 키.
 *
 * D-9.3 다국어 라우팅(P1)이 들어오면 useLocale 훅이 URL 첫 세그먼트로 결정.
 *   현재(D4 P0)는 'ko' default + 'en' 파일만 박아둠 — 호출자는 t(key)로 ko 값을 받음.
 *
 * 카피 변수: {name}, {from}, {to} 등은 호출자가 string.replace 처리.
 *   복잡한 ICU 포맷이 필요하면 D-9.3에서 라이브러리 검토 (formatjs/lingui — 의존성 비용 trade-off).
 */

export type Locale = "ko" | "en";

export const MESSAGES = {
  ko: {
    // 헤더
    "header.title": "Robusta — Day 4 · 인격",
    "header.keys": "⚙ 키",

    // 참여자 카드
    "card.persona": "⚙ 인격 설정",

    // 모달
    "modal.title.ai": "인격 / R&R 설정",
    "modal.title.human": "참여자 정보",
    "modal.field.name": "이름 (1~30자)",
    "modal.field.role": "역할 (선택, 40자 이내)",
    "modal.field.systemPrompt": "인격 프롬프트 (선택, 1500자 이내)",
    "modal.field.model": "모델",
    "modal.action.save": "저장",
    "modal.action.cancel": "취소",
    "modal.err.nameEmpty": "이름은 비워둘 수 없습니다.",
    "modal.err.nameLength": "이름은 1~30자 사이.",
    "modal.err.roleLength": "역할은 40자 이내.",
    "modal.err.systemPromptLength": "인격 프롬프트는 1500자 이내.",
    "modal.hint.humanOnly": "인격 프롬프트는 AI 참여자에만 적용됩니다.",

    // 토스트
    "toast.persona.saved": "{name} 저장됨",
    "toast.fallback": "{from} 미사용 → {to} 폴백",
    "toast.error.network": "네트워크 오류 — 재시도하세요",

    // 버튼
    "action.nextTurn": "▶ 다음 발언",
    "action.retry": "↻ 재전송",
    "action.stop": "⏹ 정지",

    // 입력바
    "input.placeholder": "메시지를 입력하세요…",
  },
  en: {
    "header.title": "Robusta — Day 4 · Persona",
    "header.keys": "⚙ Keys",

    "card.persona": "⚙ Persona",

    "modal.title.ai": "Persona / R&R",
    "modal.title.human": "Participant",
    "modal.field.name": "Name (1–30 chars)",
    "modal.field.role": "Role (optional, ≤40 chars)",
    "modal.field.systemPrompt": "Persona prompt (optional, ≤1500 chars)",
    "modal.field.model": "Model",
    "modal.action.save": "Save",
    "modal.action.cancel": "Cancel",
    "modal.err.nameEmpty": "Name cannot be empty.",
    "modal.err.nameLength": "Name must be 1–30 chars.",
    "modal.err.roleLength": "Role must be ≤40 chars.",
    "modal.err.systemPromptLength": "Persona prompt must be ≤1500 chars.",
    "modal.hint.humanOnly": "Persona prompt applies to AI participants only.",

    "toast.persona.saved": "{name} saved",
    "toast.fallback": "{from} unavailable → fell back to {to}",
    "toast.error.network": "Network error — please retry",

    "action.nextTurn": "▶ Next turn",
    "action.retry": "↻ Retry",
    "action.stop": "⏹ Stop",

    "input.placeholder": "Type a message…",
  },
} as const satisfies Record<Locale, Record<string, string>>;

export type MessageKey = keyof (typeof MESSAGES)["ko"];

/**
 * 카피 조회. {var} 치환 지원.
 *   D-9.3 라우팅 도입 전: locale 파라미터 미지정 시 'ko' default.
 *   미존재 키는 키 문자열 그대로 반환 (운영 중 문제 가시화).
 */
export function t(
  key: MessageKey,
  vars?: Record<string, string | number>,
  locale: Locale = "ko",
): string {
  const dict = MESSAGES[locale] ?? MESSAGES.ko;
  let out: string = dict[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      out = out.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return out;
}
