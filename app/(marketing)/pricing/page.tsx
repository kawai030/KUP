import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { PricingPlans } from "./_plans";

/** 요금제 — 플랜 3종 + 비교표. */
const COMPARE: [string, string, string, string][] = [
  ["인스타 계정 연동", "1개", "3개", "무제한"],
  ["AI 기획·제작", "기본", "무제한", "무제한"],
  ["DM 리드마그넷", "100건", "1,000건", "무제한"],
  ["예약 발행", "—", "✓", "✓"],
  ["콘텐츠 성과 분석", "—", "✓", "✓"],
  ["우선 고객 지원", "—", "—", "✓"],
];

/** 비교표 셀 강조: ✓ → yes(핑크), — → no(흐림) */
function cellClass(v: string): string {
  if (v === "✓") return "yes";
  if (v === "—") return "no";
  return "";
}

/** 표의 ✓ 표시는 디자인 시스템 체크 아이콘으로 렌더(색은 셀의 yes/no 클래스가 결정). */
function cellContent(v: string) {
  return v === "✓" ? <Icon name="check" size={18} className="mx-auto" /> : v;
}

export default function PricingPage() {
  return (
    <section className="section">
      <div className="page-head">
        <span className="kicker">요금제</span>
        <h1>지금은 베타, 모두 무료</h1>
        <p className="lead">베타 기간 동안 모든 플랜을 무료로 운영합니다. 정식 출시 후 아래 요금제로 전환돼요.</p>
      </div>

      <PricingPlans />

      <div className="page-head" style={{ marginTop: 72 }}>
        <h2>플랜 비교</h2>
      </div>
      <div className="cmp-wrap" style={{ marginTop: 28 }}>
        <table className="cmp">
          <thead>
            <tr>
              <th>기능</th>
              <th>베이직</th>
              <th className="colhi">프로</th>
              <th>프리미엄</th>
            </tr>
          </thead>
          <tbody>
            {COMPARE.map((row) => (
              <tr key={row[0]}>
                <td>{row[0]}</td>
                <td className={cellClass(row[1])}>{cellContent(row[1])}</td>
                <td className={`colhi ${cellClass(row[2])}`}>{cellContent(row[2])}</td>
                <td className={cellClass(row[3])}>{cellContent(row[3])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ textAlign: "center", fontSize: 13, marginTop: 18 }}>
        요금 관련 궁금한 점은{" "}
        <Link href="/contact" style={{ color: "var(--pink-deep)", fontWeight: 600 }}>
          문의하기
        </Link>
        에서 알려주세요.
      </p>
    </section>
  );
}
