# scripts/ — CLI·검증·실험 스크립트 안내

이 폴더의 스크립트가 각각 뭘 하는지, 어떻게 돌리는지 정리한다.
크게 **세 종류**다: ① 정식 명령(package.json 등록) · ② 라이브 검증 하네스 · ③ 유틸.

> 공통: 모든 스크립트는 `@/scripts/load-env`를 가장 먼저 import해 `.env.local`을 읽는다.
> 실 LLM을 태우는 스크립트는 `ANTHROPIC_API_KEY`가 있어야 하고, 없으면 mock/폴백으로 동작한다.
> 대부분 **라이브 무영향(읽기 전용)** 이며 결과를 `out/`에 HTML/PNG로 떨군다.

---

## ① 정식 명령 (package.json 등록됨)

`npm run <이름>`으로 실행. 생성 데모와 프롬프트 품질 실험이다.

| npm 명령 | 파일 | 용도 |
|---|---|---|
| `npm run gen` | `generate-deck.ts` | 생성 파이프라인 E2E — 컨셉 → deck JSON + 카드 PNG (`out/`). `-- --save`로 로컬 DB 영속화. **기본 mock이라 키 불필요** |
| `npm run compare` | `compare-card-prompt.ts` | 카드 시스템 프롬프트 A/B 비교 하네스 (읽기 전용) |
| `npm run ground` | `grounded-card-prototype.ts` | 웹서치 그라운딩 프로토타입 (실제 정보가 필요한 주제 대응 스파이크) |
| `npm run render-compare` | `render-card-comparison.ts` | 4방식 카드 비교 → `out/card-comparison.html` |
| `npm run render-prompts` | `render-prompt-comparison.ts` | 프롬프트 A(라이브) vs C(신규) 텍스트 품질 비교 → `out/prompt-comparison.html` |
| `npm run reco-test` | `render-reco-test.ts` | 추천 콘텐츠 프롬프트 실험(환각 회피 vs 실명 허용) → `out/reco-test.html` |
| `npm run persona-stress` | `render-persona-stress.ts` | 6개 계정 컨셉 × 실제 체인 스트레스 테스트 → `out/persona-stress.html` |

---

## ② 라이브 검증 하네스 ⭐

**라이브 `lib/workspace/ai.ts` 실함수를 그대로 태워** 생성·검수 품질을 육안/수치로 검증한다.
자동 테스트가 아직 없으므로(테스트 도입 예정), **지금은 이게 라이브 AI가 잘 도는지 확인하는 주요 수단**이다.
실 키가 필요하고, 대부분 결과를 콘솔 + `out/*.html`로 남긴다.

| npm 명령 | 파일 | 검증 대상 |
|---|---|---|
| `npm run verify:strategy` | `verify-live-strategy.ts` | P2 전략 — 컨셉 그라운딩, topics 개수, 목표 단계 인식, 정직성 |
| `npm run verify:chain` | `verify-live-chain.ts` | 전체 체인 P2(전략)→P4(기획)→P5(제작) 연동 후 품질 유지 |
| `npm run verify:review` | `verify-ai-review-wiring.ts` | AI 검수 배선 — 카드 → aiReviewFlags → decideVerdict(4단계 판정) |
| (직접 실행) | `verify-live-p4p5.ts` | P4 기획 + P5 제작 라이브 함수 최종 육안검증 |
| (직접 실행) | `verify-live-ablation.ts` | 설문 A/B ablation — 설문 조향이 P4/P5 품질에 도움인지 |
| (직접 실행) | `measure-card-lifecycle.ts` | 카드 1개 라이프사이클 토큰 사용량 + 검수 오검출(false-positive) 측정 |
| (직접 실행) | `review-card-test.ts` | AI 검수기(`lib/llm/card-review`) 단독 테스트 — 문제 심은 샘플로 검출 확인 |

> 직접 실행: `npx tsx scripts/<파일명>.ts`

---

## ③ 유틸

| 파일 | 용도 |
|---|---|
| `render-only.ts` | 손으로 쓴/외부 생성 deck JSON을 **렌더만** 한다(LLM 건너뜀). `npx tsx scripts/render-only.ts <concept.json> <deck.json> [--out out/dir]` |
| `load-env.ts` | tsx 스크립트용 `.env` 로더 헬퍼. 다른 스크립트가 **가장 먼저 import**한다. 셸 값 > `.env.local` 우선순위 |

---

## 참고

- 두 생성 시스템(라이브 `lib/workspace` vs 벤치 `lib/generate`)의 관계는 별도 ADR로 문서화 예정.
- 결과물(`out/`)은 git 추적 대상이 아니다(.gitignore).
