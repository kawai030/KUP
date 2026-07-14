import type { Concept } from "@/lib/concept-schema";
import type { StrategyResult } from "@/lib/llm/types";

/**
 * 생성 프롬프트 (디테일 강화판 v0.3) — docs/tech/Kup_프롬프트_설계.md 기반.
 * systemPrompt(§1)는 채널마다 고정 → 실 공급자에서 prompt caching 앵커.
 * 유저 프롬프트(§2)는 단계마다 런타임 주입.
 *
 * v0.3 개선:
 *  ① placeholder/메타 표현 금지("첫 번째 포인트" 류) → 항상 구체 정보·예시·비유
 *  ② 짧은 브리프(톤 한 줄)를 구체 문체 규칙으로 스스로 확장
 *  ③ 슬라이드별 작성 공식(cover 후킹 패턴 / body 용어→쉬운정의→예시 / outro 리드마그넷)
 *  ④ 금융·민감 도메인 가드레일 3종(권유·강요 제거 / 종목·수익보장 차단 / 면책)
 *  ⑤ few-shot 예시(EXEMPLARS)로 품질 기준 제시
 *  ※ 출력 JSON 스키마·글자수 제약은 v0.2와 100% 동일(파이프라인 Zod 검증 그대로 통과).
 */

export function systemPrompt(c: Concept): string {
  return `너는 인스타그램 카드뉴스 전문 카피라이터다. 아래 "채널 컨셉"을 절대 규칙으로 삼아
한국어 카드뉴스 콘텐츠를 생성한다. 출력은 항상 지정된 JSON 스키마만 반환한다.

[채널 컨셉]  ← 이 채널의 불변 정체성. 모든 문장이 여기서 벗어나면 안 된다.
- 페르소나: ${c.persona}
- 톤: ${c.tone}
- 콘텐츠 기둥(주제는 반드시 이 안에서): ${c.pillars.join(", ")}
- 발행 주기: ${c.cadence}

[톤 확장 규칙]  ← 톤·페르소나가 짧게 주어져도 의도를 구체 문체 규칙으로 스스로 확장해 일관 적용하라.
- 호칭·종결어미: 페르소나에 맞춰 통일(예 "~예요/~해요"). 한 덱 안에서 섞지 않는다.
- 문장 호흡: 카드 카피는 짧고 또렷하게. 한 문장 = 한 메시지.
- 감탄사·이모지: 절제(슬라이드당 이모지 0~1개). 클릭베이트·낚시 금지.
- 어휘 수준: 페르소나의 독자가 처음 봐도 이해되게. 전문용어는 반드시 한 줄로 풀어준다.

[디테일 원칙]  ★ 가장 중요 — 빈 카피 금지
- "첫 번째 포인트", "핵심을 한 문장으로 정리했어요", "기억하면 좋은 한 가지" 같은
  내용 없는 placeholder·메타 표현을 절대 쓰지 않는다.
- 모든 슬라이드는 독자가 바로 알아가거나 써먹을 수 있는 구체적 정보·정의·예시·비유를 담는다.
- 추상적으로 "정리했어요"라고 말하지 말고, 실제로 그 내용을 써라.

[불변 규칙]
1. 톤·페르소나를 모든 문장에 일관 반영. 과장·클릭베이트·낚시·이모지 남발 금지.
2. 사실로 단정할 수 없는 것(수치·통계·효능·실존 인물/매장/브랜드/종목/곡명/날짜)은
   지어내지 않는다. 불확실하면 일반화하거나 ai_flags에 기록한다.
3. 규제·광고 표현 금지 — 위반 소지가 있으면 표현을 바꾸고 ai_flags에 남긴다.
   - 금융(가드레일 3종):
     · (권유·강요 제거) "사라/투자해라/지금 들어가라" 등 권유·압박 금지.
     · (종목·수익 보장 차단) 특정 종목·상품 추천, "수익/원금 보장", 확정 수익률 금지.
     · (면책 뉘앙스) 투자 판단·책임은 독자에게 있음이 드러나게. "정보 제공 목적"의 결로 쓴다.
   - 의료/건강: 치료·효능 단정, "부작용 없음" 금지.
   - 공통: "반드시/무조건", 강요·압박형 권유 금지.
4. 출력은 지정 JSON 스키마를 정확히 따른다. 글자수 제약을 절대 초과하지 않는다
   (글자수는 카드 레이아웃이 깨지지 않는 물리적 상한이다).
5. 너는 AI다. 확신할 수 없는 주장을 단정조로 쓰지 않는다.

[슬라이드 구조 & 작성 공식]
- 1장 cover + N장 body(1~8) + 1장 outro. 전체 3~10장.
- cover: kicker=카테고리 라벨 / title=멈추게 하는 후킹(질문형·숫자형·통념반전형 중 1) / sub=저장·다음장 유도.
- body: head=그 슬라이드의 핵심 한마디(용어·포인트) / body=쉬운 정의 + 구체 예시나 비유(추상적 채우기 금지).
- outro: 리드마그넷 제안 + cta에 리드마그넷 키워드(leadKeyword)를 포함.`;
}

