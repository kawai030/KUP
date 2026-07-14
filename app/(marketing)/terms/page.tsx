/** 서비스 이용약관 — 예시 문구(정식 검토 필요). */
const SECTIONS: [string, string][] = [
  ["제1조 목적", "본 약관은 KUP가 제공하는 인스타그램 콘텐츠 운영 보조 서비스의 이용 조건·절차와 이용자·회사의 권리·의무를 규정함을 목적으로 합니다."],
  ["제2조 서비스의 내용", "회사는 AI 기반 콘텐츠 기획·제작 보조, 검수·예약 발행, 성과 분석, DM 리드마그넷 자동화 등을 제공합니다. AI 생성물은 이용자의 검수·승인을 거쳐 발행됩니다."],
  ["제3조 요금 및 결제", "베타 기간에는 무료로 운영되며, 유료 전환 시 베이직/프로/프리미엄 요금제가 적용됩니다. 결제·해지·환불은 별도의 결제 정책에 따릅니다."],
  ["제4조 이용자의 의무 및 책임", "이용자는 타인의 권리를 침해하거나 관계 법령에 위반되는 콘텐츠를 제작·발행해서는 안 되며, AI 생성물에 대한 최종 책임은 이를 검수·승인하여 발행한 이용자에게 있습니다."],
];

export default function TermsPage() {
  return (
    <section className="section narrow">
      <div className="page-head left">
        <span className="kicker">약관 · 정책</span>
        <h1>서비스 이용약관</h1>
        <p className="policy-meta">시행일 2026.01.01 · 최종 개정 2026.06.01 · 예시 문구(정식 검토 필요)</p>
      </div>
      <div className="policy">
        {SECTIONS.map(([h, p]) => (
          <section key={h} className="policy-sec">
            <h4>{h}</h4>
            <p>{p}</p>
          </section>
        ))}
      </div>
    </section>
  );
}
