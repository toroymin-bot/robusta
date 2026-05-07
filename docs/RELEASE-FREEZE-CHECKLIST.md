# Robusta D-1 Release Freeze Checklist (2026-05-07 ~ 2026-05-08)

> **C-D56-5 / Tori spec §9 (D-1 19시 슬롯, 2026-05-07).**
> SoT: `src/modules/launch/release-freeze-cutoff.ts` (C-D56-3).
>
> 본 체크리스트는 D-1 / D-Day / D+1 실행 SoP. 시간값은 모두 KST.
> 변경 시 release-freeze-cutoff.ts 의 cutoff/monitor/deadline 상수 변경자가 동시 갱신.

---

## D-1 (2026-05-07 목)

| 시각 KST | 슬롯 | 액션 | 검증 |
| --- | --- | --- | --- |
| 17:00 | §9 똘이 | D-D56 사이클 등록 + C-D56-1~5 명세 (현재 본 문서) | Confluence Task v9 |
| **19:00** | **§10 꼬미 (현재)** | C-D56-1~5 처리 — verify:all 38→39 + sim:show-hn-submit 6/6 + sim:release-freeze 4/4 | verify:d56 8/8 |
| 20:00 | (B-D52-3) | Show HN T-2h dry-run sim 재확인 | npm run sim:show-hn-submit |
| 21:00 | §11 똘이 EOD | 카피 final lock 재확인 + Show HN submit 사전 점검 | (Confluence) |
| **22:00** | **(B-D52-4)** | **Show HN: Robusta — submit 정각** | SUBMIT_DEADLINE_KST |
| 22:30 | (B-D52-4) | Show HN 첫 30분 모니터 | (수동 관찰) |
| **23:00** | **§12 꼬미** | **RELEASE FREEZE — pre-commit-freeze.sh hard cutoff 활성** | RELEASE_FREEZE_CUTOFF_KST |

> **Freeze 정합:** 23:00 KST 진입 후 모든 commit 차단. 긴급 우회는 `RELEASE_FREEZE_OVERRIDE=1` env 만 허용.

---

## D-Day (2026-05-08 금)

| 시각 KST | 액션 | 검증 |
| --- | --- | --- |
| **00:00** | **Hero LIVE 자동 전환 + 30분 활성 모니터 진입** | LIVE_MONITOR_START_KST / phase=monitor |
| 00:00~00:30 | 활성 모니터 30분 (B-D52-2) — funnelEvents 실 데이터 수집 시작 | LIVE_MONITOR_DURATION_MIN=30 |
| **00:30** | **monitor → live 전환 확인** | phase=live, minutesToNext=0 |
| 09:00 | D-Day 보고 (텔레그램) | (별도 잡) |

---

## D+1 (2026-05-09 토)

| 시각 KST | 액션 |
| --- | --- |
| 09:00 | 3줄 보고 + Roy shownhScore 입력 인계 |

### D+1 자율 슬롯 큐 (release freeze 통과 후 즉시 처리)

| 큐 ID | 산출물 | 출처 |
| --- | --- | --- |
| D-55-자-2 | `ManualRunButton.tsx` phase prop 추가 + state→phase 매핑 + data-phase attribute | C-D55-5 wiring 본체 |
| A-D54-자-2 | `use-hero-dimming-opacity` hook wiring | A-D54-자-1 후속 |
| A-D54-자-3 | `locale useLocale` wiring (HeroAriaLiveSlot ko fallback → 동적 locale) | A-D54-자-1 후속 |
| F-D56-1 | post-auth-recover.ts 본 운용 (KQ_24 회복) | C-D52-5 후속 |
| F-D56-1 | funnelEvents Dexie 실 데이터 24h 누적 | D-Day 시작 후 |

---

## SoT 단일 진실 (release-freeze-cutoff.ts)

| 상수 | 값 | 정책 락 |
| --- | --- | --- |
| `RELEASE_FREEZE_CUTOFF_KST` | `2026-05-07T23:00:00+09:00` | B-D52-1 |
| `LIVE_MONITOR_START_KST` | `2026-05-08T00:00:00+09:00` | B-D52-2 |
| `LIVE_MONITOR_DURATION_MIN` | `30` | B-D52-2 |
| `SUBMIT_DEADLINE_KST` | `2026-05-07T22:00:00+09:00` | B-D52-4 / D-56-자-2 |

### `getReleaseFreezeStatus(now: Date) → { phase, minutesToNext }`

| now 범위 (KST) | phase | minutesToNext |
| --- | --- | --- |
| now < 5/7 23:00 | `pre-freeze` | (cutoff - now) 분 |
| 5/7 23:00 ≤ now < 5/8 00:00 | `freeze` | (monitor - now) 분 |
| 5/8 00:00 ≤ now < 5/8 00:30 | `monitor` | (live - now) 분 |
| now ≥ 5/8 00:30 | `live` | 0 |

### CLI 미러

`scripts/sim-release-freeze.mjs` — release-freeze-cutoff.ts 1:1 산식 미러.
.mjs ↔ .ts 변경 시 양쪽 동시 갱신 (D-53-자-1 락).

---

## 회귀 게이트 (D-1 19시 시점)

```
npm run verify:all       # 39/39 PASS (C-D56-1~5 흡수)
npm run verify:d56       # 8/8 PASS
npm run sim:show-hn-submit   # 6/6 PASS (case 6: T-30m 사전 경고)
npm run sim:release-freeze   # 4/4 PASS (pre-freeze / freeze / monitor / live)
```