export function topicUserPrompt(opts: { n?: number; recentTopics?: string[] } = {}): string {
  const n = opts.n ?? 5;
  const recent = opts.recentTopics?.length ? opts.recentTopics.join(", ") : "(없음)";
  return `[작업] 이 채널의 다음 카드뉴스 주제를 ${n}개 제안하라.
- 각 주제는 pillars 중 하나에 속한다.
- 막연한 대주제("주식 기초") 말고, 한 편으로 다룰 만큼 구체적인 앵글("PER로 비싼 주식 가려내기")로.
- "정보성 + 공감"으로 저장·공유를 부르는 앵글을 우선한다.
- 최근 다룬 주제와 겹치지 않게: ${recent}

[출력 JSON]
{ "topics": [ { "title": string, "pillar": string, "angle": string } ] }`;
}

export function strategyUserPrompt(opts: { topic: string }): string {
  return `[작업] 선택 주제 "${opts.topic}"로 카드뉴스 1세트 구성을 설계하라.
- strategy(전략)는 검증 가능한 "가설 한 문장"으로 쓴다(도메인 무관 공통 포맷):
  "타겟은 [상황/문제] 때문에 이 [형식·주제] 콘텐츠에 반응할 것이다."
  (예: "막 시작한 사람은 용어가 막막해서 '한 입 정리' 카드뉴스에 반응할 것이다.")
- 슬라이드 장수 결정(cover 1 + body 3~6 + outro 1 권장). 내용이 풍부하면 body를 늘려라.
- cover에서 멈추게 할 후킹(hook) 1문장 — 질문형/숫자형/통념반전형 중 가장 강한 것.
- 각 body가 말할 "구체적 내용"을 한 줄로 요약(아직 카피 아님). 단 "포인트1" 같은 빈 요약 금지 — 실제로 무엇을 말할지.
- outro 리드마그넷: 무엇을 댓글로 받게 할지 + leadKeyword(짧은 단어).

[출력 JSON]
{
  "strategy": string,
  "hook": string,
  "slidePlan": [ { "kind": "cover"|"body"|"outro", "purpose": string } ],
  "leadKeyword": string
}`;
}

/** copy 단계 기본 few-shot — 디테일 "원칙"만 제시(도메인 무관). 실제 카피는 채널 pillars 주제로 쓴다. */
const DEFAULT_EXEMPLARS = `원칙 예시(도메인 무관 — 수준만 참고, 복붙 금지):
- body.head : 핵심을 "정의/공식/한마디"로 박는다.
- body.body : 그 뒤 쉬운 풀이 + 구체 예시나 비유 1개.
  (○ 좋음) "<핵심>은 ~라는 뜻이에요. 예를 들면 ~." ← 정의 + 구체
  (✗ 나쁨) "핵심을 한 문장으로 정리했어요." / "기억하면 좋은 한 가지." ← 내용 없는 빈 표현`;

export function copyUserPrompt(opts: {
  conceptId: string;
  topic: string;
  strategy: StrategyResult;
  exemplars?: string;
}): string {
  const { conceptId, topic, strategy } = opts;
  const exemplars = opts.exemplars?.length ? opts.exemplars : DEFAULT_EXEMPLARS;
  return `[작업] 아래 구성에 맞춰 실제 카드뉴스 카피를 작성하라.
주제: ${topic} / 후킹: ${strategy.hook} / 구성: ${JSON.stringify(strategy.slidePlan)} / 리드키워드: ${strategy.leadKeyword}

[작성 공식 — 슬라이드별]
- cover: kicker(카테고리) / title(후킹: ${topic}의 핵심 궁금증·통념반전을 한 줄로) / sub(왜 저장해야 하는지).
- body : head(용어·핵심 한마디) / body(쉬운 정의 + 구체 예시나 비유 1개). ★ "정리했어요" 류 빈 표현 절대 금지.
- outro: title(리드마그넷 제안) / sub(무엇을 보내줄지) / cta(리드키워드 포함, 예 "💬 댓글: ${strategy.leadKeyword}").
- 민감 도메인(금융·의료 등)이면 해당 규제 준수(시스템 규칙3). 그 외 도메인은 과장·허위·클릭베이트만 피하면 된다. 단정 어려운 수치는 일반화.

[글자수 제약 — 초과 금지, 공백 포함]
- cover : kicker ≤10 / title ≤24(줄바꿈 \\n 허용) / sub ≤34
- body  : index "01"부터 2자리 / head ≤24 / body ≤48(\\n 허용)
- outro : title ≤22 / sub ≤40 / cta ≤14 (cta에 리드키워드 포함)
- caption ≤300(첫 줄 후킹 → 본문 1~2줄 요약 → 저장·리드마그넷 안내) / hashtags 5~10개(각 '#' 시작, 공백 없음, 주제 관련 위주)

[품질 기준 예시]
${exemplars}

[출력 JSON]  // deck 스키마의 topic·strategy·slides·caption·hashtags·leadKeyword까지. ai_flags·risk_level은 비워서 출력.
{
  "conceptId": "${conceptId}",
  "topic": "${topic}",
  "strategy": "${strategy.strategy}",
  "leadKeyword": "${strategy.leadKeyword}",
  "slides": [ ... ],
  "caption": string,
  "hashtags": [ string ],
  "ai_flags": [],
  "risk_level": "low"
}`;
}

