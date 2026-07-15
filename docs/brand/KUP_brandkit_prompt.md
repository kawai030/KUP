# KUP 브랜드 아이덴티티 이미지 — 생성 프롬프트

`.agents/skills/brandkit`(taste-skill) 방식으로 정리한 KUP 전용 브랜드킷 프롬프트.
**데스크탑 Claude(Higgsfield MCP 연결됨)** 또는 미드저니·DALL·E 등에 붙여넣어 이미지를 생성한다.
KUP은 이미 TDS 기반 디자인 시스템(핑크 #e52364 · Pretendard · 흰 캔버스)이 있으므로, 브랜드 이미지도 그 세계관에 맞춘다.

---

## 브랜드 전략 (프롬프트의 근거)

| 항목 | 내용 |
|---|---|
| 카테고리 | 초기 1인 크리에이터용 AI 인스타 카드뉴스 코파일럿 (토스처럼 깔끔한 한국형 소비자 SaaS) |
| 타깃 | 시작 6개월 이내 · 팔로워 0–1,000 · "올려도 반응이 없어요" |
| 감정 약속 | 제작에 쓰던 시간을 소통으로 돌려 **"당신을 아는 1,000명"**(진성 팬)을 만든다 (나노팬덤) |
| 문화적 위치 | "더 빨리 제작"이 아니라 **관계 밀도**. 두 번째 브랜드 컬러 없음 |
| 핵심 은유 | **채널을 한 장씩 채운다** — 카드가 쌓여 채널이 차오르는 것 / 팬으로 채워지는 그릇(KUP≈cup) |
| 성격 | 따뜻하고 정교함 · 신뢰 · 조용히 프리미엄 · 토스식 명료함 |

### 로고 방향 (택1 또는 조합 2개까지)
- **A. K + 카드 스택(1순위):** 살짝 어긋나게 쌓인 둥근 카드뉴스 패널 2~3장으로 `K` 를 만든다(슬라이드가 쌓임 = 채널이 채워짐). 한 패널에만 핑크. 여백으로 K가 또렷하게.
- **B. 채워지는 그릇:** KUP=cup 동음 + "채우세요" → 둥근 그릇에 핑크 fill 레벨이 차오르는 마크.
- **C. K 모노그램 + 하트/스파크 네거티브 스페이스:** K 안쪽 여백에 팬덤(하트)·AI(스파크) 암시.

---

## 생성 프롬프트 (그대로 복붙)

```
Create a premium brand-kit overview image for "KUP" — an AI Instagram card-news copilot
that helps early solo creators (0–1,000 followers) turn production time into real connection,
building "the 1,000 people who truly know you" (nanofandom).

Brand strategy:
- category: warm Korean-style consumer AI creator tool (Toss-like fintech clarity)
- audience: solo influencers just starting out, a little tired of posting with no response
- personality: warm, precise, trustworthy, quietly premium, friendly, clean
- core metaphor: filling a channel one card at a time — slides that stack and a vessel that fills with fans
- logo idea: a "K" monogram built from two or three offset rounded card-news panels
  (stacking slides = the channel filling up); one panel carries the pink accent;
  crisp negative space forms the K. It should read as a card system and as a K.

Layout:
Clean 3×3 grid on a bright ivory / white presentation canvas, strong gutters, generous
negative space, precise alignment, small page-number and section-label details.

Panels:
1. Logo cover — large "KUP" wordmark + the K-from-cards monogram, huge white space, one pink accent.
2. Logo construction — the K built from stacked rounded cards on a light grid; geometry + negative-space logic.
3. Digital application — a phone showing an Instagram card-news carousel made in KUP:
   clean 3:4 cards, a pink pill CTA, realistic app frame.
4. Brand essence — one tagline in large Korean type: "카드 한 장으로, 당신을 아는 1,000명." on a quiet background.
5. Color system — swatches: KUP pink #E52364 dominant, plus grey900 #191F28, grey500 #8B95A1, soft pink #FEF6F9, white.
6. Typography — a clean Pretendard-style sans specimen, Korean + Latin ("가나다 · KUP · ABC"), primary/secondary pairing.
7. Physical / icon application — app icon (pink rounded-squircle with a white K), a small sticker sheet.
8. Image direction — one warm, art-directed editorial photo: a creator's hand holding a phone
   in a cozy, softly-lit interior; muted palette with a single pink accent.
9. System detail — UI chips, card-template thumbnails, a pink pill button, a small "+1,000 팔로워"
   progress badge, a component strip.

Visual mode:
Light consumer-app premium (Korean fintech clarity) — bright ivory canvas, precise grid,
soft shadows, rounded 12–16px corners, ONE confident pink accent. No dark-tech clichés,
no generic startup gradients, no purple-blue AI glow.

Palette:
Ivory / white base + KUP pink #E52364 as the single accent (repeated on every panel) + grey neutrals.
No rainbow.

Typography:
Clean, minimal, strong hierarchy, readable Korean + Latin, no tiny fake body text.

Logo:
Professional, symbolic, simple, ownable — a K formed from card-news panels (channel filling),
consistent across every panel.

Style:
Premium, sparse, editorial, intentional, brand-guidelines deck, warm-but-precise,
implementation-friendly, no clutter, no copied real-world logos.

Aspect ratio: 16:10 (or 4:3).
```

---

---

## ★ 로고 전용 프롬프트 — 메타볼 / 픽셀그리드 방향 (레퍼런스 반영)

콘셉트: **딱딱한 모듈 픽셀 그리드 안에서 점액처럼 흐르고 병합·번지는 유기적 메타볼(metaball) 형태.**
이 "연결·병합"이 KUP의 나노팬덤(팬들이 이어져 커뮤니티가 됨)·채널 채우기와 직결된다. 컬러는 KUP 핑크 유지.

```
Design a logo identity board for "KUP" — an AI Instagram card-news copilot for early creators.
Brand idea: separate fans connecting into one "nanofandom"; a channel that fills one card at a time.

Core aesthetic: organic METABALL forms — smooth liquid blobs that merge, connect, and bleed
like droplets of mucus/mercury — constructed inside a strict MODULAR PIXEL GRID of rounded-rectangle
cells. The whole idea is the tension between the rigid grid and the gooey organic flow.

Logo: an abstract mark (plus a "K" monogram variant) built from connected metaball blobs sitting
on an 8×8 rounded-cell grid — separate nodes merging into one continuous form (fans → community,
cards → a filled channel). Simple, ownable, memorable, scalable to a tiny app icon.

Layout: clean construction board, warm-grey / ivory / near-black panels, strong gutters,
thin guide lines, tiny construction labels and page numbers (Swiss editorial construction sheet).

Show these variants of the SAME mark:
1. Primary mark — solid metaball blob logo, single pink accent on a neutral field.
2. Grid construction — the mark built on a visible modular pixel grid (rounded rounded-rect cells),
   thin guides, small measurement labels, "[ 03 ]" style page marks.
3. Halftone / dithered version — the mark as a bleeding blue/pink dot-matrix halftone with a soft
   afterimage / trail, like it's dissolving into dots.
4. Aura / gradient version — the same form as a soft blurred grainy gradient glow (liquid aura).
5. Monochrome inversion — pink on near-black, and near-black on ivory.
6. App icon (rounded squircle) + "KUP" wordmark lockup.

Color: monochrome neutrals (near-black #191F28, warm grey, ivory) + KUP pink #E52364 as the ONLY
accent. No other hues.

Texture: subtle grain, halftone dots, faint print/scanline feel. Precise but organic.

Style: premium, editorial, Swiss-construction-meets-organic-blob, intentional, brand construction
sheet, a memorable metaball logo. No clipart, no generic startup gradients, no meaningless AI blobs.

Aspect ratio: 4:3.
```

### 이 프롬프트에서 바꿔볼 키워드
- 유기성 ↔ 정형성 비율: `metaball / gooey / mucus / mercury / liquid merge` vs `strict modular grid / pixel cells / Swiss construction`
- 번짐·잔상 효과: `bleeding dot-matrix halftone`, `dithered afterimage`, `soft blur trail`, `grainy aura glow`
- 글자성: 완전 추상 마크를 원하면 `"K" monogram variant` 줄을 지우고, K가 또렷하길 원하면 `the blobs clearly form the letter K` 추가
- 톤: 밝게 → `bright ivory canvas` / 어둡게 → `near-black charcoal panels`

---

## 변주 (원하면 바꿔서 재생성)

- **로고 단독 집중:** 위 프롬프트에서 Panels를 지우고 "Generate a single large logo concept board for KUP: the K-from-stacked-cards monogram in 6 variations (icon, wordmark, badge, app icon, monochrome, pink accent), on an ivory grid." 로 교체.
- **다크 버전:** Visual mode 를 "near-black charcoal canvas, soft pink glow, premium dark deck" 로.
- **그릇(cup) 은유:** logo idea 를 방향 B(채워지는 그릇)로 교체.
- **인테리어 니치 톤:** Image direction 을 데모 니치(집꾸미기)에 맞춰 "cozy styled interior, warm daylight" 강조.

## 생성 후
- 마음에 드는 로고 방향이 정해지면, KUP 앱의 실제 로고(현재 헤더의 핑크 `K` 사각형)와 파비콘·`docs/design/DESIGN-kup.md` 에 반영할 수 있다.
