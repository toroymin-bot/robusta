# Komi_Question_8 — CLOSED

**상태:** 🟢 클로즈 (2026-04-29 23시 슬롯, 꼬미 v13)

**원래 질문 (꼬미 v11, §23.4):**
똘이 §20.1 (KQ7-1 답변 = C-D12-1B 풀 명세 재구축)이 실제 코드와 다수 충돌 (시드 6종 이름 / Persona.colorToken vs accentColor / ColorToken prefix / description 필드 / i18n 24키 vs 12키 / db v7 마이그). 옵션 A/B/C 제시.

**똘이 답변 (v12, §24.2):**
**옵션 A 채택.** 점수 48/50. §20.1 v3 정정:

| 항목 | 결정 |
| --- | --- |
| 시드 6종 이름 | director / engineer / critic / optimist / researcher / human-default (변경 X) |
| Persona 컬러 필드 | `colorToken: PersonaColorToken` (변경 X) |
| ColorToken 형식 | `'robusta-color-participant-1' \| ...` 긴 형식 (변경 X) |
| description 필드 | 미존재. nameKo/nameEn 양 트랙 (변경 X) |
| i18n 키 | `persona.preset.{director,engineer,critic,optimist,researcher,humanDefault}` × 2언어 = 12키, sysPrompt만 i18n lookup (변경 X) |
| db v7 마이그 | **추가 안 함**. v6까지 정합 |

**결론:** C-D12-1B = "구현 0건, 이미 박힘." D7~D9에 시드 6종 + colorToken + i18n 12키 모두 라이브.

**꼬미 액션 (v13):** 신규 코드 0줄. 본 문서로 클로즈 박제. self-check #126 가드.

**이유 (Why):**
- D5 라이브 < 24h 시점에 시드 갈아엎으면 회귀 高 + Roy 인지 비용 발생.
- 잡스 "한 번에 하나" + 머스크 "안 깨진 것 손대지 마라" 모두 위반.
- v7 §20.1은 추정 박은 결과 (v7 본문 손실 후 재구축). 이후 똘이는 코드 grep 의뢰 우선.

**참조:**
- Confluence Task_2026-04-29 §20.1 v3 / §23.4 / §24.2
- 코드 진실: `src/modules/personas/preset-catalog.ts` L21~L106 (시드 6종)
