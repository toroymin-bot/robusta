# public/fonts — NotoSansKR

C-D29-3 (D-5 03시 슬롯, 2026-05-03) — Tori spec C-D29-3 (KQ_22 (1) 흡수).

## 호스팅 구조 (현재 슬롯에서 정의 — 실 ttf는 별도 슬롯/액션)

| 파일 | 크기 | 용도 |
| --- | --- | --- |
| `NotoSansKR-Subset.ttf` | ~350KB | 첫 로드 — KSX1001 한글 + Latin Basic subset |
| `NotoSansKR-Regular.ttf` | ~4MB | 풀폰트 lazy fallback (희귀자 발견 시) |
| `LICENSE.OFL.txt` | — | SIL OFL 1.1 라이선스 (재배포 자유) |

## subset 범위

- U+0020-007E — ASCII printable (95자)
- U+00A0-00FF — Latin-1 supplement (32자)
- U+AC00-D7A3 — Hangul Syllables (11172자, KSX1001 2350자 포함)
- U+3131-318E — Hangul Compatibility Jamo (94자)

생성 명령:

```bash
# Google Fonts NotoSansKR-Regular.ttf 다운로드 후
pyftsubset NotoSansKR-Regular.ttf \
  --unicodes='U+0020-007E,U+00A0-00FF,U+AC00-D7A3,U+3131-318E,U+000A,U+000D,U+0009' \
  --output-file=NotoSansKR-Subset.ttf
```

## 다운로드 출처

- 풀폰트: https://fonts.google.com/noto/specimen/Noto+Sans+KR (ttf download)
- subset: 위 명령으로 로컬 생성

## 라이선스

SIL Open Font License 1.1 — `LICENSE.OFL.txt` 참조. 재배포 자유, 단독 판매 금지.

## 호출자

- `src/modules/export/font-loader.ts` — `loadKoreanFont(text)` 자동 subset/full 선택
- `src/modules/export/pdf-font-loader.ts` (C-D26-3) — 풀폰트 직접 fetch (보존)

## 진행 상태

- [x] 디렉토리 + LICENSE + README 등록 (C-D29-3)
- [x] font-loader.ts 어댑터 추가 (C-D29-3)
- [x] `scripts/build-fonts.mjs` 빌드 스크립트 등록 (C-D30-4, 2026-05-03 07시)
- [ ] 실 ttf 다운로드 — `npm run build:fonts` (수동 실행, pyftsubset 필요)

## 빌드 절차 (C-D30-4)

```bash
# 1) fonttools 설치 (pyftsubset 포함)
pip install fonttools brotli

# 2) Robusta 루트에서 빌드 실행
npm run build:fonts

# 3) 결과 ttf + SHA256SUMS 커밋
git add public/fonts/NotoSansKR-Regular.ttf public/fonts/NotoSansKR-Subset.ttf public/fonts/SHA256SUMS
git commit -m "feat(fonts): NotoSansKR subset rebuild"
```

CI 자동 실행 X — 외부 네트워크 보안 + 재현성 위해 수동 only.
