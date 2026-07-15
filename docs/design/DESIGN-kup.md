---
version: alpha
name: KUP-design-system (TDS)
source: https://www.figma.com/design/9yqB6igAnuBQrSG5xirzIq/TDS
description: 화이트 캔버스 + 정교한 grey scale 위에 단일 KUP 핑크(#e52364)가 모든 인터랙션을 책임지는 시스템. 넉넉한 라운드(12~16px), 테두리보다 소프트 섀도우로 띄우는 엘리베이션, Pretendard 한 벌로 통일된 타이포. 장식을 걷어내고 "다음에 눌러야 할 것"만 분홍으로 남긴다.
---

> **KUP 캐논 디자인 레퍼런스.** 모든 신규/수정 UI는 이 문서를 기준으로 한다.
> 적용점: `app/globals.css`(@theme 토큰) · `app/wireframe.css` · `app/(home)/landing.css` · `app/(marketing)/marketing.css` · `components/workspace/ui.tsx`
>
> ⚠️ **토큰 이름은 그대로, 값만 교체**하는 구조다(팀이 설계해둔 교체점). 예: `--color-coral` 는 이름만 coral 이고 값은 KUP 핑크.

## 1. 핵심 원칙

- **단일 인터랙티브 컬러 = KUP 핑크 `#e52364`.** 링크·주요 CTA·선택·포커스·진행 상태가 전부 이 색 하나. 두 번째 브랜드 컬러를 만들지 않는다.
- **표면은 grey scale로만 계층을 만든다.** 화이트 카드 ↔ `grey50/100` 캔버스. 색으로 강조하지 않고 **여백과 밝기 차이**로 구분.
- **라운드는 넉넉하게.** 버튼·입력 12px, 카드 16px. 각진 모서리는 쓰지 않는다.
- **엘리베이션은 테두리가 아니라 그림자.** `0 1px 2px rgba(0,0,0,.04), 0 6px 20px rgba(0,0,0,.06~.08)` — 얇고 넓게 퍼지는 한 티어.
- **타이포는 Pretendard 한 벌.** 한글·라틴 통일. 헤드라인은 굵게(600~700) + 자간 `-0.025em`, 본문 자간 `-0.01em`.
- **상태색은 브랜드와 분리.** 완료=green, 진행=amber, 릴스=violet. 파랑은 "브랜드/액션" 전용.

## 2. 컬러 토큰

### KUP 핑크 (브랜드 · 유일한 액센트)
| 토큰 | 값 | 용도 |
|---|---|---|
| pink-50 | `#fef6f9` | soft 배경, 선택 필 (`--color-coral-soft`) |
| pink-100 | `#fad1df` | 연한 강조 |
| pink-300 | `#ef769f` | 그라데이션 중간 |
| pink-400 | `#e9497e` | 다크 표면 위 링크 |
| **pink-500** | **`#e52364`** | **primary CTA · 링크 · 포커스** (`--color-coral`) |
| pink-600 | `#b6164b` | hover |
| pink-700 | `#920736` | active/press, 딥 액센트 |

### Grey scale (표면·텍스트)
| 토큰 | 값 | 용도 |
|---|---|---|
| grey-900 | `#191f28` | 헤드라인 ink (`--color-ink`) |
| grey-700 | `#4e5968` | 본문 (`--color-ink-soft`) |
| grey-500 | `#8b95a1` | 서브라벨·비활성 (`--color-muted`) |
| grey-300 | `#d1d6db` | 강한 보더 |
| grey-200 | `#e5e8eb` | hairline (`--color-line`) |
| grey-100 | `#f2f4f6` | surface-soft / hover (`--color-paper-2`) |
| grey-50 | `#f9fafb` | 페이지 캔버스 (`--color-paper`) |
| white | `#ffffff` | 카드 표면 (`--color-card`) |

### 상태 시맨틱 (브랜드 블루와 분리)
| 토큰 | 값 | soft | 용도 |
|---|---|---|---|
| green | `#0aa06e` | `#e7f8f1` | 완료·성공 (`--color-teal`) |
| amber | `#c47b00` | `#fff4e0` | 진행중·예약 (`--color-amber`) |
| violet | `#7f56d9` | `#f3eeff` | 릴스 (`--color-rose`) |

## 3. 타이포그래피

- **서체**: TDS 전용 서체는 비공개 → **Pretendard**로 대체. 한글·라틴 한 벌로 통일한다.
- **자간**: body `-0.01em`, 디스플레이 `-0.025em` (KUP 특유의 좁은 자간).
- **웨이트 사다리**: 400(본문) / 500(강조) / 600(서브헤드) / 700(헤드라인).

## 4. 형태 · 엘리베이션

| 항목 | 값 |
|---|---|
| 버튼·입력 radius | `12px` (`--radius-xl: 0.75rem`) |
| 카드 radius | `16px` |
| 그림자(단일 티어) | `0 1px 2px rgba(0,0,0,.04), 0 6px 20px rgba(0,0,0,.06)` |
| 보더 | `1px solid #e5e8eb` (필요할 때만) |

## 5. Do / Don't

**Do**
- 모든 "누를 것"은 KUP 핑크 하나로. 링크·CTA·선택·포커스 전부.
- 카드는 화이트 + 넉넉한 라운드 + 소프트 섀도우.
- 계층은 grey scale과 여백으로. 색을 더하지 말고 **덜어낸다**.
- 한글은 반드시 Pretendard.

**Don't**
- 두 번째 브랜드 컬러를 만들지 않는다(핑크·코랄·Rausch 금지).
- 장식용 그라데이션·패턴 배경 금지.
- 각진 모서리(radius 0~6px) 금지.
- 상태색(green/amber/violet)을 CTA에 쓰지 않는다 — CTA는 언제나 파랑.

## 6. 이력
- 2026-07-01: **Airbnb(Rausch #ff385c) → TDS 기반 KUP 디자인 시스템** 전면 교체. 마케팅/랜딩 테마, 워크스페이스 토큰, 카드 테마, 체크박스 액센트까지 일괄 전환. (기존 `DESIGN-airbnb.md` 는 폐기)
- 2026-07-14: 브랜드 액센트를 **블루 → KUP 핑크 `#e52364`** 로 교체(피그마 베리언트 반영). 제품 내 명칭도 '토스' 대신 **KUP** 으로 통일. (파일명 `DESIGN-toss.md` → `DESIGN-kup.md`)
