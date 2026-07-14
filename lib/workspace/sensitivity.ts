import type { SensitiveDomain } from "./types";

/**
 * 니치(주제)로 민감/규제 도메인을 자동 감지한다.
 * 설문에서 민감도 필드를 없앤 대신 여기서 판별해 → 프롬프트 면책·compliance 검수 가드레일을 유지.
 * 우선순위: 금융 → 의료·건강 → 법률·세무 → 없음. (겹치면 앞이 우선)
 */
const RULES: { domain: SensitiveDomain; keywords: string[] }[] = [
  {
    domain: "금융·투자·부동산",
    keywords: ["재테크", "투자", "주식", "금융", "부동산", "펀드", "코인", "비트코인", "암호화폐", "가상자산", "적금", "예금", "대출", "월급", "연금", "배당", "세일", "청약", "경제", "돈 모으", "자산"],
  },
  {
    domain: "의료·건강·다이어트",
    keywords: ["다이어트", "건강", "의료", "병원", "약", "영양제", "보충제", "홈트", "운동", "헬스", "피트니스", "요가", "필라테스", "스트레칭", "피부", "스킨케어", "뷰티", "성분", "화장품", "식단", "한의", "치과", "멘탈", "정신건강", "수면", "다이어터"],
  },
  {
    domain: "법률·세무",
    keywords: ["법률", "세무", "세금", "변호사", "노무", "법무", "소송", "계약서", "상속", "특허"],
  },
];

export function detectSensitiveDomain(niche: string): SensitiveDomain {
  const n = (niche || "").toLowerCase();
  for (const rule of RULES) {
    if (rule.keywords.some((k) => n.includes(k.toLowerCase()))) return rule.domain;
  }
  return "없음";
}
