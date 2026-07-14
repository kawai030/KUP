# Kup — 생성 프롬프트 설계 (운영본)

> **문서 성격**: [생성 파이프라인 §2](Kup_생성파이프라인_설계.md) 초안을 **복붙해서 바로 테스트 가능한 운영 프롬프트**로 확정한 문서. 수동 이터레이션 → 안정 시 `poc/llm-bench/prompts/`로 코드화 → LLM 벤치 입력.
> **기준일**: 2026-06-26 · **선행**: 파이프라인 §1(스키마)·§2(초안) · [데이터모델 `decks`](Kup_데이터모델.md) · SPEC 3.2/3.3
> **출력 언어**: 모든 생성물 **한국어**. 출력은 **항상 지정 JSON 스키마**(자연어 설명·코드펜스 금지).
> **표기**: `{{변수}}` = 런타임 주입. 본문의 `poc/…` 는 **초기 검증 스파이크(비공개)** 경로(검증 결과는 본 코드/설계에 반영, 일부는 `lib/`·`examples/`로 이식).

---

## 0. 파이프라인 & 호출 구조

```
[잠긴 컨셉] = 시스템 프롬프트(캐싱)  ← persona/tone/pillars 고정
   ① 주제 → ② 전략 → ③ 카피(핵심) → ④ 자가점검
```
- **MVP 1차**: ②③④를 **단일 호출**로 묶어 지연·비용↓ (벤치가 분리 필요성 판정). ①은 사용자 주제 선택 시 생략 가능.
- **캐싱**: 시스템 프롬프트(§1)는 채널마다 고정 → Claude `cache_control` / OpenAI 자동 / Gemini `cachedContent`. 입력비 ~90%↓.

---

## 1. 시스템 프롬프트 (모든 단계 공통 · 캐싱 대상)

```
너는 인스타그램 카드뉴스 전문 카피라이터다. 아래 "채널 컨셉"을 절대 규칙으로 삼아,
한국어로 카드뉴스 콘텐츠를 생성한다. 출력은 항상 지정된 JSON 스키마만 반환한다.

[채널 컨셉]  ← 이 채널의 불변 정체성. 모든 문장이 여기서 벗어나면 안 된다.
- 페르소나: {{persona}}
- 톤: {{tone}}
- 콘텐츠 기둥(주제는 반드시 이 안에서): {{pillars}}
- 발행 주기: {{cadence}}

[불변 규칙]
1. 톤·페르소나를 모든 문장에 일관되게 반영한다.
   과장·클릭베이트·낚시성 표현, 이모지 남발을 금지한다.
2. 사실로 단정할 수 없는 것(수치·효능·통계·실존 인물/매장/브랜드/곡명·날짜)은
   지어내지 않는다. 불확실하면 일반화하거나 ai_flags에 기록한다.
3. 규제·광고 표현을 쓰지 않는다.
   - 금융: 수익 보장, 원금 보장, 투자 권유·단정
   - 의료/건강: 치료·효능 단정, 부작용 없음 단정
   - 공통: "반드시", "무조건", 강요·압박형 권유
4. 출력은 지정 JSON 스키마를 정확히 따른다. 글자수 제약을 절대 초과하지 않는다.
   (글자수는 카드 레이아웃이 깨지지 않는 물리적 상한이다.)
5. 너는 AI다. 확신할 수 없는 주장을 단정조로 쓰지 않는다.

[슬라이드 구조 규칙]
- 1장 cover + N장 body(1~8) + 1장 outro. 전체 3~10장.
- outro의 cta에는 리드마그넷 키워드(leadKeyword)를 포함한다.
  (이 키워드는 발행 후 댓글 트리거 키가 되므로 본문과 일치해야 한다.)
```

> 캐시 앵커 = `persona`·`tone`·`pillars`. 채널당 1회 잠금([데이터모델 channel_configs](Kup_데이터모델.md)).

---

## 2. 단계별 유저 프롬프트

### ① 주제 결정
```
[작업] 이 채널의 다음 카드뉴스 주제를 {{n=5}}개 제안하라.
- 각 주제는 pillars 중 하나에 속한다.
- "정보성 + 공감"으로 저장·공유를 부르는 앵글을 우선한다.
- 최근 다룬 주제와 겹치지 않게: {{recent_topics|"(없음)"}}

[출력 JSON]
{ "topics": [ { "title": string, "pillar": string, "angle": string } ] }
```

### ② 전략 설계
```
[작업] 선택 주제 "{{topic}}"로 카드뉴스 1세트 구성을 설계하라.
- 슬라이드 장수 결정(cover 1 + body 3~6 + outro 1 권장).
- cover에서 멈추게 할 후킹 앵글(hook) 1문장.
- 각 body가 말할 내용을 한 줄 요약(아직 카피 아님).
- outro 리드마그넷 후킹: 무엇을 댓글로 받게 할지 + leadKeyword(짧은 단어).

[출력 JSON]
{
  "strategy": string,          // 검수자용 한 줄 설명
  "hook": string,
  "slidePlan": [ { "kind": "cover"|"body"|"outro", "purpose": string } ],
  "leadKeyword": string
}
```

