---
version: alpha
name: Apple-design-analysis
description: A photography-first interface that turns marketing into a museum gallery. Edge-to-edge product tiles alternate light and dark canvases, framed by SF Pro Display headlines with negative letter-spacing and a single Action Blue (#0066cc) interactive color. UI chrome recedes so the product can speak — no decorative gradients, no shadows on chrome, only the one signature drop-shadow under product imagery resting on a surface.
---

> KUP 프로젝트의 캐논 디자인 레퍼런스. 모든 신규/수정 UI는 이 문서를 기준으로 한다.
> 실제 토큰 적용은 `src/app/globals.css`(@theme) + `src/components/ui.tsx`(프리미티브)에 반영되어 있음.

## 핵심 원칙 (요약)
- 단일 인터랙티브 컬러 = **Action Blue #0066cc** (링크·주요 CTA·포커스). 두 번째 브랜드 컬러 금지.
- 표면: 화이트(#ffffff) / 파치먼트(#f5f5f7) / 니어블랙 타일(#1d1d1f~#272729). 색 전환 자체가 섹션 구분선.
- 타이포: SF Pro Display/Text (대체: system-ui / Inter / Pretendard). 디스플레이 크기에서 음수 자간(-0.02em 내외)로 "Apple tight".
  - 본문 17px/400, 라인하이트 1.47. weight 사다리 300/400/600/700 (500 사용 안 함).
- 라운드: sm 8px(유틸 버튼) · md 11px · lg 18px(카드) · pill 9999px(주요 CTA/검색/칩). 풀블리드 타일은 0.
- 그림자: 시스템 전체에서 **딱 하나** — 제품 이미지에만 `rgba(0,0,0,0.22) 3px 5px 30px`. 카드·버튼·텍스트엔 그림자 금지.
- 프레스 상태: 모든 버튼 `transform: scale(0.95~0.97)`. hover는 문서화하지 않음(기본/프레스만).
- 그라데이션 장식 금지. 깊이는 표면 색 전환 + 백드롭 블러(스티키 바)로만.

## 컬러 토큰 (globals.css 매핑)
- 주요 accent(coral 토큰) → `#0066cc` Action Blue
- ink `#1d1d1f` · ink-soft `#424245` · muted `#86868b` · line(hairline) `#d2d2d7`
- paper(파치먼트) `#f5f5f7` · paper-2 `#ececef` · card `#ffffff`
- 상태색(기능용, 브랜드 accent 아님): teal(완료) · amber(진행) · rose(릴스)

## 타이포 스케일 (원문 표 발췌)
- hero-display 56/600/-0.28px · display-lg 40/600/0 · display-md 34/600/-0.374px
- lead 28/400 · tagline 21/600 · body 17/400/1.47/-0.374px · caption 14/400 · fine-print 12/400
- 대체 폰트: `-apple-system` → SF Pro, 아니면 Inter(600 + ss03), Latin 자간 -0.01em, 본문 line-height -0.03.

## 버튼 문법
- primary: Action Blue 풀 pill, 17px, padding 11×22. active scale(0.95).
- secondary: 투명 + 블루 1px 보더 pill(고스트).
- dark-utility: ink 배경, 14px, rounded 8px, padding 8×15 (내비 액션).
- 원형 아이콘 칩: 44×44, 반투명 그레이(rgba(210,210,215,.64)), 사진 위 컨트롤.

## 카드/컨테이너
- store-utility-card: 화이트 + 1px hairline + lg(18px) + padding 24. 그림자 없음.
- product tile: 풀블리드(라운드 0), 상하 패딩 80, 라이트/파치먼트/다크 교차.

## Do / Don't (핵심)
- Do: 모든 인터랙션에 Action Blue 하나만. 디스플레이 헤드라인 음수 자간. 본문 17px. pill=액션 신호. 프레스 scale.
- Don't: 두 번째 accent 추가 금지. 카드/버튼/텍스트 그림자 금지. 장식 그라데이션 금지. 본문 weight 500 금지. 풀블리드 타일 라운드 금지. 본문 line-height 1.47 미만 금지.

(전체 원문 스펙은 채팅 히스토리의 DESIGN-apple.md 참고 — 위는 KUP 적용을 위한 요약본.)