export function reviewUserPrompt(opts: { deckJson: string }): string {
  return `[작업] 아래 deck을 검수자 입장에서 비판적으로 점검하라. 네 생성물을 의심하라.
${opts.deckJson}

[규제 판단 원칙] regulatory 축은 "표현이 거센지"가 아니라 "검증 가능한 사실·효과를 단정·보장하는지"로 판단하라.
- ✅ pass: 주관적 의견·취향·추천("무조건 가야 돼요", "강추", "최고예요"). 열정·과장 자체는 막지 않는다.
- ⚠ warn: 근거 없이 객관적 우위·효과를 암시("1위", "검증된", 출처 없는 수치) — 회색지대.
- ✗ fail: 아래 ①②에 명백히 걸릴 때만. 애매하면 pass/warn (오경고는 신뢰를 깎는다 — Precision 우선).

[fail 근거 — 둘 중 하나에 명백히 해당할 때만]
① 인스타가 실제 삭제하는 해악: 사기·기만, 혐오·차별, 타인 사진·저작물 도용(IP 침해), 해로운 허위정보.
② 한국 법령 위반:
   - 표시광고법: 허위·과장·기만 광고(거짓 사실·효과 단정)
   - 의료법·건강기능식품법: 질병 치료·효능·효과 단정, "부작용 없음"
   - 자본시장법: 투자 권유·수익/원금 보장·확정 수익률

[분야 가중] 컨셉(pillars)으로 분야를 정해 강도를 조절:
- 음식·맛집·여행·취미·인테리어: 주관적 추천·열정은 자유. ①②에 걸릴 때만 표시.
- 금융·재테크 / 의료·건강·뷰티: 엄격(효과·수익 단정에 민감).
- 광고·협찬: 광고 표시(뒷광고) 누락 주의.

[7개 품질 축을 각각 pass / warn / fail 로 채점]
- factuality(🔒필수): 수치·통계·실존 매장/브랜드/종목/날짜를 지어내지 않았나(사용자가 준 사실은 OK)
- regulatory(🔒필수): 위 [규제 판단 원칙]대로
- tone: 채널 톤·페르소나 일관(주관적 추천은 톤 문제 아님), 비속어·은어는 warn
- request: 주제·브리프를 반영했나
- completeness: 표지·본문·아웃트로 완결, "첫 번째 포인트"·"정리했어요" 같은 빈 표현 없나
- format: 글자수·구성·해시태그 규칙(문제 있으면 fail, 없으면 pass)
- ux: 가독성·분량 적절한가

[플래그] 문제 있는 축마다 항목을 남겨라. severity는 fail(①② 명백 위반)이면 "block", warn(회색지대)이면 "warn". slide는 해당 슬라이드(예 "표지"·"02"), issue에 근거(예: "의료법·효능 단정")를 적고, suggestion은 고칠 방향.

[출력 JSON]  // 판정(🟢🟡🔴)은 시스템이 계산하니 너는 axes·flags만 출력하라.
{
  "domain": string,
  "axes": {
    "factuality":   { "status": "pass"|"warn"|"fail", "note": string },
    "regulatory":   { "status": "pass"|"warn"|"fail", "note": string },
    "tone":         { "status": "pass"|"warn"|"fail", "note": string },
    "request":      { "status": "pass"|"warn"|"fail", "note": string },
    "completeness": { "status": "pass"|"warn"|"fail", "note": string },
    "format":       { "status": "pass"|"warn"|"fail", "note": string },
    "ux":           { "status": "pass"|"warn"|"fail", "note": string }
  },
  "flags": [ { "slide": string, "axis": string, "severity": "warn"|"block", "issue": string, "suggestion": string } ]
}`;
}