### ③ 카피 생성 — **핵심 · 구조화 출력**
```
[작업] 아래 구성에 맞춰 실제 카드뉴스 카피를 작성하라.
주제: {{topic}} / 앵글: {{hook}} / 구성: {{slidePlan}} / 리드키워드: {{leadKeyword}}

[글자수 제약 — 초과 금지, 공백 포함]
- cover : kicker ≤10 / title ≤24(줄바꿈 \n 허용) / sub ≤34
- body  : index "01"부터 2자리 / head ≤24 / body ≤48(\n 허용)
- outro : title ≤22 / sub ≤40 / cta ≤14 (cta에 리드키워드 포함, 예 "💬 댓글: {{leadKeyword}}")
- caption ≤300 / hashtags 5~10개(각 '#'으로 시작, 공백 없음)

[참고 모범 예시]   ← 0.2 exemplars 주입 지점(few-shot)
{{exemplars|"(없음)"}}

[출력 JSON]  // deck 스키마의 topic·strategy·slides·caption·hashtags·leadKeyword까지.
{
  "conceptId": "{{conceptId}}",
  "topic": "{{topic}}",
  "strategy": "{{strategy}}",
  "leadKeyword": "{{leadKeyword}}",
  "slides": [
    { "kind": "cover", "kicker": string, "title": string, "sub": string },
    { "kind": "body",  "index": "01", "head": string, "body": string },
    { "kind": "outro", "title": string, "sub": string, "cta": string }
  ],
  "caption": string,
  "hashtags": [ string ],
  "ai_flags": [],
  "risk_level": "low"
}
// ai_flags·risk_level은 비워서 출력(④에서 채움).
```

### ④ 자가 점검
```
[작업] 아래 deck을 검수자 입장에서 비판적으로 점검하라. 네 생성물을 의심하라.
{{deck JSON}}

[점검 항목]
- 검증이 필요한 주장(수치·효능·통계·실존 인물/매장/브랜드/곡명·날짜)
- 규제·광고 표현(금융 권유·보장, 의료 효능 단정, 과장 보장)
- 톤/페르소나 일탈, 강요·압박형 표현

[판정 규칙]
- 위 위험이 하나라도 있으면 risk_level="high", 해당 지점을 ai_flags에 구체적으로 기록.
- 전혀 없으면 risk_level="low", ai_flags=[].

[출력 JSON]
{ "ai_flags": [ string ], "risk_level": "low"|"high" }
```

> ④ 품질이 SPEC "무수정 승인율 60~85%"·"5초 검수"를 좌우. 자가점검 정확도 = 모델 선택의 결정 변수([개발계획 §4 루브릭](Kup_기술스택_개발계획.md)).

---

## 3. 변수 계약 (런타임 주입)

| 변수 | 출처 | 단계 |
|---|---|---|
| `persona`·`tone`·`pillars`·`cadence` | `channel_configs`(잠긴 컨셉) | 시스템 |
| `conceptId` | `channels`/`channel_configs` | ③ |
| `topic` | ① 산출 또는 사용자 선택 | ②③ |
| `hook`·`slidePlan`·`strategy`·`leadKeyword` | ② 산출 | ③ |
| `exemplars` | 0.2 모범예시 | ③(few-shot) |
| `recent_topics` | `decks` 최근 N건 | ① |
| `n` | 기본 5 | ① |

---

## 4. 구조화 출력 강제 (3사 공통)

| 공급자 | 방식 |
|---|---|
| Anthropic | tool use(입력 스키마 tool) 또는 프롬프트+JSON 검증 재시도 |
| OpenAI | `response_format: json_schema` (strict) |
| Google | `responseMimeType: application/json` + `responseSchema` |

공통: 출력 → **Zod 검증**(스키마 + 글자수) → 실패 시 1회 repair 재생성. Zod 타입은 `decks.slides`([데이터모델](Kup_데이터모델.md))와 **공유**.

---

## 5. 수동 테스팅 프로토콜 (벤치 전 이터레이션)

> 목적: 정식 멀티모델 벤치 들어가기 전, 단일 모델로 프롬프트를 빠르게 손본다.

**루프(주제 1건당):**
1. 컨셉 1개 고정(`poc/concepts/*.json`) → ③ 카피 생성(수동: Claude에 복붙 or 스크립트)
2. **렌더 확인** — deck JSON → `poc/render-deck.js` → PNG. 글자수 fit·레이아웃 안 깨짐 확인.
3. ④ 자가점검 → 플래그가 과민/과소하지 않은지 확인.
4. 깨지거나 어색하면 **프롬프트(글자수 룰·톤 지시·few-shot) 수정** → 1로.
5. 잘 나온 출력은 **0.2 모범예시로 저장**, 쓴 주제는 **0.5 골든셋 시나리오로 저장**.

**테스트 다양성(최소 셋):** 재테크(사회초년생) / 디저트 맛집(고위험·실존매장) / 자유주제(뭘 올릴지 모름).

**"프롬프트 안정" 종료 조건(= 벤치 GO):**
- [ ] 다양 주제 ≥3개가 **스키마 유효**(파싱 0 실패)
- [ ] **글자수 fit** — 렌더 시 모든 카드 안 깨짐
- [ ] **톤 준수** — 페르소나·금지표현 위반 없음
- [ ] **자가점검 적절** — 고위험(디저트 실존매장)에서 risk_level="high"+정확한 flag, 저위험에서 오탐 없음

---

## 6. 다음 단계 / 미결정

- 안정되면 이 프롬프트를 `poc/llm-bench/prompts/`(단계별)로 코드화 → 벤치 하니스가 3사로 동일 주입.
- **미결정**: ②③④ 단일호출 vs 분리(벤치로 판정) · 변형안 N개 정책(비용 N배) · few-shot 개수(3 vs 5). — 모두 벤치 직전 확정.
